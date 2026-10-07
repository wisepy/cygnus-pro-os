import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Zona horaria de la clínica. Todo se guarda en UTC y se muestra en esta zona. */
export const CLINIC_TZ = "America/Santiago";

/** Rango UTC [inicio, fin) de un día calendario de la clínica (YYYY-MM-DD). */
export function dayBounds(dateStr: string) {
  const start = fromZonedTime(`${dateStr} 00:00:00`, CLINIC_TZ);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Convierte "YYYY-MM-DDTHH:mm" (hora de Chile) a Date UTC. */
export function localToUtc(localDateTime: string): Date {
  return fromZonedTime(localDateTime.length === 16 ? `${localDateTime}:00` : localDateTime, CLINIC_TZ);
}

export function todayInClinic(): string {
  return formatInTimeZone(new Date(), CLINIC_TZ, "yyyy-MM-dd");
}

export function formatClinicTime(date: Date): string {
  return formatInTimeZone(date, CLINIC_TZ, "HH:mm");
}

export function formatClinicDate(date: Date): string {
  return formatInTimeZone(date, CLINIC_TZ, "dd-MM-yyyy");
}
