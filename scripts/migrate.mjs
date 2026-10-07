// Aplica db/schema.sql y db/seed.sql sobre la base indicada en DATABASE_URL.
// Uso (desde la carpeta del proyecto):
//   node --env-file=.env.local scripts/migrate.mjs            aplica esquema + catálogo
//   node --env-file=.env.local scripts/migrate.mjs --schema   solo esquema
// Es idempotente: usa CREATE TABLE IF NOT EXISTS e INSERT IGNORE.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL;
if (!url || url.includes("usuario:clave") || url.includes("base_pendiente")) {
  console.error("Falta DATABASE_URL real en .env.local.");
  process.exit(1);
}

/** Divide un script SQL en sentencias, respetando las directivas DELIMITER de la consola de MySQL. */
function splitStatements(sql) {
  const statements = [];
  let delimiter = ";";
  let buffer = "";
  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    const directive = /^DELIMITER\s+(\S+)$/i.exec(trimmed);
    if (directive) {
      delimiter = directive[1];
      continue;
    }
    if (!buffer && (trimmed === "" || trimmed.startsWith("--"))) continue;
    buffer += line + "\n";
    if (buffer.trimEnd().endsWith(delimiter)) {
      const body = buffer.trimEnd().slice(0, -delimiter.length).trim();
      if (body) statements.push(body);
      buffer = "";
    }
  }
  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

const connection = await mysql.createConnection({ uri: url, charset: "utf8mb4", timezone: "Z" });
try {
  const files = process.argv.includes("--schema") ? ["db/schema.sql"] : ["db/schema.sql", "db/seed.sql"];
  for (const file of files) {
    const statements = splitStatements(await readFile(path.join(root, file), "utf8"));
    console.log(`${file}: ${statements.length} sentencias`);
    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        // Re-ejecutar sobre una base ya migrada: los triggers y tablas existentes no son error.
        if (error.code === "ER_TRIGGER_ALREADY_EXISTS" || error.code === "ER_DUP_KEYNAME") continue;
        throw new Error(`${file}: ${error.message}\n--> ${statement.slice(0, 120)}`);
      }
    }
  }
  const [tables] = await connection.query("SHOW TABLES");
  console.log(`Listo. La base tiene ${tables.length} tablas.`);
} catch (error) {
  console.error("Error en la migración:", error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
