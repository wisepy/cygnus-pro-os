"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createAppointment,
  createBlock,
  searchPatients,
  setAppointmentStatus,
} from "../actions";

export type AgendaProfessional = { id: string; name: string; colorHex: string; specialty: string | null };
export type AgendaAppointment = {
  id: string;
  profileId: string;
  patientId: string | null;
  title: string;
  service: string | null;
  resource: string | null;
  type: "appointment" | "block";
  status: "scheduled" | "confirmed" | "checked_in" | "in_progress" | "completed" | "cancelled" | "no_show";
  startLocal: string;
  endLocal: string;
};
type Resource = { id: string; name: string; kind: "box" | "machine" };
type Service = { id: string; name: string; durationMinutes: number };

// Escala de la grilla: 08:00 a 21:00, 1,6 px por minuto (una hora = 96 px).
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 21 * 60;
const PX_PER_MIN = 1.6;
const SLOT_MIN = 15;

const STATUS_LABEL: Record<AgendaAppointment["status"], string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  checked_in: "Llegó",
  in_progress: "En atención",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const STATUS_STYLE: Record<AgendaAppointment["status"], string> = {
  scheduled: "bg-secondary text-secondary-foreground border-border",
  confirmed: "bg-accent text-accent-foreground border-primary/30",
  checked_in: "bg-warning/20 text-foreground border-warning/40",
  in_progress: "bg-success/20 text-foreground border-success/50",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-transparent text-destructive border-destructive/40 line-through",
  no_show: "bg-transparent text-destructive border-destructive/40",
};

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(total: number) {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function AgendaBoard({
  date,
  canManage,
  professionals,
  resources,
  services,
  appointments,
}: {
  date: string;
  canManage: boolean;
  professionals: AgendaProfessional[];
  resources: Resource[];
  services: Service[];
  appointments: AgendaAppointment[];
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState<{ profileId?: string; time?: string } | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [detail, setDetail] = useState<AgendaAppointment | null>(null);

  // Actualiza la agenda sola cada 30 segundos mientras la pestaña está visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [router]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = DAY_START_MIN; m < DAY_END_MIN; m += 60) list.push(m);
    return list;
  }, []);
  const gridHeight = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN;

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, profileId: string) {
    if (!canManage) return;
    if ((e.target as HTMLElement).closest("[data-appointment]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = DAY_START_MIN + Math.floor((e.clientY - rect.top) / PX_PER_MIN / SLOT_MIN) * SLOT_MIN;
    setNewOpen({ profileId, time: toHHMM(minutes) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <>
            <Button onClick={() => setNewOpen({})}>
              <Plus />
              Nueva cita
            </Button>
            <Button variant="outline" onClick={() => setBlockOpen(true)}>
              <Ban />
              Bloquear horario
            </Button>
          </>
        )}
        <p className="ml-auto text-xs text-muted-foreground">Se actualiza sola cada 30 segundos.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex min-w-max">
          <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-border bg-card" style={{ height: gridHeight + 56 }}>
            <div className="h-14 border-b border-border" />
            {hours.map((m) => (
              <div
                key={m}
                className="absolute w-16 pr-2 text-right text-xs text-muted-foreground tabular-nums"
                style={{ top: 56 + (m - DAY_START_MIN) * PX_PER_MIN - 7 }}
              >
                {toHHMM(m)}
              </div>
            ))}
          </div>

          {professionals.map((pro) => {
            const column = appointments.filter((a) => a.profileId === pro.id);
            const booked = column
              .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
              .reduce((sum, a) => sum + (toMinutes(a.endLocal) - toMinutes(a.startLocal)), 0);
            const occupancy = Math.round((booked / (DAY_END_MIN - DAY_START_MIN)) * 100);

            return (
              <div key={pro.id} className="w-56 shrink-0 border-r border-border last:border-r-0">
                <div className="flex h-14 flex-col justify-center border-b border-border px-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: pro.colorHex }} />
                    <p className="truncate text-sm font-medium text-foreground">{pro.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pro.specialty ? `${pro.specialty} · ` : ""}
                    {occupancy}% ocupado
                  </p>
                </div>

                <div
                  className="relative cursor-pointer"
                  style={{ height: gridHeight }}
                  onClick={(e) => handleColumnClick(e, pro.id)}
                >
                  {hours.map((m) => (
                    <div
                      key={m}
                      className="absolute inset-x-0 border-t border-border/70"
                      style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }}
                    />
                  ))}

                  {column.map((a) => {
                    const top = (toMinutes(a.startLocal) - DAY_START_MIN) * PX_PER_MIN;
                    const height = Math.max((toMinutes(a.endLocal) - toMinutes(a.startLocal)) * PX_PER_MIN - 3, 22);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        data-appointment
                        onClick={() => setDetail(a)}
                        className={cn(
                          "absolute inset-x-1.5 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-ring",
                          STATUS_STYLE[a.status],
                          a.type === "block" && "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--border)_6px,var(--border)_7px)]",
                        )}
                        style={{ top, height }}
                      >
                        <p className="truncate font-medium">{a.title}</p>
                        {height > 36 && (
                          <p className="truncate opacity-80">
                            {a.startLocal}–{a.endLocal}
                            {a.service ? ` · ${a.service}` : ""}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AppointmentDialog
        key={`${newOpen?.profileId ?? "any"}-${newOpen?.time ?? ""}-${newOpen ? "open" : "closed"}`}
        date={date}
        open={!!newOpen}
        initial={newOpen}
        onOpenChange={(open) => !open && setNewOpen(null)}
        professionals={professionals}
        resources={resources}
        services={services}
      />
      <BlockDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        date={date}
        professionals={professionals}
      />
      <DetailDialog
        appointment={detail}
        canManage={canManage}
        onOpenChange={(open) => !open && setDetail(null)}
      />
    </div>
  );
}

function AppointmentDialog({
  date,
  open,
  initial,
  onOpenChange,
  professionals,
  resources,
  services,
}: {
  date: string;
  open: boolean;
  initial: { profileId?: string; time?: string } | null;
  onOpenChange: (open: boolean) => void;
  professionals: AgendaProfessional[];
  resources: Resource[];
  services: Service[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string; rut: string | null }[]>([]);
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [profileId, setProfileId] = useState(initial?.profileId ?? professionals[0]?.id ?? "");
  const [serviceId, setServiceId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [time, setTime] = useState(initial?.time ?? "09:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (term.trim().length < 2) return;
    const handle = setTimeout(async () => setResults(await searchPatients(term)), 250);
    return () => clearTimeout(handle);
  }, [term]);

  function save() {
    if (!patient) { toast.error("Selecciona una paciente."); return; }
    if (!serviceId) { toast.error("Selecciona un servicio."); return; }
    startTransition(async () => {
      const result = await createAppointment({
        patientId: patient.id,
        profileId,
        serviceId,
        resourceId,
        start: `${date}T${time}`,
        notes,
      });
      if (result.error) { toast.error(result.error); return; }
      if (result.fieldErrors) { toast.error(Object.values(result.fieldErrors)[0]); return; }
      toast.success("Cita agendada");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
          <DialogDescription>
            {date} · el sistema calcula la duración según el servicio.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="patient-search">Paciente</Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>{patient.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <Input id="patient-search" placeholder="Busca por nombre o RUT" value={term} onChange={(e) => setTerm(e.target.value)} />
                {results.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-lg border border-border">
                    {results.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setPatient({ id: r.id, name: r.full_name });
                            setResults([]);
                          }}
                        >
                          {r.full_name} {r.rut && <span className="text-muted-foreground">· {r.rut}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Profesional</Label>
              <Select value={profileId} onValueChange={(v) => setProfileId(v ?? "")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start-time">Hora</Label>
              <Input id="start-time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Servicio</Label>
            <Select value={serviceId || undefined} onValueChange={(v) => setServiceId(v ?? "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Elige un servicio" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {resources.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Cabina o máquina (opcional)</Label>
              <Select value={resourceId || undefined} onValueChange={(v) => setResourceId(v ?? "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({
  open,
  onOpenChange,
  date,
  professionals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  professionals: AgendaProfessional[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [profileId, setProfileId] = useState(professionals[0]?.id ?? "");
  const [time, setTime] = useState("13:00");
  const [duration, setDuration] = useState("60");
  const [reason, setReason] = useState("");

  function save() {
    startTransition(async () => {
      const result = await createBlock({ profileId, start: `${date}T${time}`, durationMinutes: Number(duration), reason });
      if (result.error) { toast.error(result.error); return; }
      if (result.fieldErrors) { toast.error(Object.values(result.fieldErrors)[0]); return; }
      toast.success("Horario bloqueado");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bloquear horario</DialogTitle>
          <DialogDescription>Para almuerzos, capacitaciones o mantención de equipos.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Profesional</Label>
            <Select value={profileId} onValueChange={(v) => setProfileId(v ?? "")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-time">Desde</Label>
              <Input id="block-time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-duration">Minutos</Label>
              <Input id="block-duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-reason">Motivo</Label>
            <Input id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Almuerzo" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={isPending || reason.trim().length < 2}>
            {isPending && <Loader2 className="animate-spin" />}
            Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ALL_STATUSES: AgendaAppointment["status"][] = ["confirmed", "checked_in", "in_progress", "completed", "no_show", "cancelled"];
const PROFESSIONAL_STATUSES: AgendaAppointment["status"][] = ["checked_in", "in_progress", "completed"];

function DetailDialog({
  appointment,
  canManage,
  onOpenChange,
}: {
  appointment: AgendaAppointment | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const allowed = canManage ? ALL_STATUSES : PROFESSIONAL_STATUSES;

  function changeStatus(status: AgendaAppointment["status"]) {
    if (!appointment) return;
    startTransition(async () => {
      const result = await setAppointmentStatus({ appointmentId: appointment.id, status });
      if (result.error) { toast.error(result.error); return; }
      toast.success(`Estado: ${STATUS_LABEL[status]}`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={!!appointment} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {appointment && (
          <>
            <DialogHeader>
              <DialogTitle>{appointment.title}</DialogTitle>
              <DialogDescription>
                {appointment.startLocal}–{appointment.endLocal}
                {appointment.service ? ` · ${appointment.service}` : ""}
                {appointment.resource ? ` · ${appointment.resource}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Badge variant="secondary" className="w-fit">{STATUS_LABEL[appointment.status]}</Badge>
              {appointment.type === "block" ? (
                <p className="text-sm text-muted-foreground">Horario bloqueado.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {allowed
                    .filter((s) => s !== appointment.status)
                    .map((s) => (
                      <Button key={s} variant="outline" size="sm" disabled={isPending} onClick={() => changeStatus(s)}>
                        {STATUS_LABEL[s]}
                      </Button>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
