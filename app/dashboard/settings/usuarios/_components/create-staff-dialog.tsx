"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createStaffSchema, ROLE_OPTIONS, type CreateStaffInput } from "@/lib/validations/profile";
import { ROLE_LABELS } from "@/lib/roles";
import { createStaff } from "../actions";

const DEFAULT_COLORS = ["#D29D9E", "#8FA37E", "#8C7FA6", "#CBA135", "#B37E7F", "#7A7573"];

export function CreateStaffDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      role: "recepcion",
      phone: "",
      specialty: "",
      colorHex: DEFAULT_COLORS[0],
      isBookable: false,
    },
  });

  function onSubmit(values: CreateStaffInput) {
    startTransition(async () => {
      const result = await createStaff(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.fieldErrors) {
        for (const [key, message] of Object.entries(result.fieldErrors)) {
          form.setError(key as keyof CreateStaffInput, { message });
        }
        return;
      }
      toast.success("Usuario creado correctamente");
      form.reset();
      setOpen(false);
    });
  }

  const role = form.watch("role");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus />
        Nuevo usuario
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>Crea una cuenta de acceso para el staff de la clínica.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" {...form.register("fullName")} aria-invalid={!!form.formState.errors.fullName} />
              {form.formState.errors.fullName && (
                <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña temporal</Label>
              <Input
                id="password"
                type="password"
                {...form.register("password")}
                aria-invalid={!!form.formState.errors.password}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(value) => form.setValue("role", value as CreateStaffInput["role"])}>
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
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>

            {role === "profesional" && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="specialty">Especialidad</Label>
                <Input id="specialty" placeholder="Ej. Cosmetóloga" {...form.register("specialty")} />
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
              <div>
                <p className="text-sm font-medium text-foreground">Agendable</p>
                <p className="text-xs text-muted-foreground">Aparece como columna en la Agenda</p>
              </div>
              <Switch
                checked={form.watch("isBookable")}
                onCheckedChange={(checked) => form.setValue("isBookable", checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
