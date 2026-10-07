/**
 * Cálculo de comisiones por profesional. Función pura: recibe pagos y tasas y devuelve
 * el resumen. Regla: se usa la tasa del servicio si existe (vigente a la fecha del pago);
 * si no, la tasa por defecto de la profesional. Sin tasa, la comisión es 0.
 */

export type PaymentForCommission = {
  profileId: string;
  serviceId: string | null;
  amount: number;
  paidAt: Date;
};

export type RateForCommission = {
  profileId: string;
  serviceId: string | null; // null = tasa por defecto
  rateType: "percentage" | "fixed";
  rateValue: number;
  effectiveFrom: Date;
};

export type CommissionSummary = {
  profileId: string;
  paidAppointments: number;
  revenue: number;
  commission: number;
};

function pickRate(p: PaymentForCommission, rates: RateForCommission[]): RateForCommission | null {
  const vigentes = rates
    .filter((r) => r.profileId === p.profileId && r.effectiveFrom.getTime() <= p.paidAt.getTime())
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return (
    vigentes.find((r) => r.serviceId !== null && r.serviceId === p.serviceId) ??
    vigentes.find((r) => r.serviceId === null) ??
    null
  );
}

export function computeCommissions(payments: PaymentForCommission[], rates: RateForCommission[]): CommissionSummary[] {
  const byProfile = new Map<string, CommissionSummary>();

  for (const p of payments) {
    const row = byProfile.get(p.profileId) ?? { profileId: p.profileId, paidAppointments: 0, revenue: 0, commission: 0 };
    row.paidAppointments += 1;
    row.revenue += p.amount;
    const rate = pickRate(p, rates);
    if (rate) {
      row.commission += rate.rateType === "percentage" ? Math.round((p.amount * rate.rateValue) / 100) : rate.rateValue;
    }
    byProfile.set(p.profileId, row);
  }

  return [...byProfile.values()].sort((a, b) => b.revenue - a.revenue);
}
