import "server-only";
import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

/**
 * Pool de conexiones a MySQL (Hostinger). Se reutiliza entre recargas en
 * desarrollo para no abrir conexiones de más.
 * Variable requerida: DATABASE_URL=mysql://usuario:clave@host:3306/nombre_bd
 */
declare global {
  // eslint-disable-next-line no-var
  var __cygnusPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__cygnusPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta DATABASE_URL en las variables de entorno.");
    globalThis.__cygnusPool = mysql.createPool({
      uri: url,
      connectionLimit: 10,
      decimalNumbers: true,
      timezone: "Z",
      charset: "utf8mb4",
    });
  }
  return globalThis.__cygnusPool;
}

export async function query<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getPool().query<T[]>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await getPool().query<ResultSetHeader>(sql, params);
  return result;
}

/** Ejecuta varias escrituras en una transacción. Si una falla, se revierte todo. */
export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
