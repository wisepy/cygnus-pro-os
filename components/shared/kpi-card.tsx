"use client";

import { motion } from "framer-motion";
import { DollarSign, CalendarCheck, Users2, TrendingUp, type LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";

// Nombre del ícono, no la función: un Server Component no puede pasarle una
// referencia de función a un Client Component como este.
export type KpiIconName = "dollar" | "calendar-check" | "users" | "trending-up";

const ICONS: Record<KpiIconName, LucideIcon> = {
  dollar: DollarSign,
  "calendar-check": CalendarCheck,
  users: Users2,
  "trending-up": TrendingUp,
};

type KpiCardProps = {
  label: string;
  value: number | null;
  prefix?: string;
  suffix?: string;
  icon: KpiIconName;
  hint?: string;
  live?: boolean;
  accent?: "primary" | "success" | "warning" | "info";
};

const ACCENTS: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  primary: "bg-primary/12 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
};

export function KpiCard({ label, value, prefix, suffix, icon, hint, live, accent = "primary" }: KpiCardProps) {
  const animated = useCountUp(value ?? 0);
  const Icon = ICONS[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm shadow-primary/5"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-xl", ACCENTS[accent])}>
          <Icon className="size-4.5" />
        </span>
      </div>

      <p className="mt-4 font-heading text-4xl font-semibold tracking-tight text-foreground tabular-nums">
        {value === null ? "—" : (
          <>
            {prefix}
            {animated.toLocaleString("es-CL")}
            {suffix}
          </>
        )}
      </p>

      <div className="mt-2 flex items-center gap-1.5">
        {live && (
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
        )}
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </motion.div>
  );
}
