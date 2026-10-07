"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { serviceSchema, type ServiceFormInput, type ServiceInput } from "@/lib/validations/service";
import type { ServiceCategoryRow, ServiceWithCategory } from "@/types/domain";
import { saveService } from "../actions";

export function ServiceFormDialog({
  categories,
  service,
}: {
  categories: Pick<ServiceCategoryRow, "id" | "name">[];
  service?: ServiceWithCategory;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEdit = !!service;

  const form = useForm<ServiceFormInput, unknown, ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: service
      ? {
          id: service.id,
          categoryId: service.category_id ?? "",
          name: service.name,
          description: service.description ?? "",
          durationMinutes: service.duration_minutes,
          pricingType: service.pricing_type,
          basePrice: service.base_price,
          isPackage: service.is_package,
          packageSessionsCount: service.package_sessions_count ?? undefined,
          zonePrices: service.service_zone_prices.map((z) => ({ zoneName: z.zone_name, price: z.price })),
          active: service.active,
        }
      : {
          categoryId: categories[0]?.id ?? "",
          name: "",
          description: "",
          durationMinutes: 30,
          pricingType: "fixed",
          basePrice: 0,
          isPackage: false,
          zonePrices: [],
          active: true,
        },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "zonePrices" });

  function onSubmit(values: ServiceInput) {
    startTransition(async () => {
      const result = await saveService(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.fieldErrors) {
        for (const [key, message] of Object.entries(result.fieldErrors)) {
          form.setError(key as keyof ServiceInput, { message });
        }
        return;
      }
      toast.success(isEdit ? "Servicio actualizado" : "Servicio creado");
      if (!isEdit) form.reset();
      setOpen(false);
    });
  }

  const pricingType = form.watch("pricingType");
  const isPackage = form.watch("isPackage");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil />
          Editar
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Nuevo servicio
        </Button>
      )}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="service-name">Nombre</Label>
            <Input id="service-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="service-description">Descripción</Label>
            <Textarea id="service-description" rows={2} {...form.register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Categoría</Label>
              <Select
                value={form.watch("categoryId") || undefined}
                onValueChange={(value) => form.setValue("categoryId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="service-duration">Duración (min)</Label>
              <Input id="service-duration" type="number" {...form.register("durationMinutes")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tipo de precio</Label>
            <Select
              value={pricingType}
              onValueChange={(value) => form.setValue("pricingType", value as ServiceInput["pricingType"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Precio fijo</SelectItem>
                <SelectItem value="by_zone">Por zona (ej. depilación láser)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pricingType === "fixed" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="service-price">Precio (CLP)</Label>
              <Input id="service-price" type="number" {...form.register("basePrice")} />
              {form.formState.errors.basePrice && (
                <p className="text-xs text-destructive">{form.formState.errors.basePrice.message}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>Precios por zona</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input placeholder="Nombre de zona" {...form.register(`zonePrices.${index}.zoneName`)} />
                  <Input
                    type="number"
                    placeholder="Precio"
                    className="w-32"
                    {...form.register(`zonePrices.${index}.price`)}
                  />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => append({ zoneName: "", price: 0 })}
              >
                <Plus className="size-3.5" />
                Agregar zona
              </Button>
              {form.formState.errors.zonePrices && (
                <p className="text-xs text-destructive">{form.formState.errors.zonePrices.message as string}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Es un pack de sesiones</p>
              <p className="text-xs text-muted-foreground">Ej. &ldquo;6 sesiones&rdquo; de depilación láser</p>
            </div>
            <Switch checked={isPackage} onCheckedChange={(checked) => form.setValue("isPackage", checked)} />
          </div>

          {isPackage && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="service-sessions">Número de sesiones</Label>
              <Input id="service-sessions" type="number" {...form.register("packageSessionsCount")} />
              {form.formState.errors.packageSessionsCount && (
                <p className="text-xs text-destructive">{form.formState.errors.packageSessionsCount.message}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <p className="text-sm font-medium text-foreground">Servicio activo</p>
            <Switch checked={form.watch("active")} onCheckedChange={(checked) => form.setValue("active", checked)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear servicio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
