// Importa pacientes desde el CSV normalizado (pacientes_importables_cygnus.csv).
// Uso (desde la carpeta del proyecto):
//   node --env-file=.env.local scripts/import-patients.mjs "C:\ruta\pacientes_importables_cygnus.csv" --dry-run
//   node --env-file=.env.local scripts/import-patients.mjs "C:\ruta\pacientes_importables_cygnus.csv"
// Reglas: no sobrescribe fichas existentes. Un RUT ya registrado se omite. Sin RUT, se omite
// si ya existe una paciente con el mismo nombre y teléfono. Las filas con revisión pendiente
// se importan igual, con la marca en las notas para revisarlas.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const CLINIC_ID = "00000000-0000-4000-8000-000000000001";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--"));

if (!file) {
  console.error("Indica la ruta del CSV.");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!dryRun && (!url || url.includes("usuario:clave") || url.includes("base_pendiente"))) {
  console.error("Falta DATABASE_URL real en .env.local.");
  process.exit(1);
}

/** Parser CSV con comillas y saltos de línea dentro de campos. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const text = (await readFile(file, "utf8")).replace(/^\uFEFF/, "");
const [header, ...body] = parseCsv(text);
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
const need = ["full_name", "rut", "birth_date", "phone", "email", "gender", "comuna", "ciudad", "notes", "revision"];
const missing = need.filter((k) => !(k in col));
if (missing.length) {
  console.error("Faltan columnas en el CSV:", missing.join(", "));
  process.exit(1);
}

const get = (r, k) => (r[col[k]] ?? "").trim();
const records = body
  .filter((r) => r.some((c) => c.trim() !== ""))
  .map((r) => {
    const notes = [get(r, "notes"), get(r, "revision") && `REVISAR: ${get(r, "revision")}`, get(r, "ciudad") && `Ciudad: ${get(r, "ciudad")}`, "Importada desde archivo de clientes"]
      .filter(Boolean)
      .join(" | ");
    return {
      fullName: get(r, "full_name"),
      rut: get(r, "rut") || null,
      birthDate: get(r, "birth_date") || null,
      gender: ["F", "M"].includes(get(r, "gender")) ? get(r, "gender") : null,
      phone: get(r, "phone") || null,
      email: get(r, "email").toLowerCase() || null,
      comuna: get(r, "comuna") || null,
      notes,
    };
  })
  .filter((r) => r.fullName.length >= 2);

console.log(`Filas válidas en el CSV: ${records.length}`);
if (dryRun) {
  console.log("Modo prueba: no se escribió nada. Quita --dry-run para importar.");
  process.exit(0);
}

const connection = await mysql.createConnection({ uri: url, charset: "utf8mb4", timezone: "Z" });
let inserted = 0;
let skippedRut = 0;
let skippedDup = 0;
try {
  const [existingRuts] = await connection.query("SELECT rut FROM patients WHERE clinic_id = ? AND rut IS NOT NULL", [CLINIC_ID]);
  const ruts = new Set(existingRuts.map((r) => r.rut));
  const [existingNamePhone] = await connection.query(
    "SELECT LOWER(full_name) AS n, COALESCE(phone, '') AS p FROM patients WHERE clinic_id = ?",
    [CLINIC_ID],
  );
  const namePhone = new Set(existingNamePhone.map((r) => `${r.n}|${r.p}`));

  await connection.beginTransaction();
  for (const r of records) {
    if (r.rut) {
      if (ruts.has(r.rut)) { skippedRut++; continue; }
    } else if (namePhone.has(`${r.fullName.toLowerCase()}|${r.phone ?? ""}`)) {
      skippedDup++;
      continue;
    }
    await connection.query(
      `INSERT INTO patients (id, clinic_id, full_name, rut, birth_date, gender, phone, email, comuna, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), CLINIC_ID, r.fullName, r.rut, r.birthDate, r.gender, r.phone, r.email, r.comuna, r.notes],
    );
    if (r.rut) ruts.add(r.rut);
    namePhone.add(`${r.fullName.toLowerCase()}|${r.phone ?? ""}`);
    inserted++;
  }
  await connection.query(
    "INSERT INTO audit_log (id, clinic_id, actor_id, action, entity_type, metadata) VALUES (?, ?, NULL, 'patients.import', 'clinic', ?)",
    [randomUUID(), CLINIC_ID, JSON.stringify({ inserted, skippedRut, skippedDup, source: "csv" })],
  );
  await connection.commit();
  console.log(`Listo. Importadas: ${inserted}. Omitidas por RUT repetido: ${skippedRut}. Omitidas por nombre y teléfono repetidos: ${skippedDup}.`);
} catch (error) {
  await connection.rollback();
  console.error("Importación revertida:", error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
