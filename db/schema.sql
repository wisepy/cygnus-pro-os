-- ============================================================================
-- CYGNUS Pro/OS · esquema MySQL (Hostinger)
-- Ejecutar una vez sobre la base vacía. Todas las tablas son InnoDB utf8mb4.
-- La autorización por rol y clínica se aplica en el servidor (lib/auth.ts),
-- en cada consulta. No hay RLS en MySQL.
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS clinics (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Santiago',
  brand JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- profiles: también guarda las credenciales de acceso (email + hash de contraseña).
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  role ENUM('admin','recepcion','profesional','caja') NOT NULL DEFAULT 'recepcion',
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NULL,
  is_bookable TINYINT(1) NOT NULL DEFAULT 0,
  color_hex CHAR(7) NOT NULL DEFAULT '#D29D9E',
  specialty VARCHAR(120) NULL,
  avatar_url VARCHAR(500) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX profiles_clinic_idx (clinic_id),
  CONSTRAINT profiles_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT sc_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  category_id CHAR(36) NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  base_price DECIMAL(12,0) NOT NULL DEFAULT 0,
  is_package TINYINT(1) NOT NULL DEFAULT 0,
  package_sessions_count INT NULL,
  pricing_type ENUM('fixed','by_zone') NOT NULL DEFAULT 'fixed',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX services_clinic_idx (clinic_id),
  CONSTRAINT services_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT services_category_fk FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_zone_prices (
  id CHAR(36) NOT NULL PRIMARY KEY,
  service_id CHAR(36) NOT NULL,
  zone_name VARCHAR(160) NOT NULL,
  price DECIMAL(12,0) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT szp_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_providers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  service_id CHAR(36) NOT NULL,
  profile_id CHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY sp_unique (service_id, profile_id),
  CONSTRAINT sp_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT sp_profile_fk FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commission_rates (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  profile_id CHAR(36) NOT NULL,
  service_id CHAR(36) NULL,
  rate_type ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
  rate_value DECIMAL(12,2) NOT NULL,
  effective_from DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX cr_profile_idx (profile_id),
  CONSTRAINT cr_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT cr_profile_fk FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT cr_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patients (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  rut VARCHAR(20) NULL,
  birth_date DATE NULL,
  gender CHAR(1) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  address VARCHAR(255) NULL,
  comuna VARCHAR(120) NULL,
  referred_by VARCHAR(255) NULL,
  notes TEXT NULL,
  deleted_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX patients_clinic_idx (clinic_id),
  INDEX patients_name_idx (clinic_id, full_name),
  UNIQUE KEY patients_rut_unique (clinic_id, rut),
  CONSTRAINT patients_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medical_alerts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  patient_id CHAR(36) NOT NULL,
  type ENUM('allergy','condition','medication','contraindication') NOT NULL,
  severity ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX ma_patient_idx (patient_id),
  CONSTRAINT ma_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS treatment_plans (
  id CHAR(36) NOT NULL PRIMARY KEY,
  patient_id CHAR(36) NOT NULL,
  service_id CHAR(36) NOT NULL,
  total_sessions INT NOT NULL DEFAULT 1,
  sessions_completed INT NOT NULL DEFAULT 0,
  status ENUM('active','completed','paused','cancelled') NOT NULL DEFAULT 'active',
  started_at DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX tp_patient_idx (patient_id),
  CONSTRAINT tp_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT tp_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recursos físicos: cabinas y máquinas (láser, RF, HIFU...). Se reservan junto con el profesional.
CREATE TABLE IF NOT EXISTS resources (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  kind ENUM('box','machine') NOT NULL DEFAULT 'box',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY resources_name_unique (clinic_id, name),
  CONSTRAINT resources_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  patient_id CHAR(36) NULL,
  profile_id CHAR(36) NOT NULL,
  service_id CHAR(36) NULL,
  resource_id CHAR(36) NULL,
  treatment_plan_id CHAR(36) NULL,
  app_type ENUM('appointment','block') NOT NULL DEFAULT 'appointment',
  block_reason VARCHAR(255) NULL,
  start_at DATETIME(6) NOT NULL,
  end_at DATETIME(6) NOT NULL,
  status ENUM('scheduled','confirmed','checked_in','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX ap_profile_start_idx (profile_id, start_at),
  INDEX ap_clinic_start_idx (clinic_id, start_at),
  INDEX ap_patient_idx (patient_id),
  INDEX ap_resource_start_idx (resource_id, start_at),
  CONSTRAINT ap_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT ap_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  CONSTRAINT ap_profile_fk FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE RESTRICT,
  CONSTRAINT ap_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
  CONSTRAINT ap_resource_fk FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL,
  CONSTRAINT ap_plan_fk FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plans(id) ON DELETE SET NULL,
  CONSTRAINT ap_created_by_fk FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT ap_time_chk CHECK (end_at > start_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS treatment_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  treatment_plan_id CHAR(36) NULL,
  patient_id CHAR(36) NOT NULL,
  appointment_id CHAR(36) NULL,
  profile_id CHAR(36) NOT NULL,
  session_number INT NULL,
  evolution_notes TEXT NULL,
  parameters JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX ts_patient_idx (patient_id),
  CONSTRAINT ts_plan_fk FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plans(id) ON DELETE SET NULL,
  CONSTRAINT ts_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT ts_appointment_fk FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT ts_profile_fk FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_photos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  treatment_session_id CHAR(36) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  photo_type ENUM('before','after','progress') NOT NULL DEFAULT 'progress',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT sp_session_fk FOREIGN KEY (treatment_session_id) REFERENCES treatment_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_registers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  opened_by CHAR(36) NOT NULL,
  opened_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  opening_amount DECIMAL(12,0) NOT NULL DEFAULT 0,
  closed_by CHAR(36) NULL,
  closed_at DATETIME(6) NULL,
  closing_amount_declared DECIMAL(12,0) NULL,
  closing_amount_system DECIMAL(12,0) NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX cr_clinic_status_idx (clinic_id, status),
  CONSTRAINT crg_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT crg_opened_fk FOREIGN KEY (opened_by) REFERENCES profiles(id) ON DELETE RESTRICT,
  CONSTRAINT crg_closed_fk FOREIGN KEY (closed_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  cash_register_id CHAR(36) NOT NULL,
  appointment_id CHAR(36) NULL,
  patient_id CHAR(36) NULL,
  amount DECIMAL(12,0) NOT NULL,
  method ENUM('efectivo','transferencia','debito','credito') NOT NULL,
  status ENUM('completed','refunded','voided') NOT NULL DEFAULT 'completed',
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX pay_register_idx (cash_register_id),
  INDEX pay_clinic_created_idx (clinic_id, created_at),
  INDEX pay_appointment_idx (appointment_id),
  CONSTRAINT pay_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT pay_register_fk FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE RESTRICT,
  CONSTRAINT pay_appointment_fk FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT pay_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  CONSTRAINT pay_created_by_fk FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunities (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  patient_id CHAR(36) NOT NULL,
  type ENUM('cross_sell','retention','follow_up') NOT NULL,
  suggested_service_id CHAR(36) NULL,
  reason TEXT NOT NULL,
  score DECIMAL(5,2) NOT NULL DEFAULT 0,
  status ENUM('pending','contacted','converted','dismissed') NOT NULL DEFAULT 'pending',
  converted_appointment_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX opp_clinic_status_idx (clinic_id, status),
  CONSTRAINT opp_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT opp_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT opp_service_fk FOREIGN KEY (suggested_service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT opp_appointment_fk FOREIGN KEY (converted_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NULL,
  actor_id CHAR(36) NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(120) NOT NULL,
  entity_id CHAR(36) NULL,
  metadata JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX audit_clinic_idx (clinic_id, created_at),
  CONSTRAINT audit_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Productos con stock (venta en caja, como en el sistema anterior).
CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(12,0) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT products_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT products_stock_chk CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  cash_register_id CHAR(36) NOT NULL,
  patient_id CHAR(36) NULL,
  total DECIMAL(12,0) NOT NULL,
  method ENUM('efectivo','transferencia','debito','credito') NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX sales_register_idx (cash_register_id),
  CONSTRAINT sales_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT sales_register_fk FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE RESTRICT,
  CONSTRAINT sales_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  sale_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL,
  item_name VARCHAR(200) NOT NULL,
  unit_price DECIMAL(12,0) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  CONSTRAINT si_sale_fk FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT si_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Consentimientos: el texto se congela por versión; cada firma guarda la versión exacta aceptada.
CREATE TABLE IF NOT EXISTS consent_forms (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT cf_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patient_consents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  patient_id CHAR(36) NOT NULL,
  consent_form_id CHAR(36) NOT NULL,
  form_version INT NOT NULL,
  form_body_snapshot MEDIUMTEXT NOT NULL,
  signer_name VARCHAR(255) NOT NULL,
  signer_rut VARCHAR(20) NULL,
  signature_path VARCHAR(500) NULL,
  ip_hash CHAR(64) NULL,
  signed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX pc_patient_idx (patient_id),
  CONSTRAINT pc_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT pc_form_fk FOREIGN KEY (consent_form_id) REFERENCES consent_forms(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Encuesta de satisfacción (NPS) al terminar un pack o una atención.
CREATE TABLE IF NOT EXISTS nps_surveys (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  patient_id CHAR(36) NOT NULL,
  profile_id CHAR(36) NULL,
  score TINYINT NOT NULL,
  comment TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT nps_score_chk CHECK (score BETWEEN 0 AND 10),
  CONSTRAINT nps_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT nps_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT nps_profile_fk FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registro de eliminaciones (derechos ARCO). Es solo de inserción: los triggers bloquean
-- UPDATE y DELETE, incluso para el dueño del centro.
CREATE TABLE IF NOT EXISTS deletion_log (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  patient_ref CHAR(64) NOT NULL,
  actor_id CHAR(36) NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
CREATE TRIGGER deletion_log_no_update BEFORE UPDATE ON deletion_log FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'deletion_log es de solo lectura'; END$$
CREATE TRIGGER deletion_log_no_delete BEFORE DELETE ON deletion_log FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'deletion_log es de solo lectura'; END$$
DELIMITER ;

-- Bloqueo contra fuerza bruta en el login.
CREATE TABLE IF NOT EXISTS login_attempts (
  id CHAR(64) NOT NULL PRIMARY KEY,
  failures INT NOT NULL DEFAULT 0,
  locked_until DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
