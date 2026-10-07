import type { RowDataPacket } from "mysql2/promise";
import { assertRole, requireProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { computeCommissions } from "@/lib/commissions";
import { formatCLP } from "@/lib/format";
import { CLINIC_TZ } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { RateForm } from "./_components/rate-form";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

function monthBounds(ym: string) {
  const start = fromZonedTime(`${ym}-01 00:00:00`, CLINIC_TZ);
  const [y, m] = ym.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1)); // primer día del mes siguiente (UTC) para el cálculo de fin
  const end = fromZonedTime(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01 00:00:00`, CLINIC_TZ);
  return { start, end };
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const profile = await requireProfile();
  assertRole(profile, ["admin"]);
  const params = await searchParams;
  const ym = params.m && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.m) ? params.m : formatInTimeZone(new Date(), CLINIC_TZ, "yyyy-MM");
  const { start, end } = monthBounds(ym);

  const [professionals, payments, rates, services] = await Promise.all([
    query<RowDataPacket & { id: string; full_name: string; color_hex: string }>(
      "SELECT id, full_name, color_hex FROM profiles WHERE clinic_id = ? AND is_bookable = 1 AND active = 1 ORDER BY full_name",
      [profile.clinicId],
    ),
    query<RowDataPacket & { profile_id: string; service_id: string | null; amount: number; paid_at: Date }>(
      `SELECT a.profile_id, a.service_id, py.amount, py.created_at AS paid_at
         FROM payments py JOIN appointments a ON a.id = py.appointment_id
        WHERE py.clinic_id = ? AND py.status = 'completed' AND py.created_at >= ? AND py.created_at < ?`,
      [profile.clinicId, start, end],
    ),
    query<RowDataPacket & { profile_id: string; service_id: string | null; rate_type: "percentage" | "fixed"; rate_value: number; effective_from: string }>(
      "SELECT profile_id, service_id, rate_type, rate_value, effective_from FROM commission_rates WHERE clinic_id = ? ORDER BY effective_from DESC",
      [profile.clinicId],
    ),
    query<RowDataPacket & { id: string; name: string }>("SELECT id, name FROM services WHERE clinic_id = ? AND active = 1 ORDER BY name", [profile.clinicId]),
  ]);

  const summary = computeCommissions(
    payments.map((p) => ({ profileId: p.profile_id, serviceId: p.service_id, amount: Number(p.amount), paidAt: new Date(p.paid_at) })),
    rates.map((r) => ({
      profileId: r.profile_id,
      serviceId: r.service_id,
      rateType: r.rate_type,
      rateValue: Number(r.rate_value),
      effectiveFrom: fromZonedTime(`${String(r.effective_from).slice(0, 10)} 00:00:00`, CLINIC_TZ),
    })),
  );
  const nameOf = new Map(professionals.map((p) => [p.id, p.full_name]));
  const totalCommission = summary.reduce((s, r) => s + r.commission, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Comisiones</h1>
          <p className="text-sm text-muted-foreground">Calculadas desde los pagos reales de cada mes.</p>
        </div>
        <form className="flex items-center gap-2">
          <input type="month" name="m" defaultValue={ym} className="rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">Ver</button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Comisiones del mes</p>
          <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{formatCLP(totalCommission)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Ingresos atendidos</p>
          <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">
            {formatCLP(summary.reduce((s, r) => s + r.revenue, 0))}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Profesional</th>
              <th className="px-4 py-2 text-right">Citas pagadas</th>
              <th className="px-4 py-2 text-right">Ingresos</th>
              <th className="px-4 py-2 text-right">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Sin pagos atendidos en este mes.</td>
              </tr>
            )}
            {summary.map((row) => (
              <tr key={row.profileId} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{nameOf.get(row.profileId) ?? "Profesional eliminada"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.paidAppointments}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCLP(row.revenue)}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{formatCLP(row.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <RateForm professionals={professionals.map((p) => ({ id: p.id, name: p.full_name }))} services={services} />
    </div>
  );
}
