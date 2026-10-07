import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const patientSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2, "Ingresa el nombre").max(255),
  rut: z
    .string()
    .trim()
    .max(12)
    .regex(/^(\d{1,8}-[\dkK])?$/, "Formato de RUT: 12345678-9")
    .optional()
    .or(z.literal("")),
  birthDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Fecha inválida").optional().or(z.literal("")),
  gender: z.enum(["F", "M", ""]).optional(),
  phone: optionalText(50),
  email: z.string().trim().email("Correo inválido").max(255).optional().or(z.literal("")),
  address: optionalText(255),
  comuna: optionalText(120),
  referredBy: optionalText(255),
  notes: optionalText(4000),
});

export type PatientInput = z.input<typeof patientSchema>;
export type PatientData = z.output<typeof patientSchema>;

export const alertSchema = z.object({
  patientId: z.string().uuid(),
  type: z.enum(["allergy", "condition", "medication", "contraindication"]),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string().trim().min(3, "Describe la alerta").max(500),
});

export const planSchema = z.object({
  patientId: z.string().uuid(),
  serviceId: z.string().uuid("Selecciona un servicio"),
  totalSessions: z.coerce.number().int().min(1, "Mínimo 1 sesión").max(60),
});

export const sessionSchema = z.object({
  patientId: z.string().uuid(),
  treatmentPlanId: z.string().uuid().optional().or(z.literal("")),
  evolutionNotes: z.string().trim().min(3, "Escribe la evolución").max(4000),
});

export const consentSchema = z.object({
  patientId: z.string().uuid(),
  consentFormId: z.string().uuid(),
  signerName: z.string().trim().min(5, "Nombre completo del firmante").max(255),
  signerRut: z.string().trim().max(12).optional().or(z.literal("")),
  acceptance: z.literal(true, { message: "Debe aceptar el consentimiento" }),
});

export const consentFormSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20, "El texto del consentimiento es muy corto").max(20000),
});
