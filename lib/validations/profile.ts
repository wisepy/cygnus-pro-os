import { z } from "zod";

export const ROLE_OPTIONS = ["admin", "recepcion", "profesional", "caja"] as const;

export const createStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa el nombre completo"),
  email: z.string().trim().min(1, "Ingresa un correo").email("Correo inválido"),
  password: z.string().min(10, "Mínimo 10 caracteres").regex(/[A-Za-z]/, "Incluye letras").regex(/[0-9]/, "Incluye números"),
  role: z.enum(ROLE_OPTIONS),
  phone: z.string().trim().optional().or(z.literal("")),
  specialty: z.string().trim().optional().or(z.literal("")),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
  isBookable: z.boolean(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  profileId: z.string().uuid(),
  fullName: z.string().trim().min(2, "Ingresa el nombre completo"),
  role: z.enum(ROLE_OPTIONS),
  phone: z.string().trim().optional().or(z.literal("")),
  specialty: z.string().trim().optional().or(z.literal("")),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
  isBookable: z.boolean(),
  active: z.boolean(),
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
