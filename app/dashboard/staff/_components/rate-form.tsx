"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addCommissionRate } from "../actions";

export function RateForm({
  professionals,
  services,
}: {
  professionals: { id: string; name: string }[];
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });
  const [profileId, setProfileId] = useState(professionals[0]?.id ?? "");
  const [serviceId, setServiceId] = useState("__default");
  const [rateType, setRateType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [from, setFrom] = useState(today);

  function save() {
    startTransition(async () => {
      const result = await addCommissionRate({
        profileId,
        serviceId: serviceId === "__default" ? "" : serviceId,
        rateType,
        rateValue: Number(value),
        effectiveFrom: from,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Tasa guardada. Aplica desde la fecha indicada.");
      setValue("");
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-heading text-lg font-medium text-foreground">Tasas de comisión</h2>
        <p className="text-sm text-muted-foreground">
          Cada cambio se agrega como una tasa nueva con fecha de vigencia. Los pagos anteriores conservan la tasa que les correspondía.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="flex flex-col gap-1.5 xl:col-span-2">
          <Label>Profesional</Label>
          <Select value={profileId || undefined} onValueChange={(v) => setProfileId(v ?? "")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 xl:col-span-2">
          <Label>Servicio</Label>
          <Select value={serviceId} onValueChange={(v) => setServiceId(v ?? "__default")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">Tasa por defecto (todos)</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Tipo</Label>
          <Select value={rateType} onValueChange={(v) => setRateType((v ?? "percentage") as "percentage" | "fixed")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Porcentaje</SelectItem>
              <SelectItem value="fixed">Monto fijo por cita</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rate-value">{rateType === "percentage" ? "%" : "CLP"}</Label>
          <Input id="rate-value" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rate-from">Vigente desde</Label>
          <Input id="rate-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button disabled={isPending || !profileId || value === ""} onClick={save}>
          {isPending && <Loader2 className="animate-spin" />}
          Guardar tasa
        </Button>
      </div>
    </Card>
  );
}
