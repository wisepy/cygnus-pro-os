import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifrado de archivos sensibles (fotos de evolución, firmas de consentimiento)
 * con AES-256-GCM. La clave vive solo en el entorno del servidor (FILES_KEY,
 * 32 bytes en base64). Cada archivo usa un IV aleatorio y su tag de autenticidad.
 * Formato: IV(12) | TAG(16) | CIFRADO
 */
function fileKey(): Buffer {
  const raw = process.env.FILES_KEY;
  if (!raw) throw new Error("Falta FILES_KEY en las variables de entorno.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("FILES_KEY debe ser 32 bytes en base64.");
  return key;
}

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", fileKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptBuffer(payload: Buffer): Buffer {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const body = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", fileKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

/** Huella irreversible (SHA-256) para correos, IP y referencias de borrado. */
export function fingerprint(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}
