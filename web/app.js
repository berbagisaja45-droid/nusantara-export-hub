const products=[
{name:"Solok Arabica Coffee",category:"Coffee & Cocoa",origin:"Solok, West Sumatra",description:"Arabica coffee from highland smallholder growers.",price:"Indicative price on request",supplier:"Local cooperative",tag:"Regional specialty",image:"https://images.unsplash.com/photo-1520516472218-ed48f8ff3271?auto=format&fit=crop&w=900&q=85",alt:"Roasted coffee beans"},
{name:"Madu Galo-galo",category:"Honey & Natural Products",origin:"Balai Gadang, Padang, West Sumatra",description:"Galo-galo (stingless-bee) honey supplied by KKMP Balai Gadang. Packaging, harvest batch, laboratory specifications and export volume are confirmed directly with the supplier.",price:"Price and minimum order on request",supplier:"KKMP Balai Gadang",tag:"Featured supplier",image:"https://www.distacart.com/cdn/shop/files/oURUGazwMF_960x960.jpg?v=1715839749",alt:"Illustrative stingless-bee honey jar; not the KKMP product packaging",illustrative:true},
{name:"Forest Honey",category:"Honey & Natural Products",origin:"West Sumatra",description:"Locally collected forest honey. Specifications to be confirmed.",price:"Indicative price on request",supplier:"Community supplier",tag:"Regional product",image:"https://aravindfarm.com/media/products/foresthumbnail-2_idRJpTy.jpg",alt:"Forest honey jar"},
{name:"Indonesian Cinnamon",category:"Spices",origin:"Kerinci, Indonesia",description:"Dried cinnamon offered by regional suppliers.",price:"Indicative price on request",supplier:"Regional trader",tag:"Spices",image:"https://images.unsplash.com/photo-1702058676458-1ed7d4ca0313?auto=format&fit=crop&w=900&q=85",alt:"Cinnamon sticks"}
];
document.getElementById("year").textContent=new Date().getFullYear();
document.getElementById("products").innerHTML=products.map(p=>'<article class="product '+(p.supplier==="KKMP Balai Gadang"?"featured-product":"")+'"><div class="product-image-wrap"><img class="product-image" src="'+p.image+'" alt="'+p.alt+'" loading="lazy" onerror="this.closest(\'.product-image-wrap\').classList.add(\'image-failed\');this.remove()">'+(p.illustrative?'<span class="image-note">Foto ilustrasi · bukan kemasan KKMP</span>':'')+'</div><div class="product-topline"><small>'+p.category+' · '+p.origin+'</small><span class="product-tag">'+p.tag+'</span></div><h3>'+p.name+'</h3><p>'+p.description+'</p><p><b>'+p.price+'</b></p><p class="supplier-line">Supplier: <strong>'+p.supplier+'</strong></p><a class="button" href="mailto:berbagisaja45@gmail.com?subject='+encodeURIComponent("Product inquiry: "+p.name+" — "+p.supplier)+'">Send inquiry ↗</a></article>').join("");

