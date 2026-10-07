import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query, queryOne } from "@/lib/db";
import { readSession } from "@/lib/session";
import { audit } from "@/lib/audit";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Derecho de acceso (ARCO): entrega todos los datos de una paciente en un archivo JSON.
 * Solo dirección y profesionales de la misma clínica. Cada exportación queda auditada.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await readSession();
  if (!session || !UUID.test(id)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (session.role !== "admin" && session.role !== "profesional") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const patient = await queryOne<RowDataPacket>(
    `SELECT id, full_name, rut, birth_date, gender, phone, email, address, comuna, referred_by, notes, created_at
       FROM patients WHERE id = ? AND clinic_id = ?`,
    [id, session.clinicId],
  );
  if (!patient) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const [alerts, plans, sessions, consents, appointments, nps] = await Promise.all([
    query("SELECT type, severity, description, is_active, created_at FROM medical_alerts WHERE patient_id = ?", [id]),
    query(
      `SELECT s.name AS service, tp.total_sessions, tp.sessions_completed, tp.status, tp.started_at
         FROM treatment_plans tp JOIN services s ON s.id = tp.service_id WHERE tp.patient_id = ?`,
      [id],
    ),
    query("SELECT session_number, evolution_notes, created_at FROM treatment_sessions WHERE patient_id = ? ORDER BY created_at", [id]),
    query(
      "SELECT form_version, form_body_snapshot, signer_name, signed_at FROM patient_consents WHERE patient_id = ? ORDER BY signed_at",
      [id],
    ),
    query(
      `SELECT a.start_at, a.end_at, a.status, s.name AS service
         FROM appointments a LEFT JOIN services s ON s.id = a.service_id WHERE a.patient_id = ? ORDER BY a.start_at`,
      [id],
    ),
    query("SELECT score, comment, created_at FROM nps_surveys WHERE patient_id = ?", [id]),
  ]);

  await audit({
    clinicId: session.clinicId,
    actorId: session.sub,
    action: "patient.export",
    entityType: "patient",
    entityId: id,
  });

  const body = {
    exportado_el: new Date().toISOString(),
    paciente: patient,
    alertas_medicas: alerts,
    planes_de_tratamiento: plans,
    evoluciones: sessions,
    consentimientos: consents,
    citas: appointments,
    encuestas: nps,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="paciente-${id}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
