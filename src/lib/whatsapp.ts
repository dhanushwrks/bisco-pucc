import "server-only";
import crypto from "node:crypto";

export type TemplateSend = {
  to: string; // 10-digit Indian mobile
  template: string;
  language: string;
  params: string[]; // body {{1}}..{{n}}
};
export type SendResult =
  | { ok: true; simulated: boolean; messageId: string }
  | { ok: false; error: string };

export const whatsappConfigured = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** Meta WhatsApp Cloud API — template message. Simulates when credentials are absent. */
export async function sendTemplate(msg: TemplateSend): Promise<SendResult> {
  if (!whatsappConfigured()) {
    return { ok: true, simulated: true, messageId: `sim_${crypto.randomUUID()}` };
  }
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: `91${msg.to}`,
        type: "template",
        template: {
          name: msg.template,
          language: { code: msg.language },
          components: [
            { type: "body", parameters: msg.params.map((text) => ({ type: "text", text })) },
          ],
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body?.error?.message ?? `HTTP ${res.status}` };
    const id = body?.messages?.[0]?.id;
    return id ? { ok: true, simulated: false, messageId: id } : { ok: false, error: "No message id returned" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Validates Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // allow local testing only
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
