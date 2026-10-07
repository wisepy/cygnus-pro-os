"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { requireProfile } from "@/lib/auth";
import { query, queryOne, transaction } from "@/lib/db";
import { audit } from "@/lib/audit";
import { localToUtc } from "@/lib/dates";
import {
  createAppointmentSchema,
  createBlockSchema,
  setStatusSchema,
  type CreateAppointmentInput,
  type CreateBlockInput,
  type SetStatusInput,
} from "@/lib/validations/appointment";
import type { ActionState } from "@/app/dashboard/settings/usuarios/actions";

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

class ScheduleConflict extends Error {}

/** Choque de horarios: el profesional o la cabina no pueden estar ocupados en el intervalo. */
async function assertNoConflict(
  conn: PoolConnection,
  clinicId: string,
  profileId: string,
  resourceId: string | null,
  start: Date,
  end: Date,
) {
  const [rows] = await conn.query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM appointments
      WHERE clinic_id = ?
        AND status NOT IN ('cancelled','no_show')
        AND (profile_id = ? OR (? IS NOT NULL AND resource_id = ?))
        AND start_at < ? AND end_at > ?`,
    [clinicId, profileId, resourceId, resourceId, end, start],
  );
  if (rows[0].total > 0) throw new ScheduleConflict();
}

export async function createAppointment(input: CreateAppointmentInput): Promise<ActionState> {
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "recepcion") {
    return { error: "Solo recepción y dirección pueden agendar citas." };
  }
  const data = parsed.data;

  const service = await queryOne<RowDataPacket & { duration_minutes: number; active: number }>(
    "SELECT duration_minutes, active FROM services WHERE id = ? AND clinic_id = ?",
    [data.serviceId, profile.clinicId],
  );
  if (!service || !service.active) return { error: "El servicio no está disponible." };

  const provider = await queryOne<RowDataPacket & { is_bookable: number; active: number }>(
    "SELECT is_bookable, active FROM profiles WHERE id = ? AND clinic_id = ?",
    [data.profileId, profile.clinicId],
  );
  if (!provider || !provider.is_bookable || !provider.active) {
    return { error: "Ese profesional no está disponible para agendar." };
  }

  const patient = await queryOne<RowDataPacket>(
    "SELECT id FROM patients WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
    [data.patientId, profile.clinicId],
  );
  if (!patient) return { error: "La paciente no existe." };

  const start = localToUtc(data.start);
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);
  const resourceId = data.resourceId || null;
  const appointmentId = randomUUID();

  try {
    await transaction(async (conn) => {
      // Bloquea al profesional: dos reservas simultáneas no pueden pasar el control de choques a la vez.
      await conn.query("SELECT id FROM profiles WHERE id = ? FOR UPDATE", [data.profileId]);
      await assertNoConflict(conn, profile.clinicId, data.profileId, resourceId, start, end);
      await conn.query(
        `INSERT INTO appointments
          (id, clinic_id, patient_id, profile_id, service_id, resource_id, app_type, start_at, end_at, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'appointment', ?, ?, 'scheduled', ?, ?)`,
        [appointmentId, profile.clinicId, data.patientId, data.profileId, data.serviceId, resourceId, start, end, data.notes || null, profile.id],
      );
    });
  } catch (error) {
    if (error instanceof ScheduleConflict) {
      return { error: "Ese horario ya está ocupado para el profesional o la cabina." };
    }
    throw error;
  }

  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "appointment.create", entityType: "appointment", entityId: appointmentId });
  revalidatePath("/dashboard/agenda");
  return { success: true };
}

export async function createBlock(input: CreateBlockInput): Promise<ActionState> {
  const parsed = createBlockSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "recepcion") {
    return { error: "Solo recepción y dirección pueden bloquear horarios." };
  }
  const data = parsed.data;
  const start = localToUtc(data.start);
  const end = new Date(start.getTime() + data.durationMinutes * 60_000);

  try {
    await transaction(async (conn) => {
      await conn.query("SELECT id FROM profiles WHERE id = ? AND clinic_id = ? FOR UPDATE", [data.profileId, profile.clinicId]);
      await assertNoConflict(conn, profile.clinicId, data.profileId, null, start, end);
      await conn.query(
        `INSERT INTO appointments (id, clinic_id, patient_id, profile_id, service_id, app_type, block_reason, start_at, end_at, status, created_by)
         VALUES (?, ?, NULL, ?, NULL, 'block', ?, ?, ?, 'confirmed', ?)`,
        [randomUUID(), profile.clinicId, data.profileId, data.reason, start, end, profile.id],
      );
    });
  } catch (error) {
    if (error instanceof ScheduleConflict) return { error: "Ya hay una cita o bloqueo en ese horario." };
    throw error;
  }

  revalidatePath("/dashboard/agenda");
  return { success: true };
}

/**
 * Cambios de estado. Recepción y dirección cambian cualquier cita; la profesional
 * solo las suyas, y solo a llegó, en curso o completada.
 */
export async function setAppointmentStatus(input: SetStatusInput): Promise<ActionState> {
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };
  const profile = await requireProfile();

  const row = await queryOne<RowDataPacket & { profile_id: string }>(
    "SELECT profile_id FROM appointments WHERE id = ? AND clinic_id = ?",
    [parsed.data.appointmentId, profile.clinicId],
  );
  if (!row) return { error: "La cita no existe." };

  const isOwnProfessional = profile.role === "profesional" && row.profile_id === profile.id;
  const isFrontDesk = profile.role === "admin" || profile.role === "recepcion";
  if (!isFrontDesk && !isOwnProfessional) return { error: "No tienes permisos para esta cita." };
  if (isOwnProfessional && !["checked_in", "in_progress", "completed"].includes(parsed.data.status)) {
    return { error: "Solo puedes marcar la atención como llegó, en curso o completada." };
  }

  await query("UPDATE appointments SET status = ? WHERE id = ? AND clinic_id = ?", [
    parsed.data.status,
    parsed.data.appointmentId,
    profile.clinicId,
  ]);
  await audit({
    clinicId: profile.clinicId,
    actorId: profile.id,
    action: "appointment.status",
    entityType: "appointment",
    entityId: parsed.data.appointmentId,
    metadata: { status: parsed.data.status },
  });

  revalidatePath("/dashboard/agenda");
  return { success: true };
}

/** Búsqueda de pacientes para el selector de la agenda. Solo nombre y RUT, máximo 20 resultados. */
export async function searchPatients(term: string): Promise<{ id: string; full_name: string; rut: string | null }[]> {
  const profile = await requireProfile();
  if (profile.role === "caja") return [];
  const q = term.trim().slice(0, 80);
  if (q.length < 2) return [];
  return query<RowDataPacket & { id: string; full_name: string; rut: string | null }>(
    `SELECT id, full_name, rut FROM patients
      WHERE clinic_id = ? AND deleted_at IS NULL AND (full_name LIKE ? OR rut LIKE ?)
      ORDER BY full_name LIMIT 20`,
    [profile.clinicId, `%${q}%`, `%${q}%`],
  );
}
