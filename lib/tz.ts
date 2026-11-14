import "server-only";
import { cookies } from "next/headers";

export const TZ_COOKIE = "tz";

function valid(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The viewer's IANA time zone (set from their browser), or UTC until we know it. */
export async function getTimeZone(): Promise<string> {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  return valid(tz) ? tz : "UTC";
}

export function fmtDate(iso: string | Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
}

export function fmtDateTime(iso: string | Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(iso));
}

/** Long date used on letters, e.g. "November 14, 2026", for the given zone. */
export function longDate(tz: string, d = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "long", day: "numeric" }).format(d);
}
