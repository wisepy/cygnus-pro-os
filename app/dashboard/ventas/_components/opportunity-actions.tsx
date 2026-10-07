"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateOpportunities, setOpportunityStatus } from "../actions";

export function OpportunityActions({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function set(status: "contacted" | "dismissed") {
    startTransition(async () => {
      const result = await setOpportunityStatus({ id, status });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(status === "contacted" ? "Marcada como contactada" : "Oportunidad descartada");
      router.refresh();
    });
  }

  return (
    <div className="mt-1 flex gap-2">
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => set("contacted")}>
        {isPending && <Loader2 className="animate-spin" />}
        Contactada
      </Button>
      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => set("dismissed")}>
        Descartar
      </Button>
    </div>
  );
}

export function GenerateButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await generateOpportunities();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.created ? `${result.created} oportunidades nuevas` : "No hay oportunidades nuevas");
      router.refresh();
    });
  }

  return (
    <Button onClick={run} disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      Generar oportunidades
    </Button>
  );
}
