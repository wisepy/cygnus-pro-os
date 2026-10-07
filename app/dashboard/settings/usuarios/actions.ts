"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { hashPassword, requireRole } from "@/lib/auth";
import { execute } from "@/lib/db";
import { createStaffSchema, updateStaffSchema, type CreateStaffInput, type UpdateStaffInput } from "@/lib/validations/profile";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

function parseFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createStaff(input: CreateStaffInput): Promise<ActionState> {
  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parseFieldErrors(parsed.error.issues) };
  }

  const profile = await requireRole(["admin"]);
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    await execute(
      `INSERT INTO profiles
        (id, clinic_id, role, full_name, email, password_hash, phone, specialty, color_hex, is_bookable, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        randomUUID(),
        profile.clinicId,
        parsed.data.role,
        parsed.data.fullName,
        parsed.data.email.toLowerCase(),
        passwordHash,
        parsed.data.phone || null,
        parsed.data.specialty || null,
        parsed.data.colorHex,
        parsed.data.isBookable ? 1 : 0,
      ],
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
      return { error: "Ese correo ya está registrado." };
    }
    throw error;
  }

  revalidatePath("/dashboard/settings/usuarios");
  return { success: true };
}

export async function updateStaff(input: UpdateStaffInput): Promise<ActionState> {
  const parsed = updateStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parseFieldErrors(parsed.error.issues) };
  }

  const current = await requireRole(["admin"]);

  // Evita que la dirección se quite el acceso a sí misma y deje la clínica sin administrador.
  if (parsed.data.profileId === current.id && (!parsed.data.active || parsed.data.role !== "admin")) {
    return { error: "No puedes desactivarte ni quitarte el rol de dirección a ti mismo." };
  }

  await execute(
    `UPDATE profiles
        SET full_name = ?, role = ?, phone = ?, specialty = ?, color_hex = ?, is_bookable = ?, active = ?
      WHERE id = ? AND clinic_id = ?`,
    [
      parsed.data.fullName,
      parsed.data.role,
      parsed.data.phone || null,
      parsed.data.specialty || null,
      parsed.data.colorHex,
      parsed.data.isBookable ? 1 : 0,
      parsed.data.active ? 1 : 0,
      parsed.data.profileId,
      current.clinicId,
    ],
  );

  revalidatePath("/dashboard/settings/usuarios");
  return { success: true };
}
