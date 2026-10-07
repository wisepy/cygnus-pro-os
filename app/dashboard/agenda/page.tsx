import Link from "next/link";
import type { RowDataPacket } from "mysql2/promise";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { assertRole, requireProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { CLINIC_TZ, dayBounds, formatClinicDate, formatClinicTime, todayInClinic } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { AgendaBoard, type AgendaAppointment, type AgendaProfessional } from "./_components/agenda-board";

type ProfileDb = RowDataPacket & { id: string; full_name: string; color_hex: string; specialty: string | null };
type ResourceDb = RowDataPacket & { id: string; name: string; kind: "box" | "machine" };
type ServiceDb = RowDataPacket & { id: string; name: string; duration_minutes: number };
type AppointmentDb = RowDataPacket & {
  id: string;
  profile_id: string;
  patient_id: string | null;
  patient_name: string | null;
  service_name: string | null;
  resource_name: string | null;
  app_type: "appointment" | "block";
  block_reason: string | null;
  start_at: Date;
  end_at: Date;
  status: AgendaAppointment["status"];
};

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const profile = await requireProfile();
  assertRole(profile, ["admin", "recepcion", "profesional"]);

  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayInClinic();
  const { start, end } = dayBounds(date);

  const [professionals, resources, services, appointments] = await Promise.all([
    query<ProfileDb>(
      "SELECT id, full_name, color_hex, specialty FROM profiles WHERE clinic_id = ? AND is_bookable = 1 AND active = 1 ORDER BY full_name",
      [profile.clinicId],
    ),
    query<ResourceDb>("SELECT id, name, kind FROM resources WHERE clinic_id = ? AND active = 1 ORDER BY name", [profile.clinicId]),
    query<ServiceDb>("SELECT id, name, duration_minutes FROM services WHERE clinic_id = ? AND active = 1 ORDER BY name", [profile.clinicId]),
    query<AppointmentDb>(
      `SELECT a.id, a.profile_id, a.patient_id, p.full_name AS patient_name, s.name AS service_name,
              r.name AS resource_name, a.app_type, a.block_reason, a.start_at, a.end_at, a.status
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN services s ON s.id = a.service_id
         LEFT JOIN resources r ON r.id = a.resource_id
        WHERE a.clinic_id = ? AND a.start_at >= ? AND a.start_at < ?
        ORDER BY a.start_at`,
      [profile.clinicId, start, end],
    ),
  ]);

  const board: AgendaAppointment[] = appointments.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    patientId: row.patient_id,
    title: row.app_type === "block" ? row.block_reason ?? "Bloqueado" : row.patient_name ?? "Sin paciente",
    service: row.service_name,
    resource: row.resource_name,
    type: row.app_type,
    status: row.status,
    startLocal: formatClinicTime(row.start_at),
    endLocal: formatClinicTime(row.end_at),
  }));

  const canManage = profile.role === "admin" || profile.role === "recepcion";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Agenda</h1>
          <p className="text-sm capitalize text-muted-foreground">
            {formatClinicDate(start)} · zona {CLINIC_TZ}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={`/dashboard/agenda?date=${addDays(date, -1)}`} aria-label="Día anterior" />}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard/agenda?date=${todayInClinic()}`} />}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={`/dashboard/agenda?date=${addDays(date, 1)}`} aria-label="Día siguiente" />}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      {professionals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay profesionales agendables. Márcalos como agendables en Configuración → Usuarios.
        </p>
      ) : (
        <AgendaBoard
          date={date}
          canManage={canManage}
          professionals={professionals.map<AgendaProfessional>((p) => ({
            id: p.id,
            name: p.full_name,
            colorHex: p.color_hex,
            specialty: p.specialty,
          }))}
          resources={resources.map((r) => ({ id: r.id, name: r.name, kind: r.kind }))}
          services={services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.duration_minutes }))}
          appointments={board}
        />
      )}
    </div>
  );
}
