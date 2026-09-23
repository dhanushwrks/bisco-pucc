import * as XLSX from "xlsx";

export type CertRow = {
  pucc_no: string;
  vehicle_no: string;
  mobile: string | null;
  fuel: string | null;
  model: string | null;
  engine: string | null;
  test_date: string;
  valid_until: string;
  result: string | null;
  km: number | null;
  hsu: number | null;
  co: number | null;
  hc: number | null;
};

export type RowIssue = { row: number; vehicle?: string; reason: string };

export type ParseResult = {
  rows: CertRow[];
  rejected: RowIssue[];
  warnings: RowIssue[];
  fileRange: { from: string; to: string } | null;
  licences: string[];
};

const REQUIRED = ["VEHICLE_NO", "PUCC_NO", "TESTDATE", "VALIDDATE"] as const;

/** Uppercase, strip everything that isn't a letter or digit. */
export const normalizePlate = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const PLATE = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/; // KA19HL6177, DL3CAB1234, KA011234
const BH_PLATE = /^\d{2}BH\d{4}[A-Z]{1,2}$/; // 22BH1234AA
export const isValidPlate = (v: string) => v.length >= 6 && v.length <= 12 && (PLATE.test(v) || BH_PLATE.test(v));

/** Returns a 10-digit Indian mobile or null. Accepts +91 / 0 prefixes and separators. */
export function normalizeMobile(v: unknown): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Accepts Date, Excel serial, YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY. */
export function toISODate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(+v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return valid(+m[3], +m[2], +m[1]);
  return null;
}
function valid(y: number, mo: number, d: number) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
    ? `${y}-${pad(mo)}-${pad(d)}`
    : null;
}

const num = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};
export const normalizeLicence = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Parse and validate a PUCC export.
 * @param outletLicence rows whose LICENCE_NO differs are rejected (wrong outlet's file)
 * @param period rows with a test date outside this range are rejected
 */
export function parseCertificates(
  buf: ArrayBuffer,
  opts: { outletLicence?: string | null; period?: { from: string; to: string } | null } = {},
): ParseResult {
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("The file has no sheets.");
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });

  // header map: case/space-insensitive
  const rows = raw.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) o[k.toUpperCase().replace(/[^A-Z0-9]/g, "")] = v;
    return o;
  });
  const key = (k: string) => k.replace(/_/g, "");
  if (rows.length) {
    const missing = REQUIRED.filter((c) => !(key(c) in rows[0]));
    if (missing.length) throw new Error(`Missing column(s): ${missing.join(", ")}. Is this the PUCC certificate export?`);
  }

  const out: CertRow[] = [];
  const rejected: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const seenPucc = new Set<string>();
  const seenVehicleTest = new Set<string>();
  const licences = new Set<string>();
  const wantLicence = opts.outletLicence ? normalizeLicence(opts.outletLicence) : null;
  let min: string | null = null;
  let max: string | null = null;

  rows.forEach((r, i) => {
    const rowNo = i + 2; // header is row 1
    if (Object.values(r).every((v) => v == null || v === "")) return;

    const vehicle = normalizePlate(r.VEHICLENO);
    const pucc = str(r.PUCCNO)?.toUpperCase() ?? null;
    const test = toISODate(r.TESTDATE);
    const validTo = toISODate(r.VALIDDATE);
    const result = str(r.RESULT);
    const lic = str(r.LICENCENO);
    if (lic) licences.add(lic);

    const reject = (reason: string) => rejected.push({ row: rowNo, vehicle: vehicle || undefined, reason });
    if (!vehicle) return reject("Vehicle number missing");
    if (!isValidPlate(vehicle)) return reject(`Invalid vehicle number “${r.VEHICLENO}”`);
    if (!pucc) return reject("PUCC number missing");
    if (!test) return reject("Test date missing or unreadable");
    if (!validTo) return reject("Valid-till date missing or unreadable");
    if (validTo < test) return reject("Valid-till date is before test date");
    if (result && !/^pass/i.test(result)) return reject(`Result is “${result}” — no certificate issued`);
    if (wantLicence && lic && normalizeLicence(lic) !== wantLicence)
      return reject(`Licence ${lic} doesn’t match this outlet`);
    if (opts.period && (test < opts.period.from || test > opts.period.to))
      return reject(`Test date ${test} is outside the selected period`);
    if (seenPucc.has(pucc)) return reject(`Duplicate PUCC number ${pucc} in file`);
    const vehicleTest = `${vehicle}|${test}`;
    if (seenVehicleTest.has(vehicleTest))
      return reject(`Duplicate vehicle ${vehicle} on test date ${test} in file`);
    seenPucc.add(pucc);
    seenVehicleTest.add(vehicleTest);

    const mobile = normalizeMobile(r.MOBILENO);
    if (!mobile) warnings.push({ row: rowNo, vehicle, reason: "No valid mobile — WhatsApp reminders disabled" });

    if (!min || test < min) min = test;
    if (!max || test > max) max = test;
    out.push({
      pucc_no: pucc,
      vehicle_no: vehicle,
      mobile,
      fuel: str(r.FUEL)?.toUpperCase() ?? null,
      model: str(r.MODEL),
      engine: str(r.ENGINE),
      test_date: test,
      valid_until: validTo,
      result,
      km: num(r.KM),
      hsu: num(r.HSU),
      co: num(r.CO),
      hc: num(r.HC),
    });
  });

  return {
    rows: out,
    rejected,
    warnings,
    fileRange: min && max ? { from: min, to: max } : null,
    licences: [...licences],
  };
}
