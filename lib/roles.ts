import type { UserRole } from "@/types/domain";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Dirección",
  recepcion: "Recepción",
  profesional: "Profesional",
  caja: "Caja",
};
