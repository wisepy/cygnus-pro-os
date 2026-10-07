import Link from "next/link";
import { notFound } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";
import { ChevronLeft, Download } from "lucide-react";
import { assertRole, requireProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PatientFormDialog } from "../_components/patient-form-dialog";
import {
  AlertsPanel,
  ConsentPanel,
  DeletePatientPanel,
  PlansPanel,
  SessionsPanel,
} from "./_components/clinical-panels";

type PatientDb = RowDataPacket & {
  id: string;
  full_name: string;
  rut: string | null;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  comuna: string | null;
  referred_by: string | null;
  notes: string | null;
};

function age(birth: string | null) {
  if (!birth) return null;
  const b = new Date(`${birth}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) years--;
  return years;
}

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  assertRole(profile, ["admin", "recepcion", "profesional"]);
  const { id } = await params;
  const clinical = profile.role === "admin" || profile.role === "profesional";

  const patient = await queryOne<PatientDb>(
    `SELECT id, full_name, rut, birth_date, gender, phone, email, address, comuna, referred_by, notes
       FROM patients WHERE id = ? AND clinic_id = ?`,
    [id, profile.clinicId],
  );
  if (!patient) notFound();

  const [appointments, services] = await Promise.all([
    query<RowDataPacket & { id: string; start_at: Date; status: string; service_name: string | null }>(
      `SELECT a.id, a.start_at, a.status, s.name AS service_name
         FROM appointments a LEFT JOIN services s ON s.id = a.service_id
        WHERE a.patient_id = ? AND a.clinic_id = ? ORDER BY a.start_at DESC LIMIT 15`,
      [id, profile.clinicId],
    ),
    clinical
      ? query<RowDataPacket & { id: string; name: string; category_id: string | null; duration_minutes: number }>(
          "SELECT id, name, category_id, duration_minutes FROM services WHERE clinic_id = ? AND active = 1 ORDER BY name",
          [profile.clinicId],
        )
      : Promise.resolve([]),
  ]);

  const clinicalData = clinical
    ? await Promise.all([
        query<RowDataPacket & { id: string; type: string; severity: string; description: string; is_active: number }>(
          "SELECT id, type, severity, description, is_active FROM medical_alerts WHERE patient_id = ? ORDER BY is_active DESC, created_at DESC",
          [id],
        ),
        query<RowDataPacket & { id: string; service_name: string; total_sessions: number; sessions_completed: number; status: string }>(
          `SELECT tp.id, s.name AS service_name, tp.total_sessions, tp.sessions_completed, tp.status
             FROM treatment_plans tp JOIN services s ON s.id = tp.service_id
            WHERE tp.patient_id = ? ORDER BY tp.created_at DESC`,
          [id],
        ),
        query<RowDataPacket & { id: string; session_number: number | null; evolution_notes: string | null; created_at: Date; professional: string }>(
          `SELECT ts.id, ts.session_number, ts.evolution_notes, ts.created_at, p.full_name AS professional
             FROM treatment_sessions ts JOIN profiles p ON p.id = ts.profile_id
            WHERE ts.patient_id = ? ORDER BY ts.created_at DESC LIMIT 40`,
          [id],
        ),
        queryOne<RowDataPacket & { id: string; title: string; body: string; version: number }>(
          "SELECT id, title, body, version FROM consent_forms WHERE clinic_id = ? AND active = 1",
          [profile.clinicId],
        ),
        query<RowDataPacket & { id: string; form_version: number; signer_name: string; signed_at: Date }>(
          "SELECT id, form_version, signer_name, signed_at FROM patient_consents WHERE patient_id = ? ORDER BY signed_at DESC",
          [id],
        ),
      ])
    : null;

  const [alerts, plans, sessions, activeForm, consents] = clinicalData ?? [[], [], [], null, []];

  // Historial para la ficha inteligente: última atención completada por servicio.
  const history = clinical
    ? (
        await query<RowDataPacket & { service_id: string; category_id: string | null; completed_at: Date }>(
          `SELECT a.service_id, s.category_id, MAX(a.start_at) AS completed_at
             FROM appointments a JOIN services s ON s.id = a.service_id
            WHERE a.patient_id = ? AND a.clinic_id = ? AND a.status = 'completed'
            GROUP BY a.service_id, s.category_id`,
          [id, profile.clinicId],
        )
      ).map((row) => ({ serviceId: row.service_id, categoryId: row.category_id, completedAt: row.completed_at }))
    : [];
  const activeAlerts = alerts.filter((a) => a.is_active);
  const years = age(patient.birth_date);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/dashboard/clinica" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-3.5" /> Pacientes
          </Link>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{patient.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {[patient.rut, years !== null ? `${years} años` : null, patient.gender === "F" ? "Femenino" : patient.gender === "M" ? "Masculino" : null]
              .filter(Boolean)
              .join(" · ") || "Sin datos básicos"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinical && (
            <Button variant="outline" nativeButton={false} render={<a href={`/api/patients/${patient.id}/export`} />}>
              <Download />
              Exportar datos (ARCO)
            </Button>
          )}
          <PatientFormDialog
            canSeeNotes={clinical}
            initial={{
              id: patient.id,
              fullName: patient.full_name,
              rut: patient.rut ?? "",
              birthDate: patient.birth_date ?? "",
              gender: (patient.gender as "F" | "M" | null) ?? "",
              phone: patient.phone ?? "",
              email: patient.email ?? "",
              address: patient.address ?? "",
              comuna: patient.comuna ?? "",
              referredBy: patient.referred_by ?? "",
              notes: patient.notes ?? "",
            }}
            trigger={<Button variant="outline">Editar datos</Button>}
          />
        </div>
      </div>

      {clinical && activeAlerts.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm font-semibold text-destructive">Alertas médicas activas</p>
          <ul className="list-disc pl-5 text-sm text-foreground">
            {activeAlerts.map((a) => (
              <li key={a.id}>
                <Badge variant="destructive" className="mr-1">{a.type}</Badge>
                {a.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {clinical && (
            <>
              <PlansPanel
                patientId={patient.id}
                services={services}
                plans={plans}
                catalog={services.map((s) => ({ id: s.id, name: s.name, categoryId: s.category_id, durationMinutes: s.duration_minutes }))}
                history={history}
                alerts={alerts.map((a) => ({ type: a.type, severity: a.severity, description: a.description, isActive: !!a.is_active }))}
              />
              <SessionsPanel patientId={patient.id} plans={plans} sessions={sessions} />
            </>
          )}

          <Card className="p-5">
            <h2 className="font-heading text-lg font-medium text-foreground">Citas recientes</h2>
            {appointments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aún no tiene citas.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{new Date(a.start_at).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" })}</span>
                    <span className="text-muted-foreground">{a.service_name ?? "—"}</span>
                    <Badge variant="secondary">{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {clinical && (
            <>
              <AlertsPanel patientId={patient.id} alerts={alerts} />
              <ConsentPanel patientId={patient.id} activeForm={activeForm} consents={consents} isAdmin={profile.role === "admin"} />
            </>
          )}

          {clinical && patient.notes && (
            <Card className="p-5">
              <h2 className="font-heading text-lg font-medium text-foreground">Notas</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{patient.notes}</p>
            </Card>
          )}

          {profile.role === "admin" && <DeletePatientPanel patientId={patient.id} />}

          <Card className="p-5 text-sm">
            <h2 className="font-heading text-lg font-medium text-foreground">Contacto</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>{patient.phone ?? "—"}</dd>
              <dt className="text-muted-foreground">Correo</dt>
              <dd className="truncate">{patient.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Comuna</dt>
              <dd>{patient.comuna ?? "—"}</dd>
              <dt className="text-muted-foreground">Dirección</dt>
              <dd>{patient.address ?? "—"}</dd>
              <dt className="text-muted-foreground">Referida por</dt>
              <dd>{patient.referred_by ?? "—"}</dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
