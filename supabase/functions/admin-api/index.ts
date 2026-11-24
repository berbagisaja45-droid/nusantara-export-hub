import nodemailer from "npm:nodemailer@^9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://berbagisaja45-droid.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

const rfqStatusLabels: Record<string, string> = {
  new: "New — received",
  reviewing: "Reviewing — our trade desk is checking your requirements",
  matched: "Matched — a potential supplier has been identified",
  introduced: "Introduced — buyer and supplier have been connected",
  closed: "Closed — this request has been completed",
  rejected: "Rejected — this request cannot be processed"
};
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char] || char));

async function sendRfqStatusEmail(rfq: Record<string, unknown>, newStatus: string) {
  const host = Deno.env.get("SMTP_HOSTNAME");
  const port = Number(Deno.env.get("SMTP_PORT") || "465");
  const username = Deno.env.get("SMTP_USERNAME");
  const password = Deno.env.get("SMTP_PASSWORD");
  const from = Deno.env.get("SMTP_FROM");
  const secure = (Deno.env.get("SMTP_SECURE") || "true").toLowerCase() === "true";
  const recipient = String(rfq.email || "").trim();

  if (!host || !username || !password || !from || !Number.isInteger(port) || port <= 0) {
    return { status: "not_configured", message: "Email notification is not configured. Add SMTP secrets to Supabase Edge Functions." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { status: "skipped", message: "Buyer email is missing or invalid." };
  }

  const product = String(rfq.product_required || "your requested product");
  const reference = String(rfq.id || "");
  const buyerName = String(rfq.buyer_company || "Buyer");
  const statusLabel = rfqStatusLabels[newStatus] || newStatus;
  const oldStatus = String(rfq.status || "new");
  const oldLabel = rfqStatusLabels[oldStatus] || oldStatus;
  const trackingUrl = "https://berbagisaja45-droid.github.io/nusantara-export-hub/buyer.html#rfq-tracking";
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: username, pass: password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });

  const text = [
    "Hello " + buyerName + ",",
    "",
    "The status of your Nusantara Export Hub quotation request has been updated.",
    "Product: " + product,
    "Previous status: " + oldLabel,
    "New status: " + statusLabel,
    "RFQ reference: " + reference,
    "",
    "Track your request: " + trackingUrl,
    "",
    "Nusantara Export Hub Trade Desk"
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f8f4;font-family:Arial,sans-serif;color:#24362b">
    <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e1e8df;border-radius:8px;padding:28px">
      <p style="font-size:12px;letter-spacing:1px;color:#477956;font-weight:bold">NUSANTARA EXPORT HUB</p>
      <h2 style="font-family:Georgia,serif;color:#1e5039">Your quotation request has been updated</h2>
      <p>Hello ${escapeHtml(buyerName)},</p>
      <p>The status of your request for <strong>${escapeHtml(product)}</strong> has changed.</p>
      <p><span style="color:#69776e">Previous status:</span> ${escapeHtml(oldLabel)}<br>
      <span style="color:#69776e">Current status:</span> <strong>${escapeHtml(statusLabel)}</strong></p>
      <p><span style="color:#69776e">RFQ reference:</span><br><strong>${escapeHtml(reference)}</strong></p>
      <p><a href="${trackingUrl}" style="display:inline-block;background:#1e5039;color:#fff;text-decoration:none;padding:12px 18px;border-radius:4px">Track quotation request</a></p>
      <p style="font-size:12px;color:#69776e;margin-top:28px">Nusantara Export Hub Trade Desk</p>
    </div></body></html>`;

  try {
    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject: "Nusantara Export Hub — RFQ status updated: " + statusLabel.split(" — ")[0],
      text,
      html
    });
    return { status: "sent", messageId: info.messageId };
  } catch (error) {
    console.error("RFQ status email failed:", error);
    return { status: "failed", message: "RFQ status was saved, but the buyer email could not be sent. Check SMTP secrets and delivery logs." };
  } finally {
    transporter.close();
  }
}
\nconst reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("origin") !== "https://berbagisaja45-droid.github.io") return reply(403, { error: "Origin not allowed" });
  if (!["GET", "POST"].includes(req.method)) return reply(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase();
  const publishableKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !serviceKey || !adminEmail || !publishableKey || !token) return reply(500, { error: "Admin API is not configured" });

  const auth = await fetch(url + "/auth/v1/user", { headers: { apikey: publishableKey, Authorization: "Bearer " + token } });
  if (!auth.ok) return reply(401, { error: "Please sign in again" });
  const user = await auth.json();
  if ((user.email || "").toLowerCase() !== adminEmail) return reply(403, { error: "Admin access required" });

  const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" };
  const requestUrl = new URL(req.url);

  if (req.method === "GET") {
    const resource = requestUrl.searchParams.get("resource") || "producers";
    if (resource === "rfqs") {
      const r = await fetch(url + "/rest/v1/buyer_rfqs?select=*&order=created_at.desc", { headers });
      if (!r.ok) return reply(500, { error: "Could not load buyer RFQs" });
      return reply(200, { rfqs: await r.json() });
    }
    const r = await fetch(url + "/rest/v1/producers?select=*&order=created_at.desc", { headers });
    if (!r.ok) return reply(500, { error: "Could not load producer records" });
    return reply(200, { producers: await r.json() });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON" }); }


  if (body.action === "update_rfq") {
    const id = typeof body.id === "string" ? body.id : "";
    const status = String(body.status || "");
    const allowed = ["new", "reviewing", "matched", "introduced", "closed", "rejected"];
    if (!id || !allowed.includes(status)) return reply(400, { error: "Invalid RFQ status update" });

    const existingResponse = await fetch(
      url + "/rest/v1/buyer_rfqs?id=eq." + encodeURIComponent(id) + "&select=id,email,buyer_company,product_required,status&limit=1",
      { headers }
    );
    if (!existingResponse.ok) return reply(500, { error: "Could not load RFQ before updating status" });
    const existingRows = await existingResponse.json();
    if (!Array.isArray(existingRows) || !existingRows.length) return reply(404, { error: "Buyer RFQ not found" });
    const existingRfq = existingRows[0] as Record<string, unknown>;

    const update = await fetch(url + "/rest/v1/buyer_rfqs?id=eq." + encodeURIComponent(id), {
      method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ status })
    });
    if (!update.ok) return reply(500, { error: "Could not update RFQ status" });
    const updatedRows = await update.json();

    let notification: Record<string, unknown> = { status: "unchanged" };
    if (String(existingRfq.status || "new") !== status) {
      notification = await sendRfqStatusEmail(existingRfq, status);
    }
    return reply(200, { ok: true, updated: updatedRows, notification });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status;
  if (!id || !["verified", "rejected", "pending"].includes(String(status))) return reply(400, { error: "Invalid producer review request" });
  const update = await fetch(url + "/rest/v1/producers?id=eq." + encodeURIComponent(id), {
    method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ verification_status: status, updated_at: new Date().toISOString() })
  });
  if (!update.ok) return reply(500, { error: "Could not update producer status" });
  return reply(200, { ok: true, updated: await update.json() });
});
