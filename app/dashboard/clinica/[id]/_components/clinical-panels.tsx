"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recommend, type AlertInfo, type CatalogService, type HistoryEntry } from "@/lib/recommendations";
import {
  addMedicalAlert,
  addTreatmentSession,
  createConsentForm,
  createTreatmentPlan,
  deletePatient,
  signConsent,
  toggleMedicalAlert,
} from "../../actions";

type Alert = { id: string; type: string; severity: string; description: string; is_active: number };
type Plan = { id: string; service_name: string; total_sessions: number; sessions_completed: number; status: string };
type Session = { id: string; session_number: number | null; evolution_notes: string | null; created_at: Date; professional: string };
type Service = { id: string; name: string };
type ConsentForm = { id: string; title: string; body: string; version: number } | null;
type Consent = { id: string; form_version: number; signer_name: string; signed_at: Date };

const ALERT_TYPES = [
  { value: "allergy", label: "Alergia" },
  { value: "condition", label: "Condición" },
  { value: "medication", label: "Medicamento" },
  { value: "contraindication", label: "Contraindicación" },
] as const;

function useAction() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function run(fn: () => Promise<{ error?: string; success?: boolean; fieldErrors?: Record<string, string> }>, okMessage: string, after?: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) { toast.error(result.error); return; }
      if (result.fieldErrors) { toast.error(Object.values(result.fieldErrors)[0]); return; }
      toast.success(okMessage);
      after?.();
      router.refresh();
    });
  }
  return { isPending, run };
}

export function AlertsPanel({ patientId, alerts }: { patientId: string; alerts: Alert[] }) {
  const { isPending, run } = useAction();
  const [type, setType] = useState<string>("allergy");
  const [severity, setSeverity] = useState<string>("high");
  const [description, setDescription] = useState("");

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-medium text-foreground">Alertas médicas</h2>
      {alerts.length === 0 && <p className="text-sm text-muted-foreground">Sin alertas registradas.</p>}
      <ul className="flex flex-col gap-2">
        {alerts.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">
            <div>
              <Badge variant={a.severity === "high" ? "destructive" : "secondary"} className="mr-1">
                {ALERT_TYPES.find((t) => t.value === a.type)?.label ?? a.type}
              </Badge>
              <span className={a.is_active ? "text-foreground" : "text-muted-foreground line-through"}>{a.description}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => toggleMedicalAlert(a.id, patientId, !a.is_active), a.is_active ? "Alerta desactivada" : "Alerta activada")}
            >
              {a.is_active ? "Desactivar" : "Activar"}
            </Button>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <Select value={type} onValueChange={(v) => setType(v ?? "allergy")}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALERT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => setSeverity(v ?? "medium")}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
          </SelectContent>
        </Select>
        <Input className="col-span-2" placeholder="Describe la alerta" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Button
          className="col-span-2"
          disabled={isPending || description.trim().length < 3}
          onClick={() =>
            run(
              () => addMedicalAlert({ patientId, type, severity, description }),
              "Alerta agregada",
              () => setDescription(""),
            )
          }
        >
          {isPending && <Loader2 className="animate-spin" />}
          Agregar alerta
        </Button>
      </div>
    </Card>
  );
}

