// Tipos de las filas de MySQL (ver db/schema.sql). Los nombres de campo
// se mantienen en snake_case para que coincidan con las consultas SQL.

export type UserRole = "admin" | "recepcion" | "profesional" | "caja";
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";
export type PaymentMethod = "efectivo" | "transferencia" | "debito" | "credito";
export type PaymentStatus = "completed" | "refunded" | "voided";
export type CashRegisterStatus = "open" | "closed";
export type TreatmentPlanStatus = "active" | "completed" | "paused" | "cancelled";
export type AlertType = "allergy" | "condition" | "medication" | "contraindication";
export type AlertSeverity = "low" | "medium" | "high";
export type CommissionRateType = "percentage" | "fixed";
export type OpportunityType = "cross_sell" | "retention" | "follow_up";
export type OpportunityStatus = "pending" | "contacted" | "converted" | "dismissed";
export type PricingType = "fixed" | "by_zone";
export type PhotoType = "before" | "after" | "progress";

export type ClinicRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  brand: unknown;
  created_at: Date;
};

export type ProfileRow = {
  id: string;
  clinic_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  is_bookable: boolean;
  color_hex: string;
  specialty: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: Date;
};

export type ServiceCategoryRow = {
  id: string;
  clinic_id: string;
  name: string;
  sort_order: number;
  created_at: Date;
};

export type ServiceRow = {
  id: string;
  clinic_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  duration_minutes: number;
  base_price: number;
  is_package: boolean;
  package_sessions_count: number | null;
  pricing_type: PricingType;
  active: boolean;
  created_at: Date;
};

export type ServiceZonePriceRow = {
  id: string;
  service_id: string;
  zone_name: string;
  price: number;
  sort_order: number;
  created_at: Date;
};

export type CommissionRateRow = {
  id: string;
  clinic_id: string;
  profile_id: string;
  service_id: string | null;
  rate_type: CommissionRateType;
  rate_value: number;
  effective_from: string;
  created_at: Date;
};

export type PatientRow = {
  id: string;
  clinic_id: string;
  full_name: string;
  rut: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  referred_by: string | null;
  notes: string | null;
  created_at: Date;
};

export type MedicalAlertRow = {
  id: string;
  patient_id: string;
  type: AlertType;
  severity: AlertSeverity;
  description: string;
  is_active: boolean;
  created_at: Date;
};

export type TreatmentPlanRow = {
  id: string;
  patient_id: string;
  service_id: string;
  total_sessions: number;
  sessions_completed: number;
  status: TreatmentPlanStatus;
  started_at: string;
  created_at: Date;
};

export type AppointmentRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  profile_id: string;
  service_id: string;
  treatment_plan_id: string | null;
  start_at: Date;
  end_at: Date;
  status: AppointmentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
};

export type TreatmentSessionRow = {
  id: string;
  treatment_plan_id: string | null;
  patient_id: string;
  appointment_id: string | null;
  profile_id: string;
  session_number: number | null;
  evolution_notes: string | null;
  parameters: unknown;
  created_at: Date;
};

export type SessionPhotoRow = {
  id: string;
  treatment_session_id: string;
  storage_path: string;
  photo_type: PhotoType;
  created_at: Date;
};

export type CashRegisterRow = {
  id: string;
  clinic_id: string;
  opened_by: string;
  opened_at: Date;
  opening_amount: number;
  closed_by: string | null;
  closed_at: Date | null;
  closing_amount_declared: number | null;
  closing_amount_system: number | null;
  status: CashRegisterStatus;
  created_at: Date;
};

export type PaymentRow = {
  id: string;
  clinic_id: string;
  cash_register_id: string;
  appointment_id: string | null;
  patient_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
};

export type OpportunityRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  type: OpportunityType;
  suggested_service_id: string | null;
  reason: string;
  score: number;
  status: OpportunityStatus;
  converted_appointment_id: string | null;
  created_at: Date;
};

export type ServiceWithCategory = ServiceRow & {
  service_categories: Pick<ServiceCategoryRow, "id" | "name"> | null;
  service_zone_prices: ServiceZonePriceRow[];
};
