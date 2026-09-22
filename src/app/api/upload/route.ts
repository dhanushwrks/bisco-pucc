import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/server";
import { normalizeLicence, parseCertificates } from "@/lib/parse";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST multipart: file, outlet_id, from?, to?, commit ("1" to import; otherwise preview)
 * Preview and import run the exact same validation + dedup; only commit writes.
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const outletId = String(form.get("outlet_id") ?? "");
  const commit = form.get("commit") === "1";
  const fromIn = String(form.get("from") ?? "");
  const toIn = String(form.get("to") ?? "");

  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 10 MB" }, { status: 400 });
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return NextResponse.json({ error: "Upload an .xlsx, .xls or .csv file" }, { status: 400 });

  // RLS: operators only see their own outlet, so this doubles as an access check.
  const { data: outlet } = await ctx.db.from("outlets").select("id, licence_no").eq("id", outletId).maybeSingle();
  if (!outlet) return NextResponse.json({ error: "Select an outlet you have access to" }, { status: 403 });

  const period = ISO.test(fromIn) && ISO.test(toIn) ? { from: fromIn, to: toIn } : null;
  if (period && period.to < period.from) return NextResponse.json({ error: "Period end is before start" }, { status: 400 });

  let parsed;
  try {
    parsed = parseCertificates(await file.arrayBuffer(), { outletLicence: outlet.licence_no, period });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read file" }, { status: 400 });
  }

  const effective = period ?? parsed.fileRange;
  if (!effective) {
    // Wrong outlet selected? Suggest the one whose licence matches the file.
    let matchOutlet: { id: string; name: string } | null = null;
    if (parsed.licences.length === 1 && normalizeLicence(parsed.licences[0]) !== normalizeLicence(outlet.licence_no)) {
      const { data: all } = await ctx.db.from("outlets").select("id, name, licence_no");
      const hits = (all ?? []).filter((o) => normalizeLicence(o.licence_no) === normalizeLicence(parsed.licences[0]));
      if (hits.length === 1) matchOutlet = { id: hits[0].id, name: hits[0].name };
    }
    return NextResponse.json({
      matchOutlet,
      error: matchOutlet
        ? `This file belongs to ${matchOutlet.name} (licence ${parsed.licences[0]}).`
        : "No valid rows found in this file.",
      rejected: parsed.rejected.slice(0, 200),
    }, { status: 422 });
  }

  const { data, error } = await ctx.db.rpc("ingest_certificates", {
    p_outlet: outlet.id,
    p_file_name: file.name,
    p_from: effective.from,
    p_to: effective.to,
    p_rows: parsed.rows,
    p_rejected: parsed.rejected.length,
    p_errors: parsed.rejected.slice(0, 500),
    p_dry_run: !commit,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    summary: data,
    period: effective,
    fileRange: parsed.fileRange,
    licences: parsed.licences,
    rejected: parsed.rejected.slice(0, 200),
    warnings: parsed.warnings.slice(0, 200),
    warningCount: parsed.warnings.length,
  });
}
