import { z } from "zod";

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora inválidas");

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid("Selecciona una paciente"),
  profileId: z.string().uuid("Selecciona un profesional"),
  serviceId: z.string().uuid("Selecciona un servicio"),
  resourceId: z.string().uuid().optional().or(z.literal("")),
  start: localDateTime,
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const createBlockSchema = z.object({
  profileId: z.string().uuid("Selecciona un profesional"),
  start: localDateTime,
  durationMinutes: z.coerce.number().int().min(5).max(480),
  reason: z.string().trim().min(2, "Indica el motivo").max(255),
});

export const setStatusSchema = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum(APPOINTMENT_STATUSES),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type CreateBlockInput = z.input<typeof createBlockSchema>;
export type SetStatusInput = z.infer<typeof setStatusSchema>;
