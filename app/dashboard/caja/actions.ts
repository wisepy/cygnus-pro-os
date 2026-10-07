"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { requireRole } from "@/lib/auth";
import { execute, query, queryOne, transaction } from "@/lib/db";
import { audit } from "@/lib/audit";
import { z } from "zod";
import type { ActionState } from "@/app/dashboard/settings/usuarios/actions";

const CASH_ROLES = ["admin", "caja"] as const;
const METHODS = ["efectivo", "transferencia", "debito", "credito"] as const;

const paymentSchema = z.object({
  appointmentId: z.string().uuid(),
  amount: z.coerce.number().int().min(0).max(100_000_000),
  method: z.enum(METHODS),
});

const saleSchema = z.object({
  method: z.enum(METHODS),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(100) })).min(1, "Agrega al menos un producto").max(30),
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  price: z.coerce.number().int().min(0).max(100_000_000),
  stock: z.coerce.number().int().min(0).max(100_000),
});

function firstError(issues: { message: string }[]) {
  return issues[0]?.message ?? "Datos inválidos.";
}

async function openRegisterOf(clinicId: string) {
  return queryOne<RowDataPacket & { id: string; opening_amount: number; opened_at: Date }>(
    "SELECT id, opening_amount, opened_at FROM cash_registers WHERE clinic_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1",
    [clinicId],
  );
}

export async function openCashRegister(openingAmount: number): Promise<ActionState> {
  const profile = await requireRole([...CASH_ROLES]);
  const amount = z.coerce.number().int().min(0).max(100_000_000).safeParse(openingAmount);
  if (!amount.success) return { error: "Monto inicial inválido." };
  if (await openRegisterOf(profile.clinicId)) return { error: "Ya hay una caja abierta." };

  const id = randomUUID();
  await query("INSERT INTO cash_registers (id, clinic_id, opened_by, opening_amount) VALUES (?, ?, ?, ?)", [
    id,
    profile.clinicId,
    profile.id,
    amount.data,
  ]);
  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "cash.open", entityType: "cash_register", entityId: id });
  revalidatePath("/dashboard/caja");
  return { success: true };
}

/** Totales de efectivo y de cada medio de pago de una caja (pagos de citas + ventas de productos). */
async function registerTotals(conn: PoolConnection | null, registerId: string) {
  const run = <T extends RowDataPacket>(sql: string, params: unknown[]) =>
    conn ? conn.query<T[]>(sql, params).then(([rows]) => rows) : query<T>(sql, params);
  const rows = await run<RowDataPacket & { method: string; total: number }>(
    `SELECT method, SUM(amount) AS total FROM payments WHERE cash_register_id = ? AND status = 'completed' GROUP BY method
     UNION ALL
     SELECT method, SUM(total) AS total FROM sales WHERE cash_register_id = ? GROUP BY method`,
    [registerId, registerId],
  );
  const byMethod: Record<string, number> = Object.fromEntries(METHODS.map((m) => [m, 0]));
  for (const row of rows) byMethod[row.method] = (byMethod[row.method] ?? 0) + Number(row.total ?? 0);
  return byMethod;
}

