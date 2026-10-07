"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { execute, query, queryOne } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/app/dashboard/settings/usuarios/actions";

const DAY_MS = 24 * 60 * 60 * 1000;

type Candidate = { patientId: string; type: "retention" | "follow_up" | "cross_sell"; serviceId: string | null; reason: string };

/**
 * Motor de oportunidades (reglas explícitas, sin IA):
 * - retention: la última visita completada fue hace 60 a 365 días y no hay cita futura.
 * - follow_up: un plan se completó hace 14 a 60 días.
 * - cross_sell: al menos 3 atenciones en una categoría y ninguna en otra; se sugiere un servicio de la otra.
 * Nunca duplica una oportunidad que ya está pendiente para la misma paciente y tipo.
 */
export async function generateOpportunities(): Promise<ActionState & { created?: number }> {
  const profile = await requireRole(["admin"]);
  const clinicId = profile.clinicId;
  const now = Date.now();

  const [lastVisits, plans, categoryCounts, categories] = await Promise.all([
    query<RowDataPacket & { patient_id: string; last_visit: Date; last_service: string | null }>(
      `SELECT a.patient_id, MAX(a.start_at) AS last_visit,
              SUBSTRING_INDEX(GROUP_CONCAT(a.service_id ORDER BY a.start_at DESC), ',', 1) AS last_service
         FROM appointments a
        WHERE a.clinic_id = ? AND a.patient_id IS NOT NULL AND a.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM appointments f WHERE f.patient_id = a.patient_id AND f.start_at > NOW(6) AND f.status NOT IN ('cancelled','no_show'))
        GROUP BY a.patient_id`,
      [clinicId],
    ),
    query<RowDataPacket & { patient_id: string; service_id: string; last_session: Date }>(
      `SELECT tp.patient_id, tp.service_id, MAX(ts.created_at) AS last_session
         FROM treatment_plans tp
         JOIN treatment_sessions ts ON ts.treatment_plan_id = tp.id
         JOIN patients p ON p.id = tp.patient_id
        WHERE p.clinic_id = ? AND tp.status = 'completed'
        GROUP BY tp.id, tp.patient_id, tp.service_id`,
      [clinicId],
    ),
    query<RowDataPacket & { patient_id: string; category_id: string; n: number }>(
      `SELECT a.patient_id, s.category_id, COUNT(*) AS n
         FROM appointments a JOIN services s ON s.id = a.service_id
        WHERE a.clinic_id = ? AND a.status = 'completed' AND s.category_id IS NOT NULL
        GROUP BY a.patient_id, s.category_id`,
      [clinicId],
    ),
    query<RowDataPacket & { id: string; category_id: string | null }>(
      "SELECT id, category_id FROM services WHERE clinic_id = ? AND active = 1 ORDER BY name",
      [clinicId],
    ),
  ]);

  const candidates: Candidate[] = [];

  for (const v of lastVisits) {
    const days = Math.floor((now - new Date(v.last_visit).getTime()) / DAY_MS);
    if (days >= 60 && days <= 365) {
      candidates.push({
        patientId: v.patient_id,
        type: "retention",
        serviceId: v.last_service,
        reason: `Última visita hace ${days} días y no tiene cita agendada.`,
      });
    }
  }

  for (const p of plans) {
    const days = Math.floor((now - new Date(p.last_session).getTime()) / DAY_MS);
    if (days >= 14 && days <= 60) {
      candidates.push({
        patientId: p.patient_id,
        type: "follow_up",
        serviceId: p.service_id,
        reason: `Completó el plan hace ${days} días. Conviene revisar resultados y mantención.`,
      });
    }
  }

  const byPatient = new Map<string, Map<string, number>>();
  for (const c of categoryCounts) {
    const m = byPatient.get(c.patient_id) ?? new Map<string, number>();
    m.set(c.category_id, Number(c.n));
    byPatient.set(c.patient_id, m);
  }
  for (const [patientId, counts] of byPatient) {
    const strong = [...counts.entries()].find(([, n]) => n >= 3);
    if (!strong) continue;
    const otherCategories = categories.filter((s) => s.category_id && s.category_id !== strong[0] && !counts.has(s.category_id));
    const target = otherCategories[0];
    if (!target) continue;
    candidates.push({
      patientId,
      type: "cross_sell",
      serviceId: target.id,
      reason: "Tiene varias atenciones en un área y ninguna en otra que la complementa.",
    });
  }

  const pending = await query<RowDataPacket & { patient_id: string; type: string }>(
    "SELECT patient_id, type FROM opportunities WHERE clinic_id = ? AND status = 'pending'",
    [clinicId],
  );
  const alreadyOpen = new Set(pending.map((p) => `${p.patient_id}|${p.type}`));

  let created = 0;
  for (const c of candidates) {
    if (alreadyOpen.has(`${c.patientId}|${c.type}`)) continue;
    await execute(
      `INSERT INTO opportunities (id, clinic_id, patient_id, type, suggested_service_id, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [randomUUID(), clinicId, c.patientId, c.type, c.serviceId, c.reason],
    );
    alreadyOpen.add(`${c.patientId}|${c.type}`);
    created++;
  }

  await audit({ clinicId, actorId: profile.id, action: "opportunities.generate", entityType: "clinic", entityId: clinicId, metadata: { created } });
  revalidatePath("/dashboard/ventas");
  return { success: true, created };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["contacted", "dismissed"]),
});

export async function setOpportunityStatus(input: unknown): Promise<ActionState> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };
  const profile = await requireRole(["admin"]);
  const row = await queryOne<RowDataPacket & { id: string }>(
    "SELECT id FROM opportunities WHERE id = ? AND clinic_id = ?",
    [parsed.data.id, profile.clinicId],
  );
  if (!row) return { error: "La oportunidad no existe." };
  await execute("UPDATE opportunities SET status = ? WHERE id = ? AND clinic_id = ?", [parsed.data.status, parsed.data.id, profile.clinicId]);
  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "opportunity.status", entityType: "opportunity", entityId: parsed.data.id, metadata: { status: parsed.data.status } });
  revalidatePath("/dashboard/ventas");
  return { success: true };
}
