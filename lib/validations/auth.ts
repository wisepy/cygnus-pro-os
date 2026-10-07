import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Ingresa tu correo").email("Correo invalido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;
