"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { requireProfile, requireRole } from "@/lib/auth";
import { query, queryOne, transaction } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fingerprint } from "@/lib/crypto";
import {
  alertSchema,
  consentFormSchema,
  consentSchema,
  patientSchema,
  planSchema,
  sessionSchema,
  type PatientInput,
} from "@/lib/validations/patient";
import type { ActionState } from "@/app/dashboard/settings/usuarios/actions";

const DEMOGRAPHICS_ROLES = ["admin", "recepcion", "profesional"] as const;
const CLINICAL_ROLES = ["admin", "profesional"] as const;

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Huella de la IP del cliente. Nunca se guarda la IP en claro. */
async function clientIpHash() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconocida";
  return fingerprint(ip);
}

async function assertPatientInClinic(patientId: string, clinicId: string) {
  const row = await queryOne<RowDataPacket & { id: string }>(
    "SELECT id FROM patients WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
    [patientId, clinicId],
  );
  if (!row) throw new Error("La paciente no existe.");
}

export async function savePatient(input: PatientInput): Promise<ActionState> {
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const profile = await requireRole([...DEMOGRAPHICS_ROLES]);
  const d = parsed.data;

  const values = [
    d.fullName,
    d.rut || null,
    d.birthDate || null,
    d.gender || null,
    d.phone || null,
    d.email || null,
    d.address || null,
    d.comuna || null,
    d.referredBy || null,
    d.notes || null,
  ];

  try {
    if (d.id) {
      await assertPatientInClinic(d.id, profile.clinicId);
      await query(
        `UPDATE patients SET full_name=?, rut=?, birth_date=?, gender=?, phone=?, email=?, address=?, comuna=?, referred_by=?, notes=?
          WHERE id = ? AND clinic_id = ?`,
        [...values, d.id, profile.clinicId],
      );
      await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "patient.update", entityType: "patient", entityId: d.id });
    } else {
      const id = randomUUID();
      await query(
        `INSERT INTO patients (id, clinic_id, full_name, rut, birth_date, gender, phone, email, address, comuna, referred_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, profile.clinicId, ...values],
      );
      await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "patient.create", entityType: "patient", entityId: id });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
      return { error: "Ya existe una paciente con ese RUT." };
    }
    throw error;
  }

  revalidatePath("/dashboard/clinica");
  return { success: true };
}

export async function addMedicalAlert(input: unknown): Promise<ActionState> {
  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const profile = await requireRole([...CLINICAL_ROLES]);
  await assertPatientInClinic(parsed.data.patientId, profile.clinicId);

  await query(
    "INSERT INTO medical_alerts (id, patient_id, type, severity, description) VALUES (?, ?, ?, ?, ?)",
    [randomUUID(), parsed.data.patientId, parsed.data.type, parsed.data.severity, parsed.data.description],
  );
  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "alert.create", entityType: "patient", entityId: parsed.data.patientId });
  revalidatePath(`/dashboard/clinica/${parsed.data.patientId}`);
  return { success: true };
}

export async function toggleMedicalAlert(alertId: string, patientId: string, active: boolean): Promise<ActionState> {
  const profile = await requireRole([...CLINICAL_ROLES]);
  await assertPatientInClinic(patientId, profile.clinicId);
  await query("UPDATE medical_alerts SET is_active = ? WHERE id = ? AND patient_id = ?", [active ? 1 : 0, alertId, patientId]);
  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "alert.toggle", entityType: "patient", entityId: patientId, metadata: { active } });
  revalidatePath(`/dashboard/clinica/${patientId}`);
  return { success: true };
}

export async function createTreatmentPlan(input: unknown): Promise<ActionState> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const profile = await requireRole([...CLINICAL_ROLES]);
  await assertPatientInClinic(parsed.data.patientId, profile.clinicId);

  const service = await queryOne<RowDataPacket & { id: string }>(
    "SELECT id FROM services WHERE id = ? AND clinic_id = ?",
    [parsed.data.serviceId, profile.clinicId],
  );
  if (!service) return { error: "El servicio no existe." };

  await query(
    "INSERT INTO treatment_plans (id, patient_id, service_id, total_sessions, sessions_completed, status) VALUES (?, ?, ?, ?, 0, 'active')",
    [randomUUID(), parsed.data.patientId, parsed.data.serviceId, parsed.data.totalSessions],
  );
  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "plan.create", entityType: "patient", entityId: parsed.data.patientId });
  revalidatePath(`/dashboard/clinica/${parsed.data.patientId}`);
  return { success: true };
}

/** Registra una sesión de evolución. Si viene de un plan, avanza el plan y lo completa al llegar al total. */
export async function addTreatmentSession(input: unknown): Promise<ActionState> {
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const profile = await requireRole([...CLINICAL_ROLES]);
  const data = parsed.data;
  await assertPatientInClinic(data.patientId, profile.clinicId);

  await transaction(async (conn: PoolConnection) => {
    let planId: string | null = null;
    let sessionNumber = 1;
    if (data.treatmentPlanId) {
      const [plans] = await conn.query<(RowDataPacket & { id: string; total_sessions: number; sessions_completed: number; status: string })[]>(
        "SELECT id, total_sessions, sessions_completed, status FROM treatment_plans WHERE id = ? AND patient_id = ? FOR UPDATE",
        [data.treatmentPlanId, data.patientId],
      );
      const plan = plans[0];
      if (!plan || plan.status !== "active") throw new Error("El plan no está activo.");
      planId = plan.id;
      sessionNumber = plan.sessions_completed + 1;
      const done = sessionNumber >= plan.total_sessions;
      await conn.query("UPDATE treatment_plans SET sessions_completed = ?, status = ? WHERE id = ?", [
        sessionNumber,
        done ? "completed" : "active",
        plan.id,
      ]);
    }
    await conn.query(
      `INSERT INTO treatment_sessions (id, treatment_plan_id, patient_id, profile_id, session_number, evolution_notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), planId, data.patientId, profile.id, sessionNumber, data.evolutionNotes],
    );
  });

  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "session.create", entityType: "patient", entityId: data.patientId });
  revalidatePath(`/dashboard/clinica/${data.patientId}`);
  return { success: true };
}

