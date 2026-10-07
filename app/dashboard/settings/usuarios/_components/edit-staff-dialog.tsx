"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { updateStaffSchema, ROLE_OPTIONS, type UpdateStaffInput } from "@/lib/validations/profile";
import { ROLE_LABELS } from "@/lib/roles";
import type { ProfileRow } from "@/types/domain";
import { updateStaff } from "../actions";

const DEFAULT_COLORS = ["#D29D9E", "#8FA37E", "#8C7FA6", "#CBA135", "#B37E7F", "#7A7573"];

export function EditStaffDialog({ member }: { member: Pick<ProfileRow, "id" | "full_name" | "phone" | "role" | "specialty" | "color_hex" | "is_bookable" | "active"> }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateStaffInput>({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: {
      profileId: member.id,
      fullName: member.full_name,
      role: member.role,
      phone: member.phone ?? "",
      specialty: member.specialty ?? "",
      colorHex: member.color_hex,
      isBookable: member.is_bookable,
      active: member.active,
    },
  });

  function onSubmit(values: UpdateStaffInput) {
    startTransition(async () => {
      const result = await updateStaff(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.fieldErrors) {
        for (const [key, message] of Object.entries(result.fieldErrors)) {
          form.setError(key as keyof UpdateStaffInput, { message });
        }
        return;
      }
      toast.success("Usuario actualizado");
      setOpen(false);
    });
  }

  const role = form.watch("role");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Pencil />
        Editar
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="edit-fullName">Nombre completo</Label>
              <Input id="edit-fullName" {...form.register("fullName")} aria-invalid={!!form.formState.errors.fullName} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(value) => form.setValue("role", value as UpdateStaffInput["role"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ROLE_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-phone">Teléfono</Label>
              <Input id="edit-phone" {...form.register("phone")} />
            </div>

            {role === "profesional" && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="edit-specialty">Especialidad</Label>
                <Input id="edit-specialty" {...form.register("specialty")} />
              </div>
            )}

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Color en agenda</Label>
              <div className="flex items-center gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => form.setValue("colorHex", color)}
                    className="size-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: form.watch("colorHex") === color ? "var(--foreground)" : "transparent",
                    }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">Agendable</p>
              <Switch
                checked={form.watch("isBookable")}
                onCheckedChange={(checked) => form.setValue("isBookable", checked)}
              />
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Cuenta activa</p>
                <p className="text-xs text-muted-foreground">Desactiva para revocar el acceso sin eliminar</p>
              </div>
              <Switch checked={form.watch("active")} onCheckedChange={(checked) => form.setValue("active", checked)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
