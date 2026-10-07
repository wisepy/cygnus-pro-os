import Link from "next/link";
import type { RowDataPacket } from "mysql2/promise";
import { requireProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { dayBounds, formatClinicTime, todayInClinic } from "@/lib/dates";
import { formatCLP } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21;

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Santiago" }).format(new Date()));
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

type Count = RowDataPacket & { total: number };
type Sum = RowDataPacket & { total: number | null };
type Booked = RowDataPacket & { minutes: number };
type Next = RowDataPacket & { id: string; start_at: Date; end_at: Date; status: string; app_type: string; patient_name: string | null; block_reason: string | null; service_name: string | null; professional: string };

export default async function HoyPage() {
  const profile = await requireProfile();
  const { start, end } = dayBounds(todayInClinic());
  const canSeeFinance = profile.role === "admin" || profile.role === "caja";
  const canSeeAgenda = profile.role !== "caja";

  const [citasHoy, pacientesTotales, ingresosHoy, oportunidadesActivas, booked, bookable, next] = await Promise.all([
    canSeeAgenda
      ? queryOne<Count>(
          "SELECT COUNT(*) AS total FROM appointments WHERE clinic_id = ? AND app_type = 'appointment' AND status NOT IN ('cancelled','no_show') AND start_at >= ? AND start_at < ?",
          [profile.clinicId, start, end],
        )
      : Promise.resolve(null),
    queryOne<Count>("SELECT COUNT(*) AS total FROM patients WHERE clinic_id = ?", [profile.clinicId]),
    canSeeFinance
      ? queryOne<Sum>(
          "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE clinic_id = ? AND status = 'completed' AND created_at >= ? AND created_at < ?",
          [profile.clinicId, start, end],
        )
      : Promise.resolve(null),
    profile.role === "admin" || profile.role === "profesional"
      ? queryOne<Count>("SELECT COUNT(*) AS total FROM opportunities WHERE clinic_id = ? AND status = 'pending'", [profile.clinicId])
      : Promise.resolve(null),
    canSeeAgenda
      ? queryOne<Booked>(
          "SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, start_at, end_at)), 0) AS minutes FROM appointments WHERE clinic_id = ? AND status NOT IN ('cancelled','no_show') AND start_at >= ? AND start_at < ?",
          [profile.clinicId, start, end],
        )
      : Promise.resolve(null),
    queryOne<Count>("SELECT COUNT(*) AS total FROM profiles WHERE clinic_id = ? AND is_bookable = 1 AND active = 1", [profile.clinicId]),
    canSeeAgenda
      ? query<Next>(
          `SELECT a.id, a.start_at, a.end_at, a.status, a.app_type, p.full_name AS patient_name, a.block_reason,
                  s.name AS service_name, pr.full_name AS professional
             FROM appointments a
             LEFT JOIN patients p ON p.id = a.patient_id
             LEFT JOIN services s ON s.id = a.service_id
             JOIN profiles pr ON pr.id = a.profile_id
            WHERE a.clinic_id = ? AND a.start_at >= ? AND a.start_at < ? AND a.status NOT IN ('cancelled','no_show')
              AND a.start_at >= NOW(6)
            ORDER BY a.start_at LIMIT 6`,
          [profile.clinicId, start, end],
        )
      : Promise.resolve([] as Next[]),
  ]);

  const capacity = Number(bookable?.total ?? 0) * (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const occupancy = capacity ? Math.min(100, Math.round((Number(booked?.minutes ?? 0) / capacity) * 100)) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {greeting()}, {profile.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">Así va la clínica hoy.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canSeeFinance && (
          <KpiCard label="Ingresos hoy" value={Number(ingresosHoy?.total ?? 0)} prefix="$" icon="dollar" accent="success" live hint="Pagos de hoy" />
        )}
        {canSeeAgenda && (
          <>
            <KpiCard label="Citas hoy" value={citasHoy?.total ?? 0} icon="calendar-check" accent="primary" live hint="Sin contar bloqueos" />
            <KpiCard label="Ocupación de hoy" value={occupancy} suffix="%" icon="calendar-check" accent="info" hint={`${bookable?.total ?? 0} profesionales agendables`} />
          </>
        )}
        {(profile.role === "admin" || profile.role === "recepcion") && (
          <KpiCard label="Pacientes" value={pacientesTotales?.total ?? 0} icon="users" accent="info" hint="Total en la base" />
        )}
        {oportunidadesActivas && (
          <KpiCard label="Oportunidades" value={oportunidadesActivas.total} icon="trending-up" accent="warning" hint="Pendientes de contacto" />
        )}
      </div>

      {canSeeAgenda && (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-medium">Próximas citas de hoy</h2>
            <Link href="/dashboard/agenda" className="text-sm text-primary hover:underline">Ver agenda</Link>
          </div>
          {next.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quedan citas por atender hoy.</p>
          ) : (
            <ul className="divide-y divide-border">
              {next.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {formatClinicTime(a.start_at)}–{formatClinicTime(a.end_at)} · {a.app_type === "block" ? a.block_reason ?? "Bloqueado" : a.patient_name ?? "Sin paciente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.professional}{a.service_name ? ` · ${a.service_name}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">{a.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {profile.role === "caja" && (
        <p className="text-sm text-muted-foreground">Ingresos y cobros de hoy están en Caja. Total de hoy: {formatCLP(Number(ingresosHoy?.total ?? 0))}.</p>
      )}
    </div>
  );
}
