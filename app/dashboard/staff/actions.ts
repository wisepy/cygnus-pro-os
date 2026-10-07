"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { execute, queryOne } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/app/dashboard/settings/usuarios/actions";

const rateSchema = z.object({
  profileId: z.string().uuid("Selecciona una profesional"),
  serviceId: z.string().uuid().optional().or(z.literal("")),
  rateType: z.enum(["percentage", "fixed"]),
  rateValue: z.coerce.number().min(0).max(100_000_000),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

/** Alta de una tasa de comisión. Solo dirección. Las tasas antiguas no se editan: se agregan nuevas con fecha de vigencia. */
export async function addCommissionRate(input: unknown): Promise<ActionState> {
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const profile = await requireRole(["admin"]);
  const data = parsed.data;

  if (data.rateType === "percentage" && data.rateValue > 100) return { error: "El porcentaje no puede superar 100." };

  const target = await queryOne<RowDataPacket & { id: string }>(
    "SELECT id FROM profiles WHERE id = ? AND clinic_id = ?",
    [data.profileId, profile.clinicId],
  );
  if (!target) return { error: "La profesional no existe en esta clínica." };

  if (data.serviceId) {
    const service = await queryOne<RowDataPacket & { id: string }>(
      "SELECT id FROM services WHERE id = ? AND clinic_id = ?",
      [data.serviceId, profile.clinicId],
    );
    if (!service) return { error: "El servicio no existe en esta clínica." };
  }

  const id = randomUUID();
  await execute(
    `INSERT INTO commission_rates (id, clinic_id, profile_id, service_id, rate_type, rate_value, effective_from)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, profile.clinicId, data.profileId, data.serviceId || null, data.rateType, data.rateValue, data.effectiveFrom],
  );
  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "commission.rate_add", entityType: "profile", entityId: data.profileId });
  revalidatePath("/dashboard/staff");
  return { success: true };
}
