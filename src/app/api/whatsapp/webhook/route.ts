import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignature } from "@/lib/whatsapp";

export const runtime = "nodejs";

const RANK: Record<string, number> = { queued: 0, simulated: 1, sent: 1, delivered: 2, read: 3, failed: 4 };
const STOP = /^\s*(stop|unsubscribe|opt ?out|cancel)\s*$/i;

/** Meta webhook verification handshake. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" &&
      u.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type Status = { id: string; status: string; errors?: { title?: string; message?: string }[] };
type Inbound = { from: string; type: string; text?: { body?: string }; button?: { text?: string } };

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const body = JSON.parse(raw || "{}");
  const db = createAdminClient();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      for (const st of (value.statuses ?? []) as Status[]) {
        const { data: cur } = await db.from("reminders").select("id, status").eq("wa_message_id", st.id).maybeSingle();
        if (!cur || !(st.status in RANK) || RANK[st.status] <= (RANK[cur.status] ?? 0)) continue; // never downgrade
        await db.from("reminders").update({
          status: st.status as "sent" | "delivered" | "read" | "failed",
          error: st.errors?.map((e) => e.message ?? e.title).join("; ") || null,
          updated_at: new Date().toISOString(),
        }).eq("id", cur.id);
      }

      for (const m of (value.messages ?? []) as Inbound[]) {
        const text = m.text?.body ?? m.button?.text ?? "";
        if (!STOP.test(text)) continue;
        const mobile = m.from.replace(/^91/, "");
        await db.from("vehicles").update({ opted_out: true }).eq("mobile", mobile);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
