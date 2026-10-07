"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Stethoscope,
  Wallet,
  Users,
  TrendingUp,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem, NavIconName } from "@/lib/nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: LayoutDashboard,
  calendar: CalendarDays,
  stethoscope: Stethoscope,
  wallet: Wallet,
  users: Users,
  "trending-up": TrendingUp,
  "bar-chart": BarChart3,
  settings: Settings,
};

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("size-4", isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
