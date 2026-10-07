"use server";

import { randomUUID } from "node:crypto";
import type { ResultSetHeader } from "mysql2/promise";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { execute, transaction } from "@/lib/db";
import { categorySchema, serviceSchema, type CategoryInput, type ServiceInput } from "@/lib/validations/service";
import type { ActionState } from "../usuarios/actions";

function parseFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createCategory(input: CategoryInput): Promise<ActionState> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: parseFieldErrors(parsed.error.issues) };

  const profile = await requireRole(["admin"]);

  await execute("INSERT INTO service_categories (id, clinic_id, name) VALUES (?, ?, ?)", [
    randomUUID(),
    profile.clinicId,
    parsed.data.name,
  ]);

  revalidatePath("/dashboard/settings/servicios");
  return { success: true };
}

export async function saveService(input: ServiceInput): Promise<ActionState> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: parseFieldErrors(parsed.error.issues) };

  const profile = await requireRole(["admin"]);
  const data = parsed.data;
  const serviceId = data.id ?? randomUUID();

  const values = [
    data.categoryId || null,
    data.name,
    data.description || null,
    data.durationMinutes,
    data.pricingType,
    data.pricingType === "fixed" ? (data.basePrice ?? 0) : 0,
    data.isPackage ? 1 : 0,
    data.isPackage ? (data.packageSessionsCount ?? null) : null,
    data.active ? 1 : 0,
  ];

  await transaction(async (conn) => {
    if (data.id) {
      // Solo se toca un servicio de esta clinica.
      const [result] = await conn.query<ResultSetHeader>(
        `UPDATE services
            SET category_id = ?, name = ?, description = ?, duration_minutes = ?, pricing_type = ?,
                base_price = ?, is_package = ?, package_sessions_count = ?, active = ?
          WHERE id = ? AND clinic_id = ?`,
        [...values, serviceId, profile.clinicId],
      );
      if (result.affectedRows === 0) {
        throw new Error("El servicio no existe en esta clínica.");
      }
      await conn.query("DELETE FROM service_zone_prices WHERE service_id = ?", [serviceId]);
    } else {
      await conn.query(
        `INSERT INTO services
          (id, clinic_id, category_id, name, description, duration_minutes, pricing_type,
           base_price, is_package, package_sessions_count, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [serviceId, profile.clinicId, ...values],
      );
    }

    if (data.pricingType === "by_zone" && data.zonePrices && data.zonePrices.length > 0) {
      for (const [index, zone] of data.zonePrices.entries()) {
        await conn.query(
          "INSERT INTO service_zone_prices (id, service_id, zone_name, price, sort_order) VALUES (?, ?, ?, ?, ?)",
          [randomUUID(), serviceId, zone.zoneName, zone.price, index],
        );
      }
    }
  });

  revalidatePath("/dashboard/settings/servicios");
  return { success: true };
}

export async function toggleServiceActive(serviceId: string, active: boolean): Promise<ActionState> {
  const profile = await requireRole(["admin"]);

  await execute("UPDATE services SET active = ? WHERE id = ? AND clinic_id = ?", [
    active ? 1 : 0,
    serviceId,
    profile.clinicId,
  ]);

  revalidatePath("/dashboard/settings/servicios");
  return { success: true };
}
