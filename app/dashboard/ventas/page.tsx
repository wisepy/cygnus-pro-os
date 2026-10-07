import Link from "next/link";
import type { RowDataPacket } from "mysql2/promise";
import { TrendingUp } from "lucide-react";
import { assertRole, requireProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { OpportunityActions, GenerateButton } from "./_components/opportunity-actions";

const TYPE_LABEL = { cross_sell: "Venta cruzada", retention: "Retención", follow_up: "Seguimiento" } as const;
const STATUS_LABEL = { pending: "Pendientes", contacted: "Contactadas", converted: "Agendadas", dismissed: "Descartadas" } as const;

type OppDb = RowDataPacket & {
  id: string;
  type: keyof typeof TYPE_LABEL;
  status: keyof typeof STATUS_LABEL;
  reason: string;
  created_at: Date;
  patient_id: string;
  patient_name: string;
  service_name: string | null;
};

export default async function VentasPage() {
  const profile = await requireProfile();
  assertRole(profile, ["admin", "profesional"]);
  const isAdmin = profile.role === "admin";

  const rows = await query<OppDb>(
    `SELECT o.id, o.type, o.status, o.reason, o.created_at, o.patient_id, p.full_name AS patient_name, s.name AS service_name
       FROM opportunities o
       JOIN patients p ON p.id = o.patient_id
       LEFT JOIN services s ON s.id = o.suggested_service_id
      WHERE o.clinic_id = ?
      ORDER BY o.created_at DESC
      LIMIT 300`,
    [profile.clinicId],
  );

  const columns = Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Oportunidades calculadas con reglas de historial: retención, seguimiento y venta cruzada.
        </p>
        {isAdmin && <GenerateButton />}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin oportunidades todavía"
          description={isAdmin ? "Usa Generar oportunidades para revisar el historial de las pacientes." : "Dirección aún no ha generado oportunidades."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {columns.map((status) => {
            const items = rows.filter((r) => r.status === status);
            return (
              <div key={status} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-base font-medium">{STATUS_LABEL[status]}</h2>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                {items.map((o) => (
                  <Card key={o.id} className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/dashboard/clinica/${o.patient_id}`} className="truncate font-medium hover:underline">
                        {o.patient_name}
                      </Link>
                      <Badge variant="outline">{TYPE_LABEL[o.type]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{o.reason}</p>
                    {o.service_name && <p className="text-xs">Sugerido: <span className="font-medium">{o.service_name}</span></p>}
                    {isAdmin && o.status === "pending" && <OpportunityActions id={o.id} />}
                  </Card>
                ))}
                {items.length === 0 && <p className="text-xs text-muted-foreground">Nada aquí.</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
