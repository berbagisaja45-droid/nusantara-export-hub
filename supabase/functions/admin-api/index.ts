const corsHeaders = {
  "Access-Control-Allow-Origin": "https://berbagisaja45-droid.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("origin") !== "https://berbagisaja45-droid.github.io") return reply(403, { error: "Origin not allowed" });
  if (!["GET", "POST"].includes(req.method)) return reply(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase();
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
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
    const update = await fetch(url + "/rest/v1/buyer_rfqs?id=eq." + encodeURIComponent(id), {
      method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ status })
    });
    if (!update.ok) return reply(500, { error: "Could not update RFQ status" });
    return reply(200, { ok: true, updated: await update.json() });
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
