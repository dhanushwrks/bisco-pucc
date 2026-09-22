export const IST = "Asia/Kolkata";

/** Today's date in IST as YYYY-MM-DD. */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86_400_000);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: iso.length === 10 ? "UTC" : IST });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: IST });
}

/** KA19HL6177 → KA 19 HL 6177 for readability. */
export function fmtPlate(v: string): string {
  const bh = v.match(/^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/);
  if (bh) return bh.slice(1).join(" ");
  const m = v.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  return m ? m.slice(1).filter(Boolean).join(" ") : v;
}

export function fmtMobile(m: string | null): string {
  return m ? `${m.slice(0, 5)} ${m.slice(5)}` : "—";
}

export type Validity = "valid" | "expiring" | "expired" | "unknown";
export function validity(validUntil: string | null, today = todayIST()): { state: Validity; days: number | null } {
  if (!validUntil) return { state: "unknown", days: null };
  const days = daysBetween(today, validUntil);
  return { state: days < 0 ? "expired" : days <= 30 ? "expiring" : "valid", days };
}
