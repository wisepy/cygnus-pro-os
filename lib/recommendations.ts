/**
 * Ficha inteligente: a partir del tratamiento elegido y del historial de la paciente,
 * propone pasos. Es una función pura (sin base de datos) para poder usarla en el
 * servidor y en el formulario. Las reglas son explícitas y auditables: cada
 * recomendación indica su motivo.
 */

export type CatalogService = { id: string; name: string; categoryId: string | null; durationMinutes: number };

export type HistoryEntry = {
  serviceId: string;
  categoryId: string | null;
  completedAt: Date | null; // última atención completada de ese servicio
};

export type AlertInfo = { type: string; severity: string; description: string; isActive: boolean };

export type Recommendation = {
  kind: "warning" | "cross_sell" | "follow_up" | "maintenance";
  title: string;
  reason: string;
  serviceId?: string;
};

const DAY = 24 * 60 * 60 * 1000;

export function recommend(input: {
  selected: CatalogService;
  catalog: CatalogService[];
  history: HistoryEntry[];
  alerts: AlertInfo[];
  now?: Date;
}): Recommendation[] {
  const now = input.now ?? new Date();
  const out: Recommendation[] = [];

  // 1. Seguridad primero: alertas activas que conviene revisar antes de aplicar el tratamiento.
  for (const alert of input.alerts.filter((a) => a.isActive && (a.severity === "high" || a.type === "contraindication" || a.type === "allergy"))) {
    out.push({
      kind: "warning",
      title: `Revisar antes de aplicar ${input.selected.name}`,
      reason: `Alerta activa: ${alert.description}`,
    });
  }

  // 2. Seguimiento: la paciente ya recibió este servicio hace 3 a 16 semanas.
  const last = input.history.filter((h) => h.serviceId === input.selected.id && h.completedAt).sort((a, b) => (b.completedAt!.getTime() - a.completedAt!.getTime()))[0];
  if (last?.completedAt) {
    const days = Math.floor((now.getTime() - last.completedAt.getTime()) / DAY);
    if (days >= 21 && days <= 112) {
      out.push({
        kind: "follow_up",
        title: `Sesión de mantención de ${input.selected.name}`,
        reason: `La última vez fue hace ${days} días. Es el momento habitual de retomar.`,
        serviceId: input.selected.id,
      });
    }
  }

  // 3. Venta cruzada: tiene historial en otra categoría, pero nada en la del tratamiento elegido.
  const selectedCategory = input.selected.categoryId;
  if (selectedCategory) {
    const categoriesWithHistory = new Set(input.history.map((h) => h.categoryId).filter(Boolean) as string[]);
    const hasSelectedCategory = categoriesWithHistory.has(selectedCategory);
    if (!hasSelectedCategory && categoriesWithHistory.size > 0) {
      const candidate = input.catalog.find((s) => s.categoryId === selectedCategory && s.id !== input.selected.id);
      if (candidate) {
        out.push({
          kind: "cross_sell",
          title: `Complemento sugerido: ${candidate.name}`,
          reason: "Su historial está en otras áreas; este servicio complementa el plan.",
          serviceId: candidate.id,
        });
      }
    }
  }

  return out;
}
