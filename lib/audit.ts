import "server-only";
import { randomUUID } from "node:crypto";
import { execute } from "@/lib/db";

/**
 * Registra acciones sensibles (pacientes, pagos, consentimientos, eliminaciones).
 * No guarda contenido clínico: solo qué se hizo, sobre qué entidad y quién.
 */
export async function audit(params: {
  clinicId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  await execute(
    `INSERT INTO audit_log (id, clinic_id, actor_id, action, entity_type, entity_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      params.clinicId,
      params.actorId,
      params.action,
      params.entityType,
      params.entityId ?? null,
      JSON.stringify(params.metadata ?? {}),
    ],
  );
}
