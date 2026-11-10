const corsHeaders = {
  "Access-Control-Allow-Origin": "https://berbagisaja45-droid.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });
const clean = (v: unknown, max = 2000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (req.headers.get("origin") !== "https://berbagisaja45-droid.github.io") {
    return reply(403, { error: "Origin not allowed" });
  }
  const size = Number(req.headers.get("content-length") || "0");
  if (size > 20000) return reply(413, { error: "Request too large" });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply(400, { error: "Invalid JSON" }); }

  if (clean(body.website, 200)) return reply(200, { ok: true });
  const type = clean(body.type, 20);
  const data = (body.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply(500, { error: "Server configuration incomplete" });

  let table: string;
  let row: Record<string, unknown>;

  if (type === "producer") {
    const business = clean(data.business, 160);
    const contact = clean(data.contact, 120);
    const contactDetail = clean(data.contact_detail, 180);
    const region = clean(data.region, 80);
    const product = clean(data.product, 160);
    const capacity = clean(data.capacity, 120);
    const regions = [
      "Agam","Dharmasraya","Kepulauan Mentawai","Lima Puluh Kota","Padang Pariaman",
      "Pasaman","Pasaman Barat","Pesisir Selatan","Sijunjung","Solok","Solok Selatan",
      "Tanah Datar","Kota Bukittinggi","Kota Padang","Kota Padang Panjang",
      "Kota Pariaman","Kota Payakumbuh","Kota Sawahlunto","Kota Solok"
    ];
    if (!business || !contact || !contactDetail || !regions.includes(region) || !product) {
      return reply(400, { error: "Please complete all required producer fields" });
    }
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactDetail);
    table = "producers";
    row = {
      business_name: business,
      contact_person: contact,
      email: email ? contactDetail : null,
      phone_whatsapp: email ? null : contactDetail,
      regency_city: region,
      description: "Main product: " + product + (capacity ? "; Estimated monthly capacity: " + capacity : ""),
      verification_status: "pending"
    };
  } else if (type === "rfq") {
    const company = clean(data.company, 160);
    const email = clean(data.email, 180);
    const country = clean(data.country, 100);
    const product = clean(data.product, 200);
    const quantity = clean(data.quantity, 120);
    if (!company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !country || !product || !quantity) {
      return reply(400, { error: "Please complete all required RFQ fields with a valid email" });
    }
    table = "buyer_rfqs";
    row = {
      buyer_company: company,
      email,
      destination_country: country,
      product_required: product,
      quantity,
      target_timeline: clean(data.timeline, 180) || null,
      specifications: clean(data.specification, 3000) || null,
      status: "new"
    };
  } else {
    return reply(400, { error: "Unknown submission type" });
  }

  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(row)
  });
  if (!response.ok) {
    console.error("Supabase insert failed:", await response.text());
    return reply(500, { error: "Database could not save the submission" });
  }
  return reply(200, { ok: true });
});
