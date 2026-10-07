-- Catálogo real de Clínica Cygnus (Listado de precios 2026). Idempotente: INSERT IGNORE.
-- Precios en CLP, lista sin descuento. Revisar: Depilación zona S aparece en 79.999 (los demás 79.990).
SET NAMES utf8mb4;

INSERT IGNORE INTO clinics (id, name, slug, timezone, brand) VALUES (
  '00000000-0000-4000-8000-000000000001', 'Clínica Cygnus', 'cygnus', 'America/Santiago',
  JSON_OBJECT('primary', '#D29D9E', 'accent', '#B37E7F', 'background', '#F4F0EB', 'foreground', '#424547'));

INSERT IGNORE INTO service_categories (id, clinic_id, name, sort_order) VALUES
  ('3fd4387b-558f-5572-8b7b-9bada87f82db', '00000000-0000-4000-8000-000000000001', 'Tratamientos Faciales', 1),
  ('77d7582a-8d3c-55e3-926d-88b437ac256f', '00000000-0000-4000-8000-000000000001', 'Tratamientos Corporales', 2),
  ('cbd34f98-653c-58e3-aad0-a7c1644e4603', '00000000-0000-4000-8000-000000000001', 'Masajes', 3),
  ('7729d765-b5ea-5380-b9bf-d4ed5530a3ec', '00000000-0000-4000-8000-000000000001', 'Depilación Láser', 4);

