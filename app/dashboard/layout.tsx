import type { RowDataPacket } from "mysql2/promise";
import { requireProfile } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { navForRole } from "@/lib/nav";
import { Sidebar } from "@/components/shared/sidebar";
import { Topbar } from "@/components/shared/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const clinic = await queryOne<RowDataPacket & { name: string }>(
    "SELECT name FROM clinics WHERE id = ?",
    [profile.clinicId],
  );

  const items = navForRole(profile.role);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar items={items} clinicName={clinic?.name ?? "Clínica Cygnus"} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar items={items} fullName={profile.fullName} role={profile.role} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
