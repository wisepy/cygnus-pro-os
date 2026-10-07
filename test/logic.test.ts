import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCommissions } from "../lib/commissions.ts";
import { recommend } from "../lib/recommendations.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-06T12:00:00Z");

test("comisión por porcentaje usa la tasa del servicio antes que la por defecto", () => {
  const rates = [
    { profileId: "ana", serviceId: null, rateType: "percentage" as const, rateValue: 20, effectiveFrom: new Date("2026-01-01") },
    { profileId: "ana", serviceId: "láser", rateType: "percentage" as const, rateValue: 30, effectiveFrom: new Date("2026-01-01") },
  ];
  const payments = [
    { profileId: "ana", serviceId: "láser", amount: 100_000, paidAt: new Date("2026-09-10") },
    { profileId: "ana", serviceId: "facial", amount: 50_000, paidAt: new Date("2026-09-11") },
  ];
  const [row] = computeCommissions(payments, rates);
  assert.equal(row.revenue, 150_000);
  assert.equal(row.paidAppointments, 2);
  assert.equal(row.commission, 30_000 + 10_000);
});

test("una tasa nueva no cambia pagos anteriores a su vigencia", () => {
  const rates = [
    { profileId: "ana", serviceId: null, rateType: "percentage" as const, rateValue: 10, effectiveFrom: new Date("2026-01-01") },
    { profileId: "ana", serviceId: null, rateType: "percentage" as const, rateValue: 40, effectiveFrom: new Date("2026-06-01") },
  ];
  const payments = [
    { profileId: "ana", serviceId: null, amount: 100_000, paidAt: new Date("2026-03-01") },
    { profileId: "ana", serviceId: null, amount: 100_000, paidAt: new Date("2026-07-01") },
  ];
  const [row] = computeCommissions(payments, rates);
  assert.equal(row.commission, 10_000 + 40_000);
});

test("comisión fija por cita y sin tasa da cero", () => {
  const rates = [{ profileId: "ana", serviceId: null, rateType: "fixed" as const, rateValue: 5_000, effectiveFrom: new Date("2026-01-01") }];
  const payments = [
    { profileId: "ana", serviceId: null, amount: 80_000, paidAt: new Date("2026-02-01") },
    { profileId: "beto", serviceId: null, amount: 80_000, paidAt: new Date("2026-02-01") },
  ];
  const result = computeCommissions(payments, rates);
  assert.equal(result.find((r) => r.profileId === "ana")?.commission, 5_000);
  assert.equal(result.find((r) => r.profileId === "beto")?.commission, 0);
});

test("ficha inteligente: alerta activa aparece como advertencia antes del tratamiento", () => {
  const out = recommend({
    selected: { id: "laser", name: "Depilación axila", categoryId: "depi", durationMinutes: 45 },
    catalog: [{ id: "laser", name: "Depilación axila", categoryId: "depi", durationMinutes: 45 }],
    history: [],
    alerts: [{ type: "contraindication", severity: "high", description: "Isotretinoína en los últimos 6 meses", isActive: true }],
    now,
  });
  assert.equal(out[0].kind, "warning");
  assert.match(out[0].reason, /Isotretinoína/);
});

test("ficha inteligente: sugiere mantención entre 3 y 16 semanas", () => {
  const out = recommend({
    selected: { id: "facial", name: "Limpieza facial", categoryId: "fac", durationMinutes: 60 },
    catalog: [{ id: "facial", name: "Limpieza facial", categoryId: "fac", durationMinutes: 60 }],
    history: [{ serviceId: "facial", categoryId: "fac", completedAt: new Date(now.getTime() - 60 * DAY) }],
    alerts: [],
    now,
  });
  assert.ok(out.some((r) => r.kind === "follow_up"));
});

test("ficha inteligente: no sugiere mantención si la última visita fue hace menos de 3 semanas", () => {
  const out = recommend({
    selected: { id: "facial", name: "Limpieza facial", categoryId: "fac", durationMinutes: 60 },
    catalog: [{ id: "facial", name: "Limpieza facial", categoryId: "fac", durationMinutes: 60 }],
    history: [{ serviceId: "facial", categoryId: "fac", completedAt: new Date(now.getTime() - 5 * DAY) }],
    alerts: [],
    now,
  });
  assert.equal(out.filter((r) => r.kind === "follow_up").length, 0);
});

test("ficha inteligente: venta cruzada cuando solo tiene historial en otra categoría", () => {
  const out = recommend({
    selected: { id: "corp", name: "Reductivo", categoryId: "corporal", durationMinutes: 45 },
    catalog: [
      { id: "corp", name: "Reductivo", categoryId: "corporal", durationMinutes: 45 },
      { id: "corp2", name: "Drenaje", categoryId: "corporal", durationMinutes: 45 },
    ],
    history: [{ serviceId: "facial", categoryId: "facial", completedAt: new Date(now.getTime() - 2 * DAY) }],
    alerts: [],
    now,
  });
  const cross = out.find((r) => r.kind === "cross_sell");
  assert.ok(cross);
  assert.equal(cross?.serviceId, "corp2");
});