INSERT IGNORE INTO services (id, clinic_id, category_id, name, duration_minutes, base_price, pricing_type, is_package, package_sessions_count) VALUES
  ('d10ae16d-bee2-5566-b8af-8fe700d745fd', '00000000-0000-4000-8000-000000000001', '77d7582a-8d3c-55e3-926d-88b437ac256f', 'Tratamiento corporal reductivo / reafirmante / anticelulítico / drenaje linfático (12 sesiones)', 45, 299990, 'fixed', 1, 12),
  ('fa156c53-1cae-527c-b41c-d0ff4b75848c', '00000000-0000-4000-8000-000000000001', '77d7582a-8d3c-55e3-926d-88b437ac256f', 'Tratamiento corporal reductivo / reafirmante / anticelulítico / drenaje linfático (10 sesiones)', 45, 279990, 'fixed', 1, 10),
  ('848f97fa-152c-546f-99bf-bce40126f5ce', '00000000-0000-4000-8000-000000000001', '77d7582a-8d3c-55e3-926d-88b437ac256f', 'Tratamiento corporal reductivo / reafirmante / anticelulítico / drenaje linfático (8 sesiones)', 45, 249990, 'fixed', 1, 8),
  ('aa7ebf56-e8f4-54db-95b8-c8fa73b4d317', '00000000-0000-4000-8000-000000000001', '77d7582a-8d3c-55e3-926d-88b437ac256f', 'Tratamiento post operatorio zona S (1 sesión)', 45, 20000, 'fixed', 0, NULL),
  ('9c0306b7-5af4-5676-a5f0-b4c471ea1598', '00000000-0000-4000-8000-000000000001', '77d7582a-8d3c-55e3-926d-88b437ac256f', 'Tratamiento post operatorio zona M (1 sesión)', 45, 30000, 'fixed', 0, NULL),
  ('17db044d-ba49-5b3d-9483-53a1d8a64ab2', '00000000-0000-4000-8000-000000000001', '77d7582a-8d3c-55e3-926d-88b437ac256f', 'Tratamiento post operatorio zona L (1 sesión)', 45, 40000, 'fixed', 0, NULL),
  ('30edf8e2-9364-5bb4-805c-722d36cdba0c', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Hifu facial (2 sesiones)', 45, 179990, 'fixed', 1, 2),
  ('9677fd08-2e62-5304-bfb2-bb9623bcfb89', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Hifu Half Face (2 sesiones)', 45, 149990, 'fixed', 1, 2),
  ('d9ca93c6-7859-5f4e-a488-8a18cb865900', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Hifu papada (1 sesión)', 45, 39990, 'fixed', 0, NULL),
  ('b9ede6ce-1018-5f53-ae02-c90f5488eedf', '00000000-0000-4000-8000-000000000001', '77d7582a-8d3c-55e3-926d-88b437ac256f', 'Hifu corporal (1 sesión)', 45, 79990, 'fixed', 0, NULL),
  ('8ed095c1-8722-5927-83b4-84fdf1ee9285', '00000000-0000-4000-8000-000000000001', '77d7582a-8d3c-55e3-926d-88b437ac256f', 'Hifu corporal (2 sesiones)', 45, 129990, 'fixed', 1, 2),
  ('a1d74f6d-dcfd-5a09-9a10-28dce951cd3d', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Hifu + exosomas rostro (1 sesion de c/u)', 45, 199990, 'fixed', 0, 1),
  ('4e3196c9-0f8a-549c-9fd8-9a1d316c9f44', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Exosomas (1 sesion) Incluye 2 limpiezas de regalo', 45, 120000, 'fixed', 0, 1),
  ('742d33b8-a9cc-5746-8169-0038ebd8667d', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Exosomas (2 sesiones) Incluye 2 limpiezas de regalo', 45, 210000, 'fixed', 1, 2),
  ('08333fbe-1e07-5b15-8b37-b370750f791c', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Exosomas (3 sesiones) Incluye 2 limpiezas de regalo', 45, 270000, 'fixed', 1, 3),
  ('ff488533-f7f3-5262-8a23-f9ee37d9c62d', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Limpieza facial profunda (1 sesión)', 45, 34990, 'fixed', 0, NULL),
  ('8bab38f1-7991-5332-bd04-7e9dcd13336e', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Limpieza facial simple (1 sesión)', 45, 24990, 'fixed', 0, NULL),
  ('8684cb7e-c87f-5c6a-96a9-b5016ed9a782', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Microneedling (4 sesiones) incluye limpieza y RF', 45, 199990, 'fixed', 1, 4),
  ('aa21a2e6-c572-5c01-a6f0-d72c08f2368b', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Peeling químico facial (4 sesiones) Incluye 2 limpiezas de regalo', 45, 164990, 'fixed', 1, 4),
  ('b88932ab-ba9a-57f6-bef6-60bf8ef0833e', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Peeling químico facial (6 sesiones) Incluye 2 limpiezas de regalo', 45, 219990, 'fixed', 1, 6),
  ('73e5d881-dd0c-5ca5-83f5-d756c43db7e4', '00000000-0000-4000-8000-000000000001', '3fd4387b-558f-5572-8b7b-9bada87f82db', 'Rejuvenecimiento RF (12 sesiones) Incluye 3 limpiezas de regalo', 45, 299990, 'fixed', 1, 12),
  ('3555b625-ca7c-5332-8d0c-e83f81e40663', '00000000-0000-4000-8000-000000000001', 'cbd34f98-653c-58e3-aad0-a7c1644e4603', 'Masaje de relajación (50 min)', 50, 39990, 'fixed', 0, NULL),
  ('89753c54-d8f8-5085-aae5-8ce1a042e17c', '00000000-0000-4000-8000-000000000001', 'cbd34f98-653c-58e3-aad0-a7c1644e4603', 'Masaje descontracturante (50 min)', 50, 39990, 'fixed', 0, NULL),
  ('46173f5e-8441-5814-85f2-56782c4d8cfe', '00000000-0000-4000-8000-000000000001', 'cbd34f98-653c-58e3-aad0-a7c1644e4603', 'Masaje cráneo cérvico facial (30 min)', 30, 29990, 'fixed', 0, NULL),
  ('1c513d2d-d6f1-5def-9952-b5d3e37b7c83', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación bozo (6 sesiones)', 45, 59990, 'fixed', 1, 6),
  ('8f0dd161-e6f3-59cd-b1ab-3549eb90c8d1', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación axila (6 sesiones)', 45, 79990, 'fixed', 1, 6),
  ('01d6a4b1-5aa0-5617-ae6d-885fc9c5749b', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación rostro (6 sesiones)', 45, 139990, 'fixed', 1, 6),
  ('ea4b2644-d1c5-5ba1-bc30-0f52233ff098', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación brazo (6 sesiones)', 45, 139990, 'fixed', 1, 6),
  ('ef8cc905-f3b1-5794-8216-b77ebd12bea2', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación media pierna (6 sesiones)', 45, 139990, 'fixed', 1, 6),
  ('414367b2-1558-5ee6-9d3c-c7371bb6b3b2', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación rebaje (6 sesiones)', 45, 139990, 'fixed', 1, 6),
  ('7118ca74-c45d-513f-9011-47bafb84851b', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación pierna completa (6 sesiones)', 45, 249990, 'fixed', 1, 6),
  ('b14ebc50-56df-5caa-a72b-af64311128a0', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación zona XS (6 sesiones)', 45, 59990, 'fixed', 1, 6),
  ('4f0942b6-009b-50a9-9e8b-97ae12428fab', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación zona S (6 sesiones)', 45, 79999, 'fixed', 1, 6),
  ('ee4c9c19-3251-5f91-97bd-8c846f568c20', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación zona M (6 sesiones)', 45, 139990, 'fixed', 1, 6),
  ('8debfdfe-7443-5bfe-85cf-76902ea8f273', '00000000-0000-4000-8000-000000000001', '7729d765-b5ea-5380-b9bf-d4ed5530a3ec', 'Depilación zona L (6 sesiones)', 45, 249990, 'fixed', 1, 6);
