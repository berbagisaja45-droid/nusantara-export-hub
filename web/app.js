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

/* MVP pilot contact forms: email hand-off until Supabase is connected. */
function wireMailForm(formId, subjectPrefix) {
 const form=document.getElementById(formId); if(!form)return;
 form.addEventListener("submit",function(event){
  event.preventDefault(); if(!form.reportValidity())return;
  const values=new FormData(form), lines=[];
  for(const [key,value] of values.entries())lines.push(key.replaceAll("_"," ")+": "+value);
  window.location.href="mailto:berbagisaja45@gmail.com?subject="+encodeURIComponent(subjectPrefix)+"&body="+encodeURIComponent(lines.join("\n"));
  const note=document.createElement("p");note.className="form-note";note.textContent="Your email application should open with the inquiry prepared. Please send the email to complete submission.";form.appendChild(note);
 });
}
wireMailForm("producer-form","Nusantara Export Hub — Producer Registration");
wireMailForm("rfq-form","Nusantara Export Hub — Buyer RFQ");
