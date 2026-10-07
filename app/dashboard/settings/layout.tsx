import { requireProfile, assertRole } from "@/lib/auth";
import { SettingsTabs } from "@/components/shared/settings-tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  assertRole(profile, ["admin"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground">Staff, roles y catálogo de servicios de la clínica.</p>
      </div>

      <SettingsTabs />

      {children}
    </div>
  );
}
