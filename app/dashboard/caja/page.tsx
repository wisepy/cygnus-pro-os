import type { RowDataPacket } from "mysql2/promise";
import { assertRole, requireProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { dayBounds, formatClinicShortDate, formatClinicTime, todayInClinic } from "@/lib/dates";
import { formatCLP } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { CashPanel } from "./_components/cash-panel";

type RegisterDb = RowDataPacket & { id: string; opening_amount: number; opened_at: Date };
type PendingDb = RowDataPacket & { id: string; start_at: Date; patient_name: string | null; service_name: string | null; base_price: number; pricing_type: string };
type ProductDb = RowDataPacket & { id: string; name: string; price: number; stock: number };

export default async function CajaPage() {
  const profile = await requireProfile();
  assertRole(profile, ["admin", "caja"]);
  const { start, end } = dayBounds(todayInClinic());

  const register = await queryOne<RegisterDb>(
    "SELECT id, opening_amount, opened_at FROM cash_registers WHERE clinic_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1",
    [profile.clinicId],
  );

  const [pending, products, totalsRows, paymentsToday] = await Promise.all([
    query<PendingDb>(
      // Incluye también citas de días anteriores que quedaron sin cobrar (no solo las de hoy),
      // para poder cobrarle a alguien que vino y no pagó en su momento. Las futuras no se cobran antes de atenderse.
      `SELECT a.id, a.start_at, p.full_name AS patient_name, s.name AS service_name, s.base_price, s.pricing_type
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN services s ON s.id = a.service_id
        WHERE a.clinic_id = ? AND a.app_type = 'appointment' AND a.start_at < ?
          AND a.status NOT IN ('cancelled','no_show')
          AND NOT EXISTS (SELECT 1 FROM payments py WHERE py.appointment_id = a.id AND py.status = 'completed')
        ORDER BY a.start_at ASC
        LIMIT 100`,
      [profile.clinicId, end],
    ),
    query<ProductDb>("SELECT id, name, price, stock FROM products WHERE clinic_id = ? AND active = 1 ORDER BY name", [profile.clinicId]),
    register
      ? query<RowDataPacket & { method: string; total: number }>(
          `SELECT method, SUM(amount) AS total FROM payments WHERE cash_register_id = ? AND status = 'completed' GROUP BY method
           UNION ALL
           SELECT method, SUM(total) AS total FROM sales WHERE cash_register_id = ? GROUP BY method`,
          [register.id, register.id],
        )
      : Promise.resolve([]),
    register
      ? query<RowDataPacket & { id: string; amount: number; method: string; created_at: Date; patient_name: string | null }>(
          `SELECT py.id, py.amount, py.method, py.created_at, p.full_name AS patient_name
             FROM payments py LEFT JOIN patients p ON p.id = py.patient_id
            WHERE py.cash_register_id = ? AND py.status = 'completed' ORDER BY py.created_at DESC LIMIT 50`,
          [register.id],
        )
      : Promise.resolve([]),
  ]);

  const byMethod: Record<string, number> = { efectivo: 0, transferencia: 0, debito: 0, credito: 0 };
  for (const row of totalsRows) byMethod[row.method] = (byMethod[row.method] ?? 0) + Number(row.total ?? 0);
  const cashExpected = register ? Number(register.opening_amount) + byMethod.efectivo : 0;
  const totalSales = Object.values(byMethod).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Total del día</p>
          <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{formatCLP(totalSales)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Efectivo esperado en caja</p>
          <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{register ? formatCLP(cashExpected) : "—"}</p>
          <p className="text-xs text-muted-foreground">Incluye el monto inicial</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Transferencia · Tarjetas</p>
          <p className="mt-2 text-sm tabular-nums">
            {formatCLP(byMethod.transferencia)} · {formatCLP(byMethod.debito + byMethod.credito)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Pendientes de cobro</p>
          <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{pending.length}</p>
          <p className="text-xs text-muted-foreground">De hoy y atrasadas</p>
        </Card>
      </div>

      <CashPanel
        registerOpen={!!register}
        openingAmount={register ? Number(register.opening_amount) : 0}
        expectedCash={cashExpected}
        isAdmin={profile.role === "admin"}
        pending={pending.map((p) => {
          const isToday = p.start_at >= start && p.start_at < end;
          return {
            id: p.id,
            time: isToday ? formatClinicTime(p.start_at) : `${formatClinicShortDate(p.start_at)} ${formatClinicTime(p.start_at)}`,
            patient: p.patient_name ?? "Sin paciente",
            service: p.service_name ?? "—",
            suggestedAmount: p.pricing_type === "fixed" ? Number(p.base_price) : 0,
          };
        })}
        products={products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), stock: Number(p.stock) }))}
        payments={paymentsToday.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          patient: p.patient_name ?? "Sin paciente",
          time: formatClinicTime(p.created_at),
        }))}
      />
    </div>
  );
}
