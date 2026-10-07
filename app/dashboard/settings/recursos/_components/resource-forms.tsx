"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createResource, setResourceActive } from "../actions";

export function ResourceForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"box" | "machine">("box");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await createResource({ name, kind });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Recurso agregado");
      setName("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Agregar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva cabina o máquina</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resource-name">Nombre</Label>
              <Input id="resource-name" placeholder="Ej. Cabina 1 o Láser diodo" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind((v ?? "box") as "box" | "machine")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="box">Cabina</SelectItem>
                  <SelectItem value="machine">Máquina</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={isPending || name.trim().length < 2}>
              {isPending && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ResourceToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setResourceActive(id, !active);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={toggle}>
      {isPending && <Loader2 className="animate-spin" />}
      {active ? "Desactivar" : "Activar"}
    </Button>
  );
}
