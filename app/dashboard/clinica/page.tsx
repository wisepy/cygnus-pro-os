import Link from "next/link";
import type { RowDataPacket } from "mysql2/promise";
import { Stethoscope, Search } from "lucide-react";
import { requireProfile, assertRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PatientFormDialog } from "./_components/patient-form-dialog";

type PatientRowDb = RowDataPacket & {
  id: string;
  full_name: string;
  rut: string | null;
  phone: string | null;
  comuna: string | null;
  alerts: number;
  last_visit: Date | null;
};

export default async function ClinicaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await requireProfile();
  assertRole(profile, ["admin", "recepcion", "profesional"]);
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 80);
  const canSeeClinical = profile.role === "admin" || profile.role === "profesional";

  const patients = await query<PatientRowDb>(
    `SELECT p.id, p.full_name, p.rut, p.phone, p.comuna,
            (SELECT COUNT(*) FROM medical_alerts m WHERE m.patient_id = p.id AND m.is_active = 1) AS alerts,
            (SELECT MAX(a.start_at) FROM appointments a WHERE a.patient_id = p.id AND a.status = 'completed') AS last_visit
       FROM patients p
      WHERE p.clinic_id = ? AND (? = '' OR p.full_name LIKE ? OR p.rut LIKE ?)
      ORDER BY p.full_name
      LIMIT 200`,
    [profile.clinicId, term, `%${term}%`, `%${term}%`],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/dashboard/clinica" className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={term} placeholder="Buscar por nombre o RUT" className="pl-9" />
        </form>
        <PatientFormDialog />
      </div>

      {patients.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={term ? "Sin resultados" : "Aún no hay pacientes"}
          description={term ? "Prueba con otro nombre o RUT." : "Registra la primera paciente para empezar su ficha."}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <ul className="divide-y divide-border">
            {patients.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/clinica/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{p.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.rut, p.phone, p.comuna].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canSeeClinical && Number(p.alerts) > 0 && <Badge variant="destructive">{p.alerts} alerta{Number(p.alerts) === 1 ? "" : "s"}</Badge>}
                    {p.last_visit && (
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        Última visita {new Date(p.last_visit).toLocaleDateString("es-CL")}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