export async function createConsentForm(input: unknown): Promise<ActionState> {
  const parsed = consentFormSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const profile = await requireRole(["admin"]);

  // Una versión nueva reemplaza a la anterior: las firmas antiguas conservan su texto congelado.
  await transaction(async (conn: PoolConnection) => {
    await conn.query("UPDATE consent_forms SET active = 0 WHERE clinic_id = ? AND active = 1", [profile.clinicId]);
    const [rows] = await conn.query<(RowDataPacket & { v: number | null })[]>(
      "SELECT MAX(version) AS v FROM consent_forms WHERE clinic_id = ?",
      [profile.clinicId],
    );
    await conn.query(
      "INSERT INTO consent_forms (id, clinic_id, title, body, version, active) VALUES (?, ?, ?, ?, ?, 1)",
      [randomUUID(), profile.clinicId, parsed.data.title, parsed.data.body, (rows[0].v ?? 0) + 1],
    );
  });

  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "consent_form.publish", entityType: "consent_form" });
  revalidatePath("/dashboard/clinica");
  return { success: true };
}

/** Firma de consentimiento: congela el texto y la versión que la paciente aceptó. */
export async function signConsent(input: unknown): Promise<ActionState> {
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const profile = await requireRole([...CLINICAL_ROLES]);
  const data = parsed.data;
  await assertPatientInClinic(data.patientId, profile.clinicId);

  const form = await queryOne<RowDataPacket & { id: string; body: string; version: number }>(
    "SELECT id, body, version FROM consent_forms WHERE id = ? AND clinic_id = ? AND active = 1",
    [data.consentFormId, profile.clinicId],
  );
  if (!form) return { error: "El consentimiento ya no está vigente. Recarga la página." };

  await query(
    `INSERT INTO patient_consents (id, patient_id, consent_form_id, form_version, form_body_snapshot, signer_name, signer_rut, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      data.patientId,
      form.id,
      form.version,
      form.body,
      data.signerName,
      data.signerRut || null,
      await clientIpHash(),
    ],
  );
  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "consent.sign", entityType: "patient", entityId: data.patientId, metadata: { version: form.version } });
  revalidatePath(`/dashboard/clinica/${data.patientId}`);
  return { success: true };
}

/**
 * Derecho de eliminación (ARCO). Solo dirección. Escribe primero la constancia en
 * deletion_log (inmodificable) y luego borra la ficha. Los pagos conservan su registro
 * contable sin el nombre de la paciente.
 */
export async function deletePatient(patientId: string, reason: string, confirmation: string): Promise<ActionState> {
  const profile = await requireRole(["admin"]);
  if (reason.trim().length < 10) return { error: "Indica el motivo de la eliminación (mínimo 10 caracteres)." };
  if (confirmation !== "ELIMINAR") return { error: "Escribe ELIMINAR para confirmar." };
  const patient = await queryOne<RowDataPacket & { id: string; rut: string | null }>(
    "SELECT id, rut FROM patients WHERE id = ? AND clinic_id = ?",
    [patientId, profile.clinicId],
  );
  if (!patient) return { error: "La paciente no existe." };

  await transaction(async (conn: PoolConnection) => {
    await conn.query(
      "INSERT INTO deletion_log (id, clinic_id, patient_ref, actor_id, reason) VALUES (?, ?, ?, ?, ?)",
      [randomUUID(), profile.clinicId, fingerprint(`${patient.id}|${patient.rut ?? ""}`), profile.id, reason.trim().slice(0, 500)],
    );
    await conn.query("DELETE FROM patients WHERE id = ? AND clinic_id = ?", [patientId, profile.clinicId]);
  });

  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "patient.delete", entityType: "patient", entityId: null, metadata: { arco: true } });
  revalidatePath("/dashboard/clinica");
  return { success: true };
}