export function PlansPanel({
  patientId,
  services,
  plans,
  catalog,
  history,
  alerts,
}: {
  patientId: string;
  services: Service[];
  plans: Plan[];
  catalog: CatalogService[];
  history: HistoryEntry[];
  alerts: AlertInfo[];
}) {
  const { isPending, run } = useAction();
  const [serviceId, setServiceId] = useState("");
  const [total, setTotal] = useState("6");

  // Ficha inteligente: recomendaciones calculadas al elegir el tratamiento.
  const selected = catalog.find((s) => s.id === serviceId);
  const suggestions = selected ? recommend({ selected, catalog, history, alerts }) : [];
  const nameOf = (id?: string) => catalog.find((s) => s.id === id)?.name ?? "";

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-medium text-foreground">Plan de tratamiento</h2>
      {plans.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay planes.</p>}
      <ul className="flex flex-col gap-3">
        {plans.map((p) => {
          const pct = Math.min(100, Math.round((p.sessions_completed / p.total_sessions) * 100));
          return (
            <li key={p.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{p.service_name}</span>
                <Badge variant={p.status === "completed" ? "secondary" : "default"}>
                  {p.sessions_completed}/{p.total_sessions} · {p.status === "completed" ? "Completado" : "Activo"}
                </Badge>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      {suggestions.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {suggestions.map((s, i) => (
            <li
              key={`${s.kind}-${i}`}
              className={
                s.kind === "warning"
                  ? "rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-sm"
                  : "rounded-lg border border-primary/30 bg-accent/40 p-2.5 text-sm"
              }
            >
              <p className="font-medium text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.reason}</p>
              {s.serviceId && s.serviceId !== serviceId && (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setServiceId(s.serviceId!)}>
                  Usar {nameOf(s.serviceId)}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        <Select value={serviceId || undefined} onValueChange={(v) => setServiceId(v ?? "")}>
          <SelectTrigger className="col-span-2 w-full"><SelectValue placeholder="Servicio" /></SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="number" min={1} value={total} onChange={(e) => setTotal(e.target.value)} aria-label="Sesiones" />
        <Button
          className="col-span-3"
          disabled={isPending || !serviceId}
          onClick={() => run(() => createTreatmentPlan({ patientId, serviceId, totalSessions: Number(total) }), "Plan creado", () => setServiceId(""))}
        >
          {isPending && <Loader2 className="animate-spin" />}
          Crear plan
        </Button>
      </div>
    </Card>
  );
}

export function SessionsPanel({ patientId, plans, sessions }: { patientId: string; plans: Plan[]; sessions: Session[] }) {
  const { isPending, run } = useAction();
  const [planId, setPlanId] = useState("");
  const [notes, setNotes] = useState("");
  const activePlans = plans.filter((p) => p.status === "active");

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-medium text-foreground">Evoluciones</h2>
      <div className="flex flex-col gap-2 border-b border-border pb-3">
        <Textarea rows={3} placeholder="Evolución de la sesión: qué se hizo, cómo respondió la piel, indicaciones." value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={planId || undefined} onValueChange={(v) => setPlanId(v ?? "")}>
            <SelectTrigger className="min-w-56"><SelectValue placeholder="Sin plan (sesión suelta)" /></SelectTrigger>
            <SelectContent>
              {activePlans.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.service_name} · sesión {p.sessions_completed + 1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={isPending || notes.trim().length < 3}
            onClick={() => run(() => addTreatmentSession({ patientId, treatmentPlanId: planId, evolutionNotes: notes }), "Evolución guardada", () => { setNotes(""); setPlanId(""); })}
          >
            {isPending && <Loader2 className="animate-spin" />}
            Guardar evolución
          </Button>
        </div>
      </div>

      <ol className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
        {sessions.length === 0 && <p className="text-sm text-muted-foreground">Sin evoluciones registradas.</p>}
        {sessions.map((s) => (
          <li key={s.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{s.session_number ? `Sesión ${s.session_number}` : "Sesión"} · {s.professional}</span>
              <span>{new Date(s.created_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}</span>
            </div>
            <p className="whitespace-pre-wrap text-foreground">{s.evolution_notes}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function ConsentPanel({ patientId, activeForm, consents, isAdmin }: { patientId: string; activeForm: ConsentForm; consents: Consent[]; isAdmin: boolean }) {
  const { isPending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-medium text-foreground">Consentimientos</h2>
      {activeForm ? (
        <p className="text-sm text-muted-foreground">Vigente: {activeForm.title} (versión {activeForm.version})</p>
      ) : (
        <p className="text-sm text-destructive">No hay consentimiento vigente. Publica uno antes de atender.</p>
      )}
      <ul className="flex flex-col gap-1.5 text-sm">
        {consents.map((c) => (
          <li key={c.id} className="flex justify-between">
            <span>{c.signer_name} · v{c.form_version}</span>
            <span className="text-muted-foreground">{new Date(c.signed_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!activeForm} onClick={() => setOpen(true)}>Registrar firma</Button>
        {isAdmin && <Button variant="ghost" onClick={() => setPublishOpen(true)}>Publicar nueva versión</Button>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activeForm?.title}</DialogTitle>
            <DialogDescription>Versión {activeForm?.version}. Se guarda el texto exacto que la paciente acepta.</DialogDescription>
          </DialogHeader>
          <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border p-3 text-sm">{activeForm?.body}</div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sign-name">Nombre completo de quien firma</Label>
              <Input id="sign-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sign-rut">RUT (opcional)</Label>
              <Input id="sign-rut" value={rut} onChange={(e) => setRut(e.target.value)} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              Declaro haber leído y aceptado el consentimiento.
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              disabled={isPending || !accepted || name.trim().length < 5 || !activeForm}
              onClick={() =>
                run(
                  () => signConsent({ patientId, consentFormId: activeForm?.id, signerName: name, signerRut: rut, acceptance: true }),
                  "Consentimiento registrado",
                  () => { setOpen(false); setName(""); setRut(""); setAccepted(false); },
                )
              }
            >
              {isPending && <Loader2 className="animate-spin" />}
              Firmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Publicar nueva versión del consentimiento</DialogTitle>
            <DialogDescription>Las firmas anteriores conservan el texto que aceptaron.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="Título" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Textarea rows={10} placeholder="Texto completo del consentimiento" value={newBody} onChange={(e) => setNewBody(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancelar</Button>
            <Button
              disabled={isPending || newTitle.trim().length < 3 || newBody.trim().length < 20}
              onClick={() => run(() => createConsentForm({ title: newTitle, body: newBody }), "Nueva versión publicada", () => { setPublishOpen(false); setNewTitle(""); setNewBody(""); })}
            >
              {isPending && <Loader2 className="animate-spin" />}
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function DeletePatientPanel({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);

  function remove() {
    startTransition(async () => {
      const result = await deletePatient(patientId, reason, confirm);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Ficha eliminada y registrada en el log de eliminaciones");
      router.push("/dashboard/clinica");
    });
  }

  return (
    <Card className="flex flex-col gap-3 border-destructive/30 p-5">
      <h2 className="font-heading text-lg font-medium text-destructive">Eliminar ficha</h2>
      <p className="text-sm text-muted-foreground">
        Borrado definitivo por derecho de eliminación. Queda una constancia sin datos personales.
      </p>
      <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => setOpen(true)}>
        <Trash2 />
        Eliminar esta ficha
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar esta ficha?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. Indica el motivo y escribe ELIMINAR.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Textarea rows={2} placeholder="Motivo (mínimo 10 caracteres)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Input placeholder="Escribe ELIMINAR" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={isPending || reason.trim().length < 10 || confirm !== "ELIMINAR"} onClick={remove}>
              {isPending && <Loader2 className="animate-spin" />}
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
