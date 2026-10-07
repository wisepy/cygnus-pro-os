import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { execute, queryOne, transaction } from "@/lib/db";
import { fingerprint } from "@/lib/crypto";

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

/** true si el correo está bloqueado por demasiados intentos fallidos. */
export async function isLocked(email: string): Promise<boolean> {
  const row = await queryOne<RowDataPacket & { locked_until: Date | null }>(
    "SELECT locked_until FROM login_attempts WHERE id = ?",
    [fingerprint(email)],
  );
  return !!row?.locked_until && row.locked_until.getTime() > Date.now();
}

/** Suma un intento fallido. Dentro de una transacción para que dos intentos simultáneos no se pierdan. */
export async function registerFailure(email: string) {
  const id = fingerprint(email);
  await transaction(async (conn) => {
    await conn.query("INSERT IGNORE INTO login_attempts (id, failures) VALUES (?, 0)", [id]);
    const [rows] = await conn.query<(RowDataPacket & { failures: number; locked_until: Date | null })[]>(
      "SELECT failures, locked_until FROM login_attempts WHERE id = ? FOR UPDATE",
      [id],
    );
    const current = rows[0];
    const expired = current.locked_until !== null && current.locked_until.getTime() <= Date.now();
    const failures = expired ? 1 : current.failures + 1;
    const lockedUntil = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await conn.query("UPDATE login_attempts SET failures = ?, locked_until = ? WHERE id = ?", [
      failures,
      lockedUntil,
      id,
    ]);
  });
}

export async function clearFailures(email: string) {
  await execute("DELETE FROM login_attempts WHERE id = ?", [fingerprint(email)]);
}
