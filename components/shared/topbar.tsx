"use client";

import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NavLinks } from "@/components/shared/nav-links";
import type { NavItem } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/types/domain";
import { signOut } from "@/app/dashboard/actions";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Topbar({
  items,
  fullName,
  role,
}: {
  items: NavItem[];
  fullName: string;
  role: UserRole;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:justify-end lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" />}>
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <div className="flex items-center gap-2 px-5 py-6">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 font-heading text-lg font-semibold text-primary">
              C
            </div>
            <div>
              <p className="font-heading text-lg leading-none font-semibold text-foreground">Cygnus</p>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Pro/OS</p>
            </div>
          </div>
          <div className="px-3">
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm leading-none font-medium text-foreground">{fullName}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
        </div>
        <Avatar className="size-9 border border-border">
          <AvatarFallback className="bg-accent text-accent-foreground">{initials(fullName)}</AvatarFallback>
        </Avatar>
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit" title="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
