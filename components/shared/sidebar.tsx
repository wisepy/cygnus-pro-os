import { NavLinks } from "@/components/shared/nav-links";
import type { NavItem } from "@/lib/nav";

export function Sidebar({ items, clinicName }: { items: NavItem[]; clinicName: string }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 font-heading text-lg font-semibold text-primary">
          C
        </div>
        <div>
          <p className="font-heading text-lg leading-none font-semibold text-foreground">Cygnus</p>
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Pro/OS</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <NavLinks items={items} />
      </div>

      <div className="border-t border-sidebar-border px-4 py-4">
        <p className="text-xs text-muted-foreground">{clinicName}</p>
      </div>
    </aside>
  );
}
