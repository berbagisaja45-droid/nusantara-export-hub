const corsHeaders = {
  "Access-Control-Allow-Origin": "https://berbagisaja45-droid.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });
const clean = (value: unknown, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function verifyAdmin(req: Request, url: string, publishableKey: string, adminEmail: string) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const response = await fetch(url + "/auth/v1/user", {
    headers: { apikey: publishableKey, Authorization: "Bearer " + token }
  });
  if (!response.ok) return false;
  const user = await response.json();
  return (user.email || "").toLowerCase() === adminEmail;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("origin") !== "https://berbagisaja45-droid.github.io") {
    return reply(403, { error: "Origin not allowed" });
  }
  if (!["GET", "POST"].includes(req.method)) return reply(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase();
  const publishableKey = req.headers.get("apikey") || "";
  if (!url || !serviceKey) return reply(500, { error: "Product catalog service is not configured" });

  const headers = {
    apikey: serviceKey,
    Authorization: "Bearer " + serviceKey,
    "Content-Type": "application/json"
  };

  if (req.method === "GET") {
    if (!adminEmail || !publishableKey || !(await verifyAdmin(req, url, publishableKey, adminEmail))) {
      return reply(403, { error: "Admin access required" });
    }
    const response = await fetch(
      url + "/rest/v1/products?select=id,producer_id,name,category,description,origin_regency_city,hs_code,moq,monthly_capacity,indicative_price,currency,specifications,certifications,image_urls,publication_status,created_at,producers(business_name,regency_city)&order=created_at.desc",
      { headers }
    );
    if (!response.ok) {
      console.error("Product catalog read failed:", await response.text());
      return reply(500, { error: "Could not load product catalog submissions" });
    }
    return reply(200, { products: await response.json() });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply(400, { error: "Invalid JSON" }); }
  const action = clean(body.action, 40);
  const data = (body.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;

  if (action === "submit_product") {
    if (clean(body.website, 200)) return reply(200, { ok: true });
    const producerId = clean(data.producer_id, 64);
    const name = clean(data.name, 160);
    const category = clean(data.category, 100);
    const description = clean(data.description, 3000);
    const origin = clean(data.origin_regency_city, 100);
    const hsCode = clean(data.hs_code, 24);
    const moq = clean(data.moq, 120);
    const capacity = clean(data.monthly_capacity, 120);
    const price = clean(data.indicative_price, 120);
    const currency = clean(data.currency, 3).toUpperCase() || "USD";

    if (!isUuid(producerId) || !name || !category || !description) {
      return reply(400, { error: "Please choose an approved supplier and complete product name, category and description" });
    }
    if (hsCode && !/^[0-9. -]{4,16}$/.test(hsCode)) {
      return reply(400, { error: "HS Code format is invalid" });
    }
    if (!["USD", "IDR", "EUR", "MYR", "SGD"].includes(currency)) {
      return reply(400, { error: "Unsupported currency" });
    }

    const producerResponse = await fetch(
      url + "/rest/v1/producers?id=eq." + encodeURIComponent(producerId) + "&select=id,verification_status,regency_city",
      { headers }
    );
    if (!producerResponse.ok) return reply(500, { error: "Could not verify supplier profile" });
    const producerRows = await producerResponse.json();
    if (!producerRows.length || producerRows[0].verification_status !== "verified") {
      return reply(403, { error: "Only approved suppliers can submit products to the catalog" });
    }

    const certRaw = clean(data.certifications, 1000);
    const certifications = [...new Set(certRaw.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 20);
    const imageRaw = clean(data.image_urls, 2500);
    const imageUrls = [...new Set(imageRaw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))].slice(0, 5);
    if (imageUrls.some((image) => !/^https:\/\//i.test(image))) {
      return reply(400, { error: "Product image links must use HTTPS. Add one link per line." });
    }

    const specifications = {
      grade: clean(data.grade, 160),
      packaging: clean(data.packaging, 300),
      shelf_life: clean(data.shelf_life, 120),
      quality_standard: clean(data.quality_standard, 240),
      storage_conditions: clean(data.storage_conditions, 240),
      additional_notes: clean(data.additional_notes, 1500)
    };
    Object.keys(specifications).forEach((key) => {
      if (!specifications[key as keyof typeof specifications]) delete specifications[key as keyof typeof specifications];
    });

    const row = {
      producer_id: producerId,
      name,
      category,
      description,
      origin_regency_city: origin || producerRows[0].regency_city,
      hs_code: hsCode || null,
      moq: moq || null,
      monthly_capacity: capacity || null,
      indicative_price: price || null,
      currency,
      specifications,
      certifications,
      image_urls: imageUrls,
      publication_status: "pending"
    };
    const insert = await fetch(url + "/rest/v1/products", {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(row)
    });
    if (!insert.ok) {
      console.error("Product submission failed:", await insert.text());
      return reply(500, { error: "Product submission could not be saved" });
    }
    const saved = await insert.json();
    return reply(200, { ok: true, product_id: saved[0]?.id, publication_status: "pending" });
  }

  if (action === "update_status") {
    if (!adminEmail || !publishableKey || !(await verifyAdmin(req, url, publishableKey, adminEmail))) {
      return reply(403, { error: "Admin access required" });
    }
    const id = clean(body.id, 64);
    const status = clean(body.status, 20);
    if (!isUuid(id) || !["draft", "pending", "published", "archived"].includes(status)) {
      return reply(400, { error: "Invalid product publication update" });
    }
    if (status === "published") {
      const check = await fetch(
        url + "/rest/v1/products?id=eq." + encodeURIComponent(id) + "&select=producer_id,producers(verification_status)",
        { headers }
      );
      if (!check.ok) return reply(500, { error: "Could not verify supplier before publication" });
      const rows = await check.json();
      if (!rows.length || rows[0].producers?.verification_status !== "verified") {
        return reply(403, { error: "Only products from approved suppliers can be published" });
      }
    }
    const update = await fetch(url + "/rest/v1/products?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ publication_status: status })
    });
    if (!update.ok) {
      console.error("Product status update failed:", await update.text());
      return reply(500, { error: "Could not update product publication status" });
    }
    return reply(200, { ok: true, updated: await update.json() });
  }

  return reply(400, { error: "Unknown product catalog action" });
});
