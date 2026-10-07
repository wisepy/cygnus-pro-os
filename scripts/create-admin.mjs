// Crea el primer usuario administrador en la base MySQL de Hostinger.
// Uso (desde la carpeta del proyecto):
//   node --env-file=.env.local scripts/create-admin.mjs "correo" "contraseña" "Nombre Completo"
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const [, , email, password, fullName] = process.argv;

if (!email || !password || !fullName) {
  console.error('Uso: node --env-file=.env.local scripts/create-admin.mjs "correo" "contraseña" "Nombre Completo"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url || url.includes("usuario:clave")) {
  console.error("Falta DATABASE_URL en .env.local (mysql://usuario:clave@host:3306/base).");
  process.exit(1);
}

const CLINIC_ID = "00000000-0000-4000-8000-000000000001";
const connection = await mysql.createConnection({ uri: url, timezone: "Z", charset: "utf8mb4" });

try {
  const [clinics] = await connection.query("SELECT id FROM clinics WHERE id = ?", [CLINIC_ID]);
  if (clinics.length === 0) {
    console.error("La clínica no existe. Ejecuta primero db/schema.sql y db/seed.sql en la base.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await connection.query(
    `INSERT INTO profiles (id, clinic_id, role, full_name, email, password_hash, is_bookable, color_hex, active)
     VALUES (?, ?, 'admin', ?, ?, ?, 0, '#D29D9E', 1)`,
    [randomUUID(), CLINIC_ID, fullName, email.trim().toLowerCase(), passwordHash],
  );

  console.log(`Administrador creado: ${email}. Ya puedes iniciar sesión en /login.`);
} catch (error) {
  if (error && error.code === "ER_DUP_ENTRY") {
    console.error("Ese correo ya tiene una cuenta.");
  } else {
    console.error("Error creando el administrador:", error.message);
  }
  process.exitCode = 1;
} finally {
  await connection.end();
}
