"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/settings/usuarios", label: "Usuarios" },
  { href: "/dashboard/settings/servicios", label: "Servicios" },
  { href: "/dashboard/settings/recursos", label: "Cabinas y máquinas" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-border">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
