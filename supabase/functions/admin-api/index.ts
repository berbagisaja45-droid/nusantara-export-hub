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
    if (resource === "matches") {
      const rfqId = requestUrl.searchParams.get("rfq_id") || "";
      if (!/^[0-9a-f-]{36}$/i.test(rfqId)) return reply(400, { error: "Valid RFQ ID is required" });
      const r = await fetch(url + "/rest/v1/rfq_matches?select=id,rfq_id,producer_id,match_notes,status,created_at,producers(business_name,regency_city,description)&rfq_id=eq." + encodeURIComponent(rfqId) + "&order=created_at.desc", { headers });
      if (!r.ok) return reply(500, { error: "Could not load supplier matches" });
      return reply(200, { matches: await r.json() });
    }
    const r = await fetch(url + "/rest/v1/producers?select=*&order=created_at.desc", { headers });
    if (!r.ok) return reply(500, { error: "Could not load producer records" });
    return reply(200, { producers: await r.json() });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON" }); }


  if (body.action === "run_matching") {
    const rfqId = typeof body.rfq_id === "string" ? body.rfq_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(rfqId)) return reply(400, { error: "Valid RFQ ID is required" });

    const [rfqResponse, producerResponse, productResponse, existingResponse] = await Promise.all([
      fetch(url + "/rest/v1/buyer_rfqs?id=eq." + encodeURIComponent(rfqId) + "&select=*", { headers }),
      fetch(url + "/rest/v1/producers?select=id,business_name,regency_city,description,verification_status&verification_status=eq.verified", { headers }),
      fetch(url + "/rest/v1/products?select=producer_id,name,category,description,origin_regency_city,monthly_capacity,moq,certifications,specifications,publication_status&publication_status=neq.archived", { headers }),
      fetch(url + "/rest/v1/rfq_matches?select=producer_id,status&rfq_id=eq." + encodeURIComponent(rfqId), { headers })
    ]);
    if (!rfqResponse.ok) return reply(500, { error: "Could not read the buyer request" });
    const rfqs = await rfqResponse.json();
    if (!rfqs.length) return reply(404, { error: "Buyer request not found" });
    if (!producerResponse.ok) return reply(500, { error: "Could not read verified producers" });
    if (!productResponse.ok) return reply(500, { error: "Could not read producer product records" });
    if (!existingResponse.ok) return reply(500, { error: "Could not read existing supplier matches" });

    const rfq = rfqs[0];
    const producers = await producerResponse.json();
    const products = await productResponse.json();
    const existing = await existingResponse.json();
    const priorStatus = new Map(existing.map((m: Record<string, string>) => [m.producer_id, m.status]));

    const normalize = (value: unknown) => String(value || "").toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
    const stop = new Set(["the","and","for","with","from","of","a","an","to","in","on","by","export","quality","food","grade","please","buyer","product","required","monthly","capacity","main","estimated","kg","kgs","ton","tons","per","month","bulan"]);
    const tokens = (value: unknown) => normalize(value).split(/\s+/).filter((w: string) => w.length > 1 && !stop.has(w));
    const alias: Record<string,string[]> = {
      madu:["honey"], honey:["madu"], kopi:["coffee"], coffee:["kopi"], cinnamon:["kayu","manis"], kayu:["cinnamon"], manis:["cinnamon"],
      rempah:["spice","spices"], spice:["rempah"], spices:["rempah"], kakao:["cocoa"], cocoa:["kakao"],
      "galo":["stingless","trigona","tetragonula"], trigona:["galo","stingless"], tetragonula:["galo","stingless"],
      arabica:["arabika"], arabika:["arabica"]
    };
    const queryTerms = [...new Set(tokens(rfq.product_required))];
    const specsTerms = [...new Set(tokens(rfq.specifications))];
    const quantity = (value: unknown) => {
      const match = String(value || "").match(/(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|tons?|tonnes?|liters?|litres?|units?|pieces?|pcs)\b/i);
      return match ? { amount: Number(match[1].replace(",", ".")), unit: match[2].toLowerCase() } : null;
    };
    const buyerQty = quantity(rfq.quantity);
    const candidates = producers.map((p: Record<string, any>) => {
      const ownProducts = products.filter((item: Record<string, any>) => item.producer_id === p.id);
      const productText = [p.business_name,p.description,p.regency_city,...ownProducts.flatMap((item: Record<string, any>) => [item.name,item.category,item.description,item.origin_regency_city,item.monthly_capacity,item.moq,Array.isArray(item.certifications)?item.certifications.join(" "):"",JSON.stringify(item.specifications || {})])].join(" ");
      const ownTokens = new Set(tokens(productText));
      const hits = queryTerms.filter((term: string) => ownTokens.has(term) || (alias[term] || []).some((word: string) => ownTokens.has(word)));
      if (!hits.length) return null;
      const productRatio = queryTerms.length ? hits.length / queryTerms.length : 0;
      const specHits = specsTerms.filter((term: string) => ownTokens.has(term));
      const specRatio = specsTerms.length ? specHits.length / specsTerms.length : 0;
      const score = Math.min(100, Math.round(productRatio * 75 + specRatio * 15 + 10));
      const capacityTexts = [p.description,...ownProducts.map((item: Record<string, any>) => item.monthly_capacity)].filter(Boolean);
      const statedCapacity = capacityTexts.map(quantity).find(Boolean);
      let capacityNote = statedCapacity
        ? "Supplier-reported capacity: " + statedCapacity.amount + " " + statedCapacity.unit + "; confirm its time basis and availability."
        : "Supplier capacity is not recorded in a comparable structured format; verify directly.";
      const unitGroup = (unit: string) => /^(kg|kilogram|kilograms)$/.test(unit) ? "kg" : /^(ton|tons|tonne|tonnes)$/.test(unit) ? "ton" : /^(liter|liters|litre|litres)$/.test(unit) ? "liter" : "unit";
      if (buyerQty && statedCapacity && unitGroup(buyerQty.unit) === unitGroup(statedCapacity.unit) && statedCapacity.amount < buyerQty.amount) {
        capacityNote += " Reported supplier capacity is numerically below the requested quantity; confirm whether multiple production cycles or shipments can fulfill the order.";
      }
      const notes = [
        "Preliminary match score: " + score + "/100.",
        "Product terms matched: " + hits.join(", ") + ".",
        specHits.length ? "Specification keywords found: " + specHits.join(", ") + "." : "Buyer specifications require manual verification.",
        capacityNote
      ].join(" ");
      return { rfq_id: rfqId, producer_id: p.id, match_notes: notes, status: priorStatus.get(p.id) || "suggested", _score: score };
    }).filter(Boolean).sort((a: any,b: any) => b._score - a._score);

    if (candidates.length) {
      const rows = candidates.map(({_score, ...row}: any) => row);
      const save = await fetch(url + "/rest/v1/rfq_matches?on_conflict=rfq_id,producer_id", {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(rows)
      });
      if (!save.ok) return reply(500, { error: "Could not save supplier matching results" });
    }
    return reply(200, { ok: true, rfq_id: rfqId, match_count: candidates.length, matches: candidates.map((m: any) => ({ producer_id: m.producer_id, score: m._score })) });
  }

  if (body.action === "update_match") {
    const id = typeof body.id === "string" ? body.id : "";
    const status = String(body.status || "");
    if (!id || !["suggested","contacted","accepted","declined"].includes(status)) return reply(400, { error: "Invalid supplier match status" });
    const update = await fetch(url + "/rest/v1/rfq_matches?id=eq." + encodeURIComponent(id), {
      method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ status })
    });
    if (!update.ok) return reply(500, { error: "Could not update supplier match status" });
    return reply(200, { ok: true, updated: await update.json() });
  }

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
