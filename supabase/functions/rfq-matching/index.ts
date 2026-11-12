const corsHeaders = {
  "Access-Control-Allow-Origin": "https://berbagisaja45-droid.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

  if (!url || !serviceKey || !adminEmail || !publishableKey || !token) {
    return reply(500, { error: "RFQ matching function is not configured" });
  }

  const auth = await fetch(url + "/auth/v1/user", {
    headers: { apikey: publishableKey, Authorization: "Bearer " + token }
  });
  if (!auth.ok) return reply(401, { error: "Please sign in again" });
  const user = await auth.json();
  if ((user.email || "").toLowerCase() !== adminEmail) {
    return reply(403, { error: "Admin access required" });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: "Bearer " + serviceKey,
    "Content-Type": "application/json"
  };
  const requestUrl = new URL(req.url);

  if (req.method === "GET") {
    const rfqId = requestUrl.searchParams.get("rfq_id") || "";
    if (!isUuid(rfqId)) return reply(400, { error: "Valid RFQ ID is required" });
    const response = await fetch(
      url + "/rest/v1/rfq_matches?select=id,rfq_id,producer_id,match_notes,status,created_at,producers(business_name,regency_city,description)&rfq_id=eq." + encodeURIComponent(rfqId) + "&order=created_at.desc",
      { headers }
    );
    if (!response.ok) return reply(500, { error: "Could not load supplier matches" });
    return reply(200, { matches: await response.json() });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply(400, { error: "Invalid JSON" }); }

  if (body.action === "update_match") {
    const id = typeof body.id === "string" ? body.id : "";
    const status = String(body.status || "");
    if (!isUuid(id) || !["suggested", "contacted", "accepted", "declined"].includes(status)) {
      return reply(400, { error: "Invalid supplier match update" });
    }
    const response = await fetch(url + "/rest/v1/rfq_matches?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) return reply(500, { error: "Could not update supplier match status" });
    return reply(200, { ok: true, updated: await response.json() });
  }

  if (body.action !== "run_matching") return reply(400, { error: "Unknown matching action" });
  const rfqId = typeof body.rfq_id === "string" ? body.rfq_id : "";
  if (!isUuid(rfqId)) return reply(400, { error: "Valid RFQ ID is required" });

  const [rfqResponse, producerResponse, productResponse, existingResponse] = await Promise.all([
    fetch(url + "/rest/v1/buyer_rfqs?id=eq." + encodeURIComponent(rfqId) + "&select=*", { headers }),
    fetch(url + "/rest/v1/producers?select=id,business_name,regency_city,description,verification_status&verification_status=eq.verified", { headers }),
    fetch(url + "/rest/v1/products?select=producer_id,name,category,description,origin_regency_city,monthly_capacity,moq,certifications,specifications,publication_status&publication_status=eq.published", { headers }),
    fetch(url + "/rest/v1/rfq_matches?select=producer_id,status&rfq_id=eq." + encodeURIComponent(rfqId), { headers })
  ]);

  if (!rfqResponse.ok) return reply(500, { error: "Could not read the buyer request" });
  const rfqs = await rfqResponse.json();
  if (!rfqs.length) return reply(404, { error: "Buyer request not found" });
  if (!producerResponse.ok) return reply(500, { error: "Could not read verified producers" });
  if (!productResponse.ok) return reply(500, { error: "Could not read published product records" });
  if (!existingResponse.ok) return reply(500, { error: "Could not read existing supplier matches" });

  const rfq = rfqs[0];
  const producers = await producerResponse.json();
  const products = await productResponse.json();
  const existing = await existingResponse.json();
  const priorStatus = new Map<string, string>(
    existing.map((item: Record<string, string>) => [item.producer_id, item.status] as [string, string])
  );

  const normalize = (value: unknown) => String(value || "")
    .toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  const stop = new Set([
    "the","and","for","with","from","of","a","an","to","in","on","by","export",
    "quality","food","grade","please","buyer","product","required","monthly",
    "capacity","main","estimated","kg","kgs","ton","tons","per","month","bulan"
  ]);
  const tokens = (value: unknown) => normalize(value).split(/\s+/)
    .filter((word: string) => word.length > 1 && !stop.has(word));
  const aliases: Record<string, string[]> = {
    madu:["honey"], honey:["madu"], kopi:["coffee"], coffee:["kopi"],
    cinnamon:["kayu","manis"], kayu:["cinnamon"], manis:["cinnamon"],
    rempah:["spice","spices"], spice:["rempah"], spices:["rempah"],
    kakao:["cocoa"], cocoa:["kakao"],
    galo:["stingless","trigona","tetragonula"],
    trigona:["galo","stingless"], tetragonula:["galo","stingless"],
    arabica:["arabika"], arabika:["arabica"]
  };
  const queryTerms = [...new Set(tokens(rfq.product_required))];
  const specTerms = [...new Set(tokens(rfq.specifications))];

  const parseQuantity = (value: unknown) => {
    const match = String(value || "").match(/(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|tons?|tonnes?|liters?|litres?|units?|pieces?|pcs)\b/i);
    return match ? { amount: Number(match[1].replace(",", ".")), unit: match[2].toLowerCase() } : null;
  };
  const buyerQty = parseQuantity(rfq.quantity);

  const candidates = producers.map((producer: Record<string, any>) => {
    const ownProducts = products.filter((product: Record<string, any>) => product.producer_id === producer.id);
    const productText = [
      producer.business_name, producer.description, producer.regency_city,
      ...ownProducts.flatMap((product: Record<string, any>) => [
        product.name, product.category, product.description, product.origin_regency_city,
        product.monthly_capacity, product.moq,
        Array.isArray(product.certifications) ? product.certifications.join(" ") : "",
        JSON.stringify(product.specifications || {})
      ])
    ].join(" ");
    const ownTokens = new Set(tokens(productText));
    const hits = queryTerms.filter((term: string) =>
      ownTokens.has(term) || (aliases[term] || []).some((alias: string) => ownTokens.has(alias))
    );
    if (!hits.length) return null;

    const productRatio = queryTerms.length ? hits.length / queryTerms.length : 0;
    const regionTokens = new Set(tokens(producer.regency_city));
    const locationHits = specTerms.filter((term: string) => regionTokens.has(term));
    const specHits = specTerms.filter((term: string) => ownTokens.has(term) && !regionTokens.has(term));
    const specRatio = specTerms.length ? specHits.length / specTerms.length : 0;
    const score = Math.min(100, Math.round(productRatio * 65 + specRatio * 15 + (locationHits.length ? 10 : 0) + 10));

    const capacityTexts = [
      producer.description,
      ...ownProducts.map((product: Record<string, any>) => product.monthly_capacity)
    ].filter(Boolean);
    const supplierCapacity = capacityTexts.map(parseQuantity).find(Boolean);
    let capacityNote = supplierCapacity
      ? "Supplier-reported capacity: " + supplierCapacity.amount + " " + supplierCapacity.unit + "; confirm time basis and availability."
      : "Supplier capacity is not recorded in a comparable structured format; verify directly.";
    const unitGroup = (unit: string) =>
      /^(kg|kilogram|kilograms)$/.test(unit) ? "kg" :
      /^(ton|tons|tonne|tonnes)$/.test(unit) ? "ton" :
      /^(liter|liters|litre|litres)$/.test(unit) ? "liter" : "unit";
    if (buyerQty && supplierCapacity && unitGroup(buyerQty.unit) === unitGroup(supplierCapacity.unit) &&
        supplierCapacity.amount < buyerQty.amount) {
      capacityNote += " Reported supplier capacity is numerically below requested quantity; confirm whether multiple production cycles or shipments can fulfill the order.";
    }

    const notes = [
      "Preliminary match score: " + score + "/100.",
      "Product terms matched: " + hits.join(", ") + ".",
      specHits.length ? "Specification keywords found: " + specHits.join(", ") + "." : "Buyer specifications require manual verification.",
      locationHits.length ? "Supplier region matches buyer location request: " + locationHits.join(", ") + "." : "No specific supplier-region preference was matched.",
      capacityNote
    ].join(" ");

    return {
      rfq_id: rfqId,
      producer_id: producer.id,
      match_notes: notes,
      status: priorStatus.get(producer.id) || "suggested",
      score
    };
  }).filter(Boolean).sort((a: any, b: any) => b.score - a.score);

  if (candidates.length) {
    const rows = candidates.map(({ score, ...row }: any) => row);
    const save = await fetch(url + "/rest/v1/rfq_matches?on_conflict=rfq_id,producer_id", {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows)
    });
    if (!save.ok) {
      console.error("RFQ matching upsert failed:", await save.text());
      return reply(500, { error: "Could not save supplier matching results" });
    }
  }

  return reply(200, {
    ok: true,
    rfq_id: rfqId,
    match_count: candidates.length,
    matches: candidates.map((match: any) => ({ producer_id: match.producer_id, score: match.score }))
  });
});
