import type { RowDataPacket } from "mysql2/promise";
import { requireProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCLP, formatDuration } from "@/lib/format";
import { Sparkles } from "lucide-react";
import type { ServiceWithCategory, ServiceZonePriceRow } from "@/types/domain";
import { CreateCategoryDialog } from "./_components/create-category-dialog";
import { ServiceFormDialog } from "./_components/service-form-dialog";

type CategoryDbRow = RowDataPacket & { id: string; name: string };
type ServiceDbRow = RowDataPacket & {
  id: string;
  clinic_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  duration_minutes: number;
  base_price: number;
  is_package: number;
  package_sessions_count: number | null;
  pricing_type: "fixed" | "by_zone";
  active: number;
  created_at: Date;
};
type ZoneDbRow = RowDataPacket & ServiceZonePriceRow;

export default async function ServiciosPage() {
  const profile = await requireProfile();

  const [categoryRows, serviceRows, zoneRows] = await Promise.all([
    query<CategoryDbRow>(
      "SELECT id, name FROM service_categories WHERE clinic_id = ? ORDER BY sort_order, name",
      [profile.clinicId],
    ),
    query<ServiceDbRow>("SELECT * FROM services WHERE clinic_id = ? ORDER BY name", [profile.clinicId]),
    query<ZoneDbRow>(
      `SELECT z.* FROM service_zone_prices z
         JOIN services s ON s.id = z.service_id
        WHERE s.clinic_id = ?
        ORDER BY z.sort_order`,
      [profile.clinicId],
    ),
  ]);

  const categoryList = categoryRows;
  const categoryNames = new Map(categoryRows.map((c) => [c.id, c.name]));
  const serviceList: ServiceWithCategory[] = serviceRows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    duration_minutes: row.duration_minutes,
    base_price: row.base_price,
    is_package: Boolean(row.is_package),
    package_sessions_count: row.package_sessions_count,
    pricing_type: row.pricing_type,
    active: Boolean(row.active),
    created_at: row.created_at,
    service_categories: row.category_id
      ? { id: row.category_id, name: categoryNames.get(row.category_id) ?? "" }
      : null,
    service_zone_prices: zoneRows.filter((z) => z.service_id === row.id),
  }));

  const grouped = categoryList.map((category) => ({
    category,
    services: serviceList.filter((service) => service.category_id === category.id),
  }));
  const uncategorized = serviceList.filter((service) => !service.category_id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {serviceList.length} servicio{serviceList.length === 1 ? "" : "s"} en {categoryList.length} categoría
          {categoryList.length === 1 ? "" : "s"}.
        </p>
        <div className="flex gap-2">
          <CreateCategoryDialog />
          <ServiceFormDialog categories={categoryList} />
        </div>
      </div>

      {serviceList.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Aún no hay servicios"
          description="Agrega el catálogo de tratamientos para empezar a agendar citas."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {grouped
            .filter((group) => group.services.length > 0)
            .map((group) => (
              <ServiceGroup key={group.category.id} title={group.category.name} services={group.services} categories={categoryList} />
            ))}
          {uncategorized.length > 0 && (
            <ServiceGroup title="Sin categoría" services={uncategorized} categories={categoryList} />
          )}
        </div>
      )}
    </div>
  );
}

function ServiceGroup({
  title,
  services,
  categories,
}: {
  title: string;
  services: ServiceWithCategory[];
  categories: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-medium text-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-foreground">{service.name}</p>
              {!service.active && <Badge variant="secondary">Inactivo</Badge>}
            </div>
            {service.description && <p className="text-xs text-muted-foreground">{service.description}</p>}

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{formatDuration(service.duration_minutes)}</Badge>
              {service.is_package && (
                <Badge variant="secondary">Pack {service.package_sessions_count} sesiones</Badge>
              )}
            </div>

            {service.pricing_type === "fixed" ? (
              <p className="font-heading text-xl font-semibold text-foreground">{formatCLP(service.base_price)}</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {service.service_zone_prices
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((zone) => (
                    <div key={zone.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{zone.zone_name}</span>
                      <span className="font-medium text-foreground">{formatCLP(zone.price)}</span>
                    </div>
                  ))}
              </div>
            )}

            <ServiceFormDialog categories={categories} service={service} />
          </div>
        ))}
      </div>
    </div>
  );
}
