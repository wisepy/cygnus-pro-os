"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { savePatient } from "../actions";
import type { PatientInput } from "@/lib/validations/patient";

export type PatientFormValues = {
  id?: string;
  fullName: string;
  rut: string;
  birthDate: string;
  gender: "F" | "M" | "";
  phone: string;
  email: string;
  address: string;
  comuna: string;
  referredBy: string;
  notes: string;
};

const EMPTY: PatientFormValues = {
  fullName: "",
  rut: "",
  birthDate: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  comuna: "",
  referredBy: "",
  notes: "",
};

export function PatientFormDialog({
  initial,
  trigger,
  canSeeNotes = true,
}: {
  initial?: PatientFormValues;
  trigger?: React.ReactNode;
  canSeeNotes?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PatientFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const payload: PatientInput = { ...values, gender: values.gender };
      const result = await savePatient(payload);
      if (result.error) { toast.error(result.error); return; }
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        return;
      }
      toast.success(values.id ? "Ficha actualizada" : "Paciente registrada");
      setOpen(false);
      setErrors({});
      if (!values.id) setValues(EMPTY);
      router.refresh();
    });
  }

  const field = (id: keyof PatientFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`p-${id}`}>{label}</Label>
      <Input
        id={`p-${id}`}
        value={values[id] as string}
        onChange={(e) => set(id, e.target.value as never)}
        aria-invalid={!!errors[id]}
        {...props}
      />
      {errors[id] && <p className="text-xs text-destructive">{errors[id]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ?? (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Nueva paciente
        </Button>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{values.id ? "Editar ficha" : "Nueva paciente"}</DialogTitle>
          <DialogDescription>Los datos clínicos se registran después, en la ficha.</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
          <div className="col-span-2">{field("fullName", "Nombre completo")}</div>
          {field("rut", "RUT", { placeholder: "12345678-9" })}
          {field("birthDate", "Fecha de nacimiento", { type: "date" })}
          <div className="flex flex-col gap-1.5">
            <Label>Género</Label>
            <Select value={values.gender || undefined} onValueChange={(v) => set("gender", (v ?? "") as "F" | "M" | "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Sin dato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Femenino</SelectItem>
                <SelectItem value="M">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {field("phone", "Teléfono", { placeholder: "+56 9 1234 5678" })}
          {field("email", "Correo", { type: "email" })}
          {field("comuna", "Comuna")}
          {field("address", "Dirección")}
          {field("referredBy", "Referida por")}
          {canSeeNotes && (
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="p-notes">Notas administrativas</Label>
              <Textarea id="p-notes" rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={isPending || values.fullName.trim().length < 2}>
            {isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
