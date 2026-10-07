import type { UserRole } from "@/types/domain";

// Los íconos se guardan como nombre (no como referencia a la función) porque este
// archivo lo usan tanto Server Components como el Client Component de la barra de
// navegación: pasar el componente de ícono directamente entre ambos falla en React.
export type NavIconName =
  | "home"
  | "calendar"
  | "stethoscope"
  | "wallet"
  | "users"
  | "trending-up"
  | "bar-chart"
  | "settings";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconName;
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Hoy", href: "/dashboard", icon: "home", roles: ["admin", "recepcion", "profesional", "caja"] },
  { label: "Agenda", href: "/dashboard/agenda", icon: "calendar", roles: ["admin", "recepcion", "profesional"] },
  { label: "Clínica", href: "/dashboard/clinica", icon: "stethoscope", roles: ["admin", "profesional"] },
  { label: "Caja", href: "/dashboard/caja", icon: "wallet", roles: ["admin", "caja"] },
  { label: "Staff", href: "/dashboard/staff", icon: "users", roles: ["admin"] },
  { label: "Ventas", href: "/dashboard/ventas", icon: "trending-up", roles: ["admin", "profesional"] },
  { label: "Reportes", href: "/dashboard/reportes", icon: "bar-chart", roles: ["admin"] },
  { label: "Configuración", href: "/dashboard/settings/usuarios", icon: "settings", roles: ["admin"] },
];

export function navForRole(role: UserRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