const galoGallery=[
{title:"Lebah Galo-galo",desc:"Lebah tanpa sengat yang bekerja di sekitar pintu sarang.",image:"https://thumb.braavo.me/birden/0/2543957042.jpg",alt:"Lebah tanpa sengat di sekitar kotak sarang"},
{title:"Koloni dan sarang",desc:"Struktur sarang dan aktivitas koloni lebah.",image:"https://www.coffsnativebees.com.au/uploads/3/1/3/2/31326185/tetragonula-carbonaria-brood-spiral-tobias-smith-2014_orig.jpg",alt:"Koloni lebah tanpa sengat pada struktur brood spiral"},
{title:"Stup budidaya",desc:"Kotak stup sebagai rumah koloni dalam budidaya lebah tanpa sengat.",image:"https://2.bp.blogspot.com/-E3G_cCf80qE/W9pI43cAHTI/AAAAAAAAB6g/y9iNOHSR75Mf-3eUCskDj6U2nqTo-cYXwCLcBGAs/s1600/Madu_Lombok_TRIGONA___Budidaya_Lebah_TRIGONA___1_L.jpg",alt:"Deretan stup kayu budidaya lebah trigona"},
{title:"Panen madu",desc:"Madu diambil dari pot-pot penyimpanan di dalam sarang menggunakan alat ekstraksi.",image:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Extracting_stingless_bee_honey.jpg/1280px-Extracting_stingless_bee_honey.jpg",alt:"Proses ekstraksi madu lebah tanpa sengat dari sarang",credit:"Foto: Tofeiku · Wikimedia Commons · CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:Extracting_stingless_bee_honey.jpg"},
{title:"Pot madu alami",desc:"Madu tersimpan dalam kantong-kantong kecil berbahan lilin dan resin.",image:"https://qaafi.uq.edu.au/files/75102/Tetragonula-honey-pots-2019.jpg",alt:"Pot-pot madu pada sarang Tetragonula"}
];
const gallery=document.getElementById("galo-gallery-grid");
if(gallery) gallery.innerHTML=galoGallery.map(item=>'<article class="galo-gallery-card"><img src="'+item.image+'" alt="'+item.alt+'" loading="eager" onerror="this.closest(\'.galo-gallery-card\').classList.add(\'gallery-image-failed\');this.remove()"><div><h3>'+item.title+'</h3><p>'+item.desc+'</p>'+(item.credit?'<small>'+item.credit+' · <a href="'+item.source+'" target="_blank" rel="noopener">Sumber foto</a></small>':'')+'</div></article>').join("");

/* Supabase-connected MVP forms.
   Public publishable key is intended for browser use; never place service_role here.
   The Edge Function must be deployed with JWT verification disabled and server-side validation enabled. */
const SUPABASE_URL = "https://qbvbiaiwlgldxbnkpoyz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_73V0_NwW1j5pZTTdq15mwQ_irBusD0u";
const INTAKE_ENDPOINT = SUPABASE_URL + "/functions/v1/submit-intake";

async function submitIntake(form, kind) {
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  const originalText = button ? button.textContent : "";
  if (button) { button.disabled = true; button.textContent = "Submitting..."; }
  const data = Object.fromEntries(new FormData(form).entries());
  delete data.website;
  try {
    const response = await fetch(INTAKE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({ type: kind, data, website: form.querySelector('[name="website"]')?.value || "" })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Submission could not be completed.");
    form.reset();
    let note = form.querySelector(".form-note");
    if (!note) { note = document.createElement("p"); note.className = "form-note"; form.appendChild(note); }
    note.textContent = kind === "producer"
      ? "Thank you. Your producer registration has been received for review."
      : "Thank you. Your sourcing request has been received.";
    note.setAttribute("role", "status");
  } catch (error) {
    let note = form.querySelector(".form-note");
    if (!note) { note = document.createElement("p"); note.className = "form-note"; form.appendChild(note); }
    note.textContent = "Online submission is not ready yet: " + error.message + " Please contact berbagisaja45@gmail.com.";
    note.setAttribute("role", "alert");
  } finally {
    if (button) { button.disabled = false; button.textContent = originalText; }
  }
}
function wireIntakeForm(id, kind) {
  const form = document.getElementById(id);
  if (!form) return;
  const trap = document.createElement("input");
  trap.type = "text"; trap.name = "website"; trap.tabIndex = -1;
  trap.autocomplete = "off"; trap.setAttribute("aria-hidden", "true");
  trap.style.cssText = "position:absolute;left:-10000px;width:1px;height:1px";
  form.appendChild(trap);
  form.addEventListener("submit", event => {
    event.preventDefault();
    submitIntake(form, kind);
  });
}
wireIntakeForm("producer-form", "producer");
wireIntakeForm("rfq-form", "rfq");

/* Product catalog intake is isolated from the existing producer and buyer RFQ endpoint. */
const PRODUCT_CATALOG_ENDPOINT = SUPABASE_URL + "/functions/v1/product-catalog";

async function submitProduct(form) {
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  const originalText = button ? button.textContent : "";
  if (button) { button.disabled = true; button.textContent = "Submitting product..."; }
  const data = Object.fromEntries(new FormData(form).entries());
  delete data.website;
  try {
    const response = await fetch(PRODUCT_CATALOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ action: "submit_product", data, website: form.querySelector('[name="website"]')?.value || "" })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Product submission could not be completed.");
    form.reset();
    const message = form.querySelector(".form-note");
    if (message) {
      message.textContent = "Product submitted successfully. It is now awaiting admin review before appearing in the public catalog.";
      message.setAttribute("role", "status");
    }
    await loadVerifiedProducers();
  } catch (error) {
    let message = form.querySelector(".form-note");
    if (!message) { message = document.createElement("p"); message.className = "form-note"; form.appendChild(message); }
    message.textContent = "Product submission failed: " + error.message + " Please contact berbagisaja45@gmail.com.";
    message.setAttribute("role", "alert");
  } finally {
    if (button) { button.disabled = false; button.textContent = originalText; }
  }
}
function wireProductForm() {
  const form = document.getElementById("product-form");
  if (!form) return;
  const trap = document.createElement("input");
  trap.type = "text"; trap.name = "website"; trap.tabIndex = -1;
  trap.autocomplete = "off"; trap.setAttribute("aria-hidden", "true");
  trap.style.cssText = "position:absolute;left:-10000px;width:1px;height:1px";
  form.appendChild(trap);
  const producerSelect = document.getElementById("product-producer");
  const originInput = form.elements.namedItem("origin_regency_city");
  if (producerSelect && originInput) {
    producerSelect.addEventListener("change", () => {
      const option = producerSelect.selectedOptions[0];
      if (option && option.dataset.region) originInput.value = option.dataset.region;
    });
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    submitProduct(form);
  });
}
wireProductForm();

