"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { execute } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/app/dashboard/settings/usuarios/actions";

const resourceSchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre").max(120),
  kind: z.enum(["box", "machine"]),
});

/** Alta de una cabina o máquina. Solo dirección. */
export async function createResource(input: unknown): Promise<ActionState> {
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const profile = await requireRole(["admin"]);

  try {
    await execute("INSERT INTO resources (id, clinic_id, name, kind) VALUES (?, ?, ?, ?)", [
      randomUUID(),
      profile.clinicId,
      parsed.data.name,
      parsed.data.kind,
    ]);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
      return { error: "Ya existe un recurso con ese nombre." };
    }
    throw error;
  }

  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "resource.create", entityType: "resource" });
  revalidatePath("/dashboard/settings/recursos");
  return { success: true };
}

/** Desactiva o reactiva un recurso sin borrarlo, para conservar el historial de citas. */
export async function setResourceActive(resourceId: string, active: boolean): Promise<ActionState> {
  const profile = await requireRole(["admin"]);
  const result = await execute("UPDATE resources SET active = ? WHERE id = ? AND clinic_id = ?", [
    active ? 1 : 0,
    resourceId,
    profile.clinicId,
  ]);
  if (result.affectedRows === 0) return { error: "El recurso no existe." };
  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "resource.toggle", entityType: "resource", entityId: resourceId, metadata: { active } });
  revalidatePath("/dashboard/settings/recursos");
  return { success: true };
}
