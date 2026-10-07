# CYGNUS Pro/OS

Sistema de gestión de Clínica Cygnus: agenda por profesional, ficha por paciente con recomendaciones, caja, comisiones, ventas y reportes. Next.js 16 + MySQL (Hostinger).

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # completa DATABASE_URL y AUTH_SECRET
npm run dev
npm test                            # pruebas de comisiones y ficha inteligente
```

## Variables de entorno (en hPanel → Node.js app, y en .env.local)

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | `mysql://usuario:clave@host:3306/base` (hPanel → Bases de datos) |
| `AUTH_SECRET` | Al menos 32 caracteres aleatorios. Genera uno: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NODE_ENV` | `production` |

## Primera puesta en marcha

1. Instala y compila en el servidor: `npm ci && npm run build`.
2. Crea las tablas y el catálogo (una sola vez; es idempotente): `npm run db:migrate`.
3. Crea el usuario administrador: `npm run db:admin -- "correo@clinica.cl" "clave-de-10-o-mas" "Nombre Completo"`.
4. Importa pacientes (opcional). Primero en modo prueba: `npm run db:import -- "ruta/pacientes_importables_cygnus.csv" --dry-run`. Luego sin `--dry-run`.
5. Arranca la app: `npm start` (usa la variable `PORT`).

## Seguridad

- Autorización por rol y clínica en cada acción del servidor. Nada depende solo de ocultar botones.
- Consentimientos guardan el texto exacto firmado y su versión.
- Eliminación de pacientes (ARCO) deja constancia en `deletion_log`, que no admite UPDATE ni DELETE.
- Cookies httpOnly y firmadas, sesión de 12 horas, bloqueo tras 5 intentos fallidos.
- Cabeceras de seguridad (CSP, HSTS, anti-clickjacking) configuradas en `next.config.ts`.

## Pendiente

- Antes/después, carnet del paciente y encuesta NPS (hoja de ruta acordada con la clínica).
- Migración del sistema anterior (`u362750072_cygnus`).