/* Only approved products belonging to approved suppliers are shown in the public catalog. */
async function loadPublishedProducts() {
  const target = document.getElementById("products");
  if (!target) return;
  try {
    const query = "id,name,category,description,origin_regency_city,hs_code,moq,monthly_capacity,indicative_price,currency,specifications,certifications,image_urls,producers(business_name,regency_city)";
    const response = await fetch(SUPABASE_URL + "/rest/v1/products?select=" + encodeURIComponent(query) + "&publication_status=eq.published&order=created_at.desc", {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
    });
    if (!response.ok) throw new Error("Could not load approved catalog products.");
    const records = await response.json();
    records.forEach(product => {
      const supplier = product.producers || {};
      const card = document.createElement("article");
      card.className = "product database-product";
      const imageWrap = document.createElement("div");
      imageWrap.className = "product-image-wrap";
      const imageUrl = Array.isArray(product.image_urls) ? product.image_urls.find(value => /^https:\/\//i.test(value)) : null;
      if (imageUrl) {
        const image = document.createElement("img");
        image.className = "product-image"; image.src = imageUrl; image.alt = product.name || "Product image";
        image.loading = "lazy";
        image.addEventListener("error", () => { imageWrap.classList.add("image-failed"); image.remove(); });
        imageWrap.appendChild(image);
      } else {
        imageWrap.classList.add("image-failed");
      }
      card.appendChild(imageWrap);
      const topline = document.createElement("div"); topline.className = "product-topline";
      const origin = document.createElement("small"); origin.textContent = (product.category || "Product") + " · " + (product.origin_regency_city || supplier.regency_city || "Indonesia");
      const tag = document.createElement("span"); tag.className = "product-tag"; tag.textContent = "Approved catalog";
      topline.append(origin, tag); card.appendChild(topline);
      const title = document.createElement("h3"); title.textContent = product.name || "Untitled product"; card.appendChild(title);
      const description = document.createElement("p"); description.textContent = product.description || "Product details available on request."; card.appendChild(description);
      const detailLines = [
        product.hs_code ? "HS Code: " + product.hs_code : "",
        product.moq ? "MOQ: " + product.moq : "",
        product.monthly_capacity ? "Monthly capacity: " + product.monthly_capacity : "",
        product.indicative_price ? "Indicative price: " + product.indicative_price + " " + (product.currency || "USD") : "",
        Array.isArray(product.certifications) && product.certifications.length ? "Certifications: " + product.certifications.join(", ") : ""
      ].filter(Boolean);
      if (detailLines.length) {
        const details = document.createElement("p"); details.className = "catalog-product-details";
        details.textContent = detailLines.join(" · "); card.appendChild(details);
      }
      const supplierLine = document.createElement("p"); supplierLine.className = "supplier-line";
      const supplierName = document.createElement("strong"); supplierName.textContent = supplier.business_name || "Verified supplier";
      supplierLine.append("Supplier: ", supplierName); card.appendChild(supplierLine);
      const inquiry = document.createElement("a"); inquiry.className = "button";
      inquiry.href = "mailto:berbagisaja45@gmail.com?subject=" + encodeURIComponent("Product inquiry: " + product.name + " — " + (supplier.business_name || "Nusantara Export Hub"));
      inquiry.textContent = "Send inquiry ↗"; card.appendChild(inquiry);
      target.appendChild(card);
    });
  } catch (error) {
    const note = document.createElement("p");
    note.textContent = "Approved catalog products are temporarily unavailable.";
    target.appendChild(note);
  }
}



/* Public producer directory: RLS returns verified profiles only. */
async function loadVerifiedProducers() {
  const target = document.getElementById("verified-producers");
  if (!target) return;
  try {
    const response = await fetch(SUPABASE_URL + "/rest/v1/producers?select=id,business_name,regency_city,description&verification_status=eq.verified&order=business_name.asc", {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
    });
    if (!response.ok) throw new Error("Could not load the supplier directory.");
    const records = await response.json();
    const productProducerSelect = document.getElementById("product-producer");
    if (productProducerSelect) {
      productProducerSelect.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = ""; placeholder.textContent = records.length ? "Select your approved business" : "No approved suppliers available";
      productProducerSelect.appendChild(placeholder);
      records.forEach(producer => {
        const option = document.createElement("option");
        option.value = producer.id;
        option.textContent = producer.business_name + " — " + producer.regency_city;
        option.dataset.region = producer.regency_city || "";
        productProducerSelect.appendChild(option);
      });
      productProducerSelect.disabled = !records.length;
    }
    target.replaceChildren();
    if (!records.length) {
      const empty = document.createElement("p");
      empty.textContent = "No producer profiles have been approved for publication yet. Please check again soon.";
      target.appendChild(empty);
      return;
    }
    records.forEach(p => {
      const card = document.createElement("article");
      card.className = "verified-producer-card";
      const name = document.createElement("h3"); name.textContent = p.business_name;
      const region = document.createElement("small"); region.textContent = p.regency_city;
      const desc = document.createElement("p"); desc.textContent = p.description || "Local producer from West Sumatra.";
      card.append(name, region, desc);
      target.appendChild(card);
    });
  } catch (error) {
    const msg = document.createElement("p");
    msg.textContent = "Supplier directory is temporarily unavailable.";
    target.replaceChildren(msg);
  }
}
loadVerifiedProducers();
