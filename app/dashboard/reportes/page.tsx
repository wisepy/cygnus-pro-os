import type { RowDataPacket } from "mysql2/promise";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { assertRole, requireProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { CLINIC_TZ, todayInClinic } from "@/lib/dates";
import { formatCLP } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { RevenueChart } from "./_components/revenue-chart";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21;

function rangeBounds(from: string, to: string) {
  const start = fromZonedTime(`${from} 00:00:00`, CLINIC_TZ);
  const endDay = new Date(`${to}T12:00:00Z`);
  endDay.setUTCDate(endDay.getUTCDate() + 1);
  const end = fromZonedTime(`${endDay.toISOString().slice(0, 10)} 00:00:00`, CLINIC_TZ);
  return { start, end };
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
}

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const profile = await requireProfile();
  assertRole(profile, ["admin"]);
  const params = await searchParams;
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const to = valid(params.to) ?? todayInClinic();
  const from = valid(params.from) ?? formatInTimeZone(new Date(new Date(`${to}T12:00:00Z`).getTime() - 29 * 86_400_000), CLINIC_TZ, "yyyy-MM-dd");
  const { start, end } = rangeBounds(from, to);
  const days = Math.max(1, daysBetween(from, to));

  const [paymentsDaily, salesDaily, methods, services, appt, bookable, topProducts] = await Promise.all([
    query<RowDataPacket & { created_at: Date; total: number }>(
      `SELECT created_at, amount AS total FROM payments WHERE clinic_id = ? AND status = 'completed' AND created_at >= ? AND created_at < ?`,
      [profile.clinicId, start, end],
    ),
    query<RowDataPacket & { created_at: Date; total: number }>(
      `SELECT created_at, total FROM sales WHERE clinic_id = ? AND created_at >= ? AND created_at < ?`,
      [profile.clinicId, start, end],
    ),
    query<RowDataPacket & { method: string; total: number; n: number }>(
      `SELECT method, SUM(amount) AS total, COUNT(*) AS n FROM payments
        WHERE clinic_id = ? AND status = 'completed' AND created_at >= ? AND created_at < ? GROUP BY method`,
      [profile.clinicId, start, end],
    ),
    query<RowDataPacket & { name: string; n: number; total: number }>(
      `SELECT s.name, COUNT(*) AS n, SUM(py.amount) AS total
         FROM payments py JOIN appointments a ON a.id = py.appointment_id JOIN services s ON s.id = a.service_id
        WHERE py.clinic_id = ? AND py.status = 'completed' AND py.created_at >= ? AND py.created_at < ?
        GROUP BY s.id, s.name ORDER BY total DESC LIMIT 8`,
      [profile.clinicId, start, end],
    ),
    queryOne<RowDataPacket & { completed: number; booked_minutes: number }>(
      `SELECT SUM(status = 'completed' AND app_type = 'appointment') AS completed,
              COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','no_show') THEN TIMESTAMPDIFF(MINUTE, start_at, end_at) ELSE 0 END), 0) AS booked_minutes
         FROM appointments WHERE clinic_id = ? AND start_at >= ? AND start_at < ?`,
      [profile.clinicId, start, end],
    ),
    queryOne<RowDataPacket & { n: number }>(
      "SELECT COUNT(*) AS n FROM profiles WHERE clinic_id = ? AND is_bookable = 1 AND active = 1",
      [profile.clinicId],
    ),
    query<RowDataPacket & { name: string; qty: number; total: number }>(
      `SELECT si.item_name AS name, SUM(si.quantity) AS qty, SUM(si.unit_price * si.quantity) AS total
         FROM sale_items si JOIN sales sa ON sa.id = si.sale_id
        WHERE sa.clinic_id = ? AND sa.created_at >= ? AND sa.created_at < ? GROUP BY si.item_name ORDER BY total DESC LIMIT 5`,
      [profile.clinicId, start, end],
    ),
  ]);

  // Ingresos por día (servicios + productos) para el gráfico.
  const perDay = new Map<string, number>();
  const bucket = (r: { created_at: Date; total: number }) => {
    const key = formatInTimeZone(new Date(r.created_at), CLINIC_TZ, "yyyy-MM-dd");
    perDay.set(key, (perDay.get(key) ?? 0) + Number(r.total));
  };
  paymentsDaily.forEach(bucket);
  salesDaily.forEach(bucket);
  const series: { day: string; ingresos: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    series.push({ day: key.slice(5), ingresos: perDay.get(key) ?? 0 });
  }

  const revenue = series.reduce((s, r) => s + r.ingresos, 0);
  const productRevenue = salesDaily.reduce((s, r) => s + Number(r.total), 0);
  const paidCount = methods.reduce((s, m) => s + Number(m.n), 0);
  const ticket = paidCount ? Math.round(methods.reduce((s, m) => s + Number(m.total), 0) / paidCount) : 0;
  const capacityMinutes = Number(bookable?.n ?? 0) * (DAY_END_HOUR - DAY_START_HOUR) * 60 * days;
  const occupancy = capacityMinutes ? Math.min(100, Math.round((Number(appt?.booked_minutes ?? 0) / capacityMinutes) * 100)) : 0;
  const methodLabel: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito", credito: "Crédito" };

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Desde
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm text-foreground" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Hasta
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm text-foreground" />
        </label>
        <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">Aplicar</button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Ingresos del periodo</p>
          <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{formatCLP(revenue)}</p>
          <p className="text-xs text-muted-foreground">Productos: {formatCLP(productRevenue)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Ocupación</p>
          <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{occupancy}%</p>
          <p className="text-xs text-muted-foreground">Sobre {bookable?.n ?? 0} profesionales, 08:00 a 21:00</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Atenciones completadas</p>
          <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{Number(appt?.completed ?? 0)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Ticket promedio</p>
          <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{formatCLP(ticket)}</p>
          <p className="text-xs text-muted-foreground">Por pago de servicio</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-heading text-lg font-medium">Ingresos por día</h2>
        <RevenueChart data={series} />
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-heading text-lg font-medium">Servicios más vendidos</h2>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cobros en el periodo.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {services.map((s) => (
                <li key={s.name} className="flex justify-between py-2">
                  <span>{s.name} <span className="text-muted-foreground">· {Number(s.n)}×</span></span>
                  <span className="tabular-nums">{formatCLP(Number(s.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-heading text-lg font-medium">Medios de pago</h2>
          {methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pagos en el periodo.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {methods.map((m) => (
                <li key={m.method} className="flex justify-between py-2">
                  <span>{methodLabel[m.method] ?? m.method}</span>
                  <span className="tabular-nums">{formatCLP(Number(m.total))}</span>
                </li>
              ))}
            </ul>
          )}
          {topProducts.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 font-medium">Productos</h3>
              <ul className="divide-y divide-border text-sm">
                {topProducts.map((p) => (
                  <li key={p.name} className="flex justify-between py-2">
                    <span>{p.name} <span className="text-muted-foreground">· {Number(p.qty)} u.</span></span>
                    <span className="tabular-nums">{formatCLP(Number(p.total))}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
