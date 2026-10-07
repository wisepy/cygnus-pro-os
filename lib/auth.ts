import "server-only";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { queryOne } from "@/lib/db";
import { readSession, setSessionCookie, clearSessionCookie } from "@/lib/session";
import type { UserRole } from "@/types/domain";

export type CurrentProfile = {
  id: string;
  clinicId: string;
  role: UserRole;
  fullName: string;
  email: string | null;
  colorHex: string;
  avatarUrl: string | null;
};

type ProfileDbRow = RowDataPacket & {
  id: string;
  clinic_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  color_hex: string;
  avatar_url: string | null;
  active: number;
};

const PROFILE_COLUMNS = "id, clinic_id, role, full_name, email, color_hex, avatar_url, active";

function toCurrentProfile(row: ProfileDbRow): CurrentProfile {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    colorHex: row.color_hex,
    avatarUrl: row.avatar_url,
  };
}

/**
 * Perfil del usuario con sesión activa. Redirige a /login si no hay sesión,
 * si la cuenta fue desactivada o si el perfil ya no existe.
 */
export async function requireProfile(): Promise<CurrentProfile> {
  const session = await readSession();
  if (!session) redirect("/login");

  const row = await queryOne<ProfileDbRow>(
    `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = ? AND active = 1`,
    [session.sub],
  );
  if (!row) {
    await clearSessionCookie();
    redirect("/login");
  }
  return toCurrentProfile(row);
}

/** Redirige si el rol actual no esta en la lista permitida (para paginas). */
export function assertRole(profile: CurrentProfile, allowed: UserRole[]) {
  if (!allowed.includes(profile.role)) {
    redirect("/dashboard");
  }
}

/**
 * Para usar dentro de Server Actions: lanza un error (en vez de redirigir)
 * si el rol no esta autorizado, para que la accion devuelva el error a la UI.
 */
export async function requireRole(allowed: UserRole[]): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!allowed.includes(profile.role)) {
    throw new Error("No tienes permisos para realizar esta acción.");
  }
  return profile;
}

/**
 * Verifica email y contraseña. Devuelve el perfil o null.
 * Mensaje genérico: no revela si el correo existe.
 */
export async function authenticate(email: string, password: string): Promise<CurrentProfile | null> {
  const row = await queryOne<ProfileDbRow & { password_hash: string }>(
    `SELECT ${PROFILE_COLUMNS}, password_hash FROM profiles WHERE email = ? AND active = 1`,
    [email.trim().toLowerCase()],
  );
  if (!row) {
    // Comparacion dummy para que el tiempo de respuesta no delate si el correo existe.
    await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    return null;
  }
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return null;
  return toCurrentProfile(row);
}

export async function startSession(profile: CurrentProfile) {
  await setSessionCookie({ sub: profile.id, clinicId: profile.clinicId, role: profile.role });
}

export async function endSession() {
  await clearSessionCookie();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
