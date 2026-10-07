import type { RowDataPacket } from "mysql2/promise";
import { Cpu, BedDouble } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ResourceForm, ResourceToggle } from "./_components/resource-forms";

type ResourceDb = RowDataPacket & { id: string; name: string; kind: "box" | "machine"; active: number };

export default async function RecursosPage() {
  const profile = await requireProfile();
  const rows = await query<ResourceDb>(
    "SELECT id, name, kind, active FROM resources WHERE clinic_id = ? ORDER BY kind, name",
    [profile.clinicId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cabinas y máquinas que se reservan junto con el profesional, por ejemplo el láser o el HIFU.
        </p>
        <ResourceForm />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="Aún no hay cabinas ni máquinas"
          description="Agrégalas para que la agenda evite reservar dos tratamientos en el mismo equipo."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {r.kind === "machine" ? <Cpu className="size-4 text-muted-foreground" /> : <BedDouble className="size-4 text-muted-foreground" />}
                  <p className="font-medium">{r.name}</p>
                </div>
                <Badge variant={r.active ? "secondary" : "outline"}>{r.active ? (r.kind === "machine" ? "Máquina" : "Cabina") : "Inactiva"}</Badge>
              </div>
              <ResourceToggle id={r.id} active={!!r.active} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
