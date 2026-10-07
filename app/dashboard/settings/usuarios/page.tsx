import type { RowDataPacket } from "mysql2/promise";
import { requireProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/types/domain";
import { CreateStaffDialog } from "./_components/create-staff-dialog";
import { EditStaffDialog } from "./_components/edit-staff-dialog";

type StaffDbRow = RowDataPacket & {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  specialty: string | null;
  color_hex: string;
  is_bookable: number;
  active: number;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function UsuariosPage() {
  const profile = await requireProfile();

  const rows = await query<StaffDbRow>(
    `SELECT id, full_name, email, phone, role, specialty, color_hex, is_bookable, active
       FROM profiles
      WHERE clinic_id = ?
      ORDER BY full_name`,
    [profile.clinicId],
  );

  const staff = rows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    specialty: row.specialty,
    color_hex: row.color_hex,
    is_bookable: Boolean(row.is_bookable),
    active: Boolean(row.active),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{staff.length} personas con acceso al sistema.</p>
        <CreateStaffDialog />
      </div>

      {staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay staff registrado"
          description="Crea la primera cuenta para que tu equipo pueda ingresar al sistema."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <Avatar className="size-10 border-2" style={{ borderColor: member.color_hex }}>
                  <AvatarFallback style={{ backgroundColor: `${member.color_hex}22`, color: member.color_hex }}>
                    {initials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{member.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                {!member.active && (
                  <Badge variant="secondary" className="shrink-0">
                    Inactivo
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{ROLE_LABELS[member.role]}</Badge>
                {member.is_bookable && <Badge variant="secondary">Agendable</Badge>}
                {member.specialty && <Badge variant="secondary">{member.specialty}</Badge>}
              </div>

              <EditStaffDialog member={member} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