export async function registerAppointmentPayment(input: unknown): Promise<ActionState> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error.issues) };
  const profile = await requireRole([...CASH_ROLES]);
  const register = await openRegisterOf(profile.clinicId);
  if (!register) return { error: "Abre la caja antes de cobrar." };
  const data = parsed.data;

  const appointment = await queryOne<RowDataPacket & { patient_id: string | null; status: string; app_type: string }>(
    "SELECT patient_id, status, app_type FROM appointments WHERE id = ? AND clinic_id = ?",
    [data.appointmentId, profile.clinicId],
  );
  if (!appointment || appointment.app_type !== "appointment") return { error: "La cita no existe." };
  if (appointment.status === "cancelled" || appointment.status === "no_show") return { error: "Esta cita no se puede cobrar." };
  if (!appointment.patient_id) return { error: "La cita no tiene paciente asignado." };

  try {
    await transaction(async (conn) => {
      await conn.query("SELECT id FROM cash_registers WHERE id = ? FOR UPDATE", [register.id]);
      const [paid] = await conn.query<(RowDataPacket & { n: number })[]>(
        "SELECT COUNT(*) AS n FROM payments WHERE appointment_id = ? AND status = 'completed'",
        [data.appointmentId],
      );
      if (paid[0].n > 0) throw new Error("ALREADY_PAID");
      await conn.query(
        `INSERT INTO payments (id, clinic_id, cash_register_id, appointment_id, patient_id, amount, method, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
        [randomUUID(), profile.clinicId, register.id, data.appointmentId, appointment.patient_id, data.amount, data.method, profile.id],
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_PAID") return { error: "Esta cita ya fue cobrada." };
    throw error;
  }

  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "payment.create", entityType: "appointment", entityId: data.appointmentId, metadata: { amount: data.amount, method: data.method } });
  revalidatePath("/dashboard/caja");
  return { success: true };
}

/** Venta de productos. Descuenta stock dentro de la misma transacción; si falta stock, nada se registra. */
export async function registerSale(input: unknown): Promise<ActionState> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error.issues) };
  const profile = await requireRole([...CASH_ROLES]);
  const register = await openRegisterOf(profile.clinicId);
  if (!register) return { error: "Abre la caja antes de vender." };
  const data = parsed.data;

  try {
    await transaction(async (conn) => {
      let total = 0;
      const lines: { productId: string; name: string; price: number; quantity: number }[] = [];
      for (const item of data.items) {
        const [rows] = await conn.query<(RowDataPacket & { id: string; name: string; price: number; stock: number })[]>(
          "SELECT id, name, price, stock FROM products WHERE id = ? AND clinic_id = ? AND active = 1 FOR UPDATE",
          [item.productId, profile.clinicId],
        );
        const product = rows[0];
        if (!product) throw new Error("Un producto ya no está disponible.");
        if (product.stock < item.quantity) throw new Error(`Stock insuficiente de ${product.name}.`);
        await conn.query("UPDATE products SET stock = stock - ? WHERE id = ?", [item.quantity, product.id]);
        lines.push({ productId: product.id, name: product.name, price: Number(product.price), quantity: item.quantity });
        total += Number(product.price) * item.quantity;
      }
      const saleId = randomUUID();
      await conn.query(
        "INSERT INTO sales (id, clinic_id, cash_register_id, total, method, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        [saleId, profile.clinicId, register.id, total, data.method, profile.id],
      );
      for (const line of lines) {
        await conn.query(
          "INSERT INTO sale_items (id, sale_id, product_id, item_name, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)",
          [randomUUID(), saleId, line.productId, line.name, line.price, line.quantity],
        );
      }
    });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Stock") || error.message.startsWith("Un producto"))) {
      return { error: error.message };
    }
    throw error;
  }

  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "sale.create", entityType: "cash_register", entityId: register.id });
  revalidatePath("/dashboard/caja");
  return { success: true };
}

/** Cierre: compara el efectivo declarado con el que debería haber según el sistema. */
export async function closeCashRegister(declaredCash: number): Promise<ActionState> {
  const profile = await requireRole([...CASH_ROLES]);
  const declared = z.coerce.number().int().min(0).max(100_000_000).safeParse(declaredCash);
  if (!declared.success) return { error: "Monto declarado inválido." };
  const register = await openRegisterOf(profile.clinicId);
  if (!register) return { error: "No hay caja abierta." };

  const totals = await registerTotals(null, register.id);
  const expectedCash = Number(register.opening_amount) + totals.efectivo;

  await query(
    `UPDATE cash_registers SET status = 'closed', closed_by = ?, closed_at = NOW(6),
            closing_amount_declared = ?, closing_amount_system = ?
      WHERE id = ? AND clinic_id = ? AND status = 'open'`,
    [profile.id, declared.data, expectedCash, register.id, profile.clinicId],
  );
  await audit({ clinicId: profile.clinicId, actorId: profile.id, action: "cash.close", entityType: "cash_register", entityId: register.id });
  revalidatePath("/dashboard/caja");
  return { success: true };
}

export async function createProduct(input: unknown): Promise<ActionState> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error.issues) };
  const profile = await requireRole([...CASH_ROLES]);
  await query("INSERT INTO products (id, clinic_id, name, price, stock) VALUES (?, ?, ?, ?, ?)", [
    randomUUID(),
    profile.clinicId,
    parsed.data.name,
    parsed.data.price,
    parsed.data.stock,
  ]);
  revalidatePath("/dashboard/caja");
  return { success: true };
}

export async function adjustStock(productId: string, delta: number): Promise<ActionState> {
  const profile = await requireRole([...CASH_ROLES]);
  const change = z.coerce.number().int().min(-100_000).max(100_000).safeParse(delta);
  if (!change.success) return { error: "Ajuste inválido." };
  const result = await execute(
    "UPDATE products SET stock = stock + ? WHERE id = ? AND clinic_id = ? AND stock + ? >= 0",
    [change.data, productId, profile.clinicId, change.data],
  );
  if (result.affectedRows === 0) return { error: "El ajuste dejaría el stock en negativo o el producto no existe." };
  revalidatePath("/dashboard/caja");
  return { success: true };
}

