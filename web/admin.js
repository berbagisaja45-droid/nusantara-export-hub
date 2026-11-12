const SUPABASE_URL = "https://qbvbiaiwlgldxbnkpoyz.supabase.co";
const KEY="sb_publishable_73V0_NwW1j5pZTTdq15mwQ_irBusD0u";
const ENDPOINT=SUPABASE_URL+"/functions/v1/admin-api";
let accessToken=null;
let rfqRecords=[];
const $=id=>document.getElementById(id);
const RFQ_STATUSES=[["new","New"],["reviewing","Reviewing"],["matched","Matched"],["introduced","Introduced"],["closed","Closed"],["rejected","Rejected"]];
function note(id,msg){$(id).textContent=msg;}
async function api(method="GET",body=null,resource="producers"){
 const url=method==="GET"&&resource==="rfqs"?ENDPOINT+"?resource=rfqs":ENDPOINT;
 const r=await fetch(url,{method,headers:{apikey:KEY,Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Request failed");return j;
}
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);
 try{
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({email:f.get("email"),password:f.get("password")})});
  const j=await r.json();if(!r.ok)throw new Error(j.msg||j.message||j.error_description||"Sign in failed");
  accessToken=j.access_token;await Promise.all([loadProducers(),loadRfqs()]);
  $("login-panel").classList.add("hidden");$("dashboard").classList.remove("hidden");
 }catch(err){note("login-note",err.message);}
});
function addCell(tr,value,cls=""){const td=document.createElement("td");td.textContent=value??"—";if(cls)td.className=cls;tr.appendChild(td);return td;}
async function loadProducers(){
 note("admin-note","Loading producer records...");
 try{const j=await api();const rows=$("producer-rows");rows.replaceChildren();
  for(const p of j.producers||[]){const tr=document.createElement("tr");
   [p.business_name,p.regency_city,[p.contact_person,p.email||p.phone_whatsapp].filter(Boolean).join(" · "),p.description,p.verification_status||"pending"].forEach((v,i)=>addCell(tr,v,i===4?"status":""));
   const td=document.createElement("td"),actions=document.createElement("div");actions.className="admin-actions";
   [["verified","Approve"],["rejected","Reject"],["pending","Reset"]].forEach(([status,label])=>{const b=document.createElement("button");b.className="button "+(status==="rejected"?"danger":status==="pending"?"secondary":"");b.textContent=label;b.addEventListener("click",()=>reviewProducer(p.id,status));actions.appendChild(b);});
   td.appendChild(actions);tr.appendChild(td);rows.appendChild(tr);
  }
  note("admin-note",(j.producers||[]).length+" producer record(s) loaded.");
 }catch(err){note("admin-note",err.message);}
}
async function reviewProducer(id,status){if(!confirm("Change producer status to "+status+"?"))return;try{await api("POST",{id,status});await loadProducers();}catch(err){note("admin-note",err.message);}}
function updateRfqSummary(){
 const count=status=>rfqRecords.filter(q=>q.status===status).length;
 $("kpi-rfq-total").textContent=String(rfqRecords.length);
 $("kpi-rfq-new").textContent=String(count("new"));
 $("kpi-rfq-reviewing").textContent=String(count("reviewing"));
 $("kpi-rfq-matched").textContent=String(count("matched")+count("introduced"));
 $("kpi-rfq-closed").textContent=String(count("closed")+count("rejected"));
}
function renderRfqs(){
 const rows=$("rfq-rows");rows.replaceChildren();
 const query=($("rfq-search").value||"").trim().toLowerCase();
 const statusFilter=$("rfq-status-filter").value||"all";
 const filtered=rfqRecords.filter(q=>{
  const searchable=[q.buyer_company,q.contact_name,q.email,q.destination_country,q.product_required,q.quantity,q.target_timeline,q.specifications].filter(Boolean).join(" ").toLowerCase();
  return (!query||searchable.includes(query))&&(statusFilter==="all"||q.status===statusFilter);
 });
 for(const q of filtered){
  const tr=document.createElement("tr");
  addCell(tr,[q.buyer_company,q.contact_name,q.email].filter(Boolean).join(" · "));
  addCell(tr,q.destination_country);addCell(tr,q.product_required);addCell(tr,q.quantity);
  addCell(tr,[q.target_timeline,q.specifications].filter(Boolean).join(" | "));
  addCell(tr,q.created_at?new Date(q.created_at).toLocaleString():"—");
  const td=document.createElement("td"),select=document.createElement("select");select.className="admin-select";
  RFQ_STATUSES.forEach(([value,label])=>{const opt=document.createElement("option");opt.value=value;opt.textContent=label;select.appendChild(opt);});
  select.value=RFQ_STATUSES.some(([v])=>v===q.status)?q.status:"new";
  select.addEventListener("change",()=>updateRfq(q.id,select.value,select));td.appendChild(select);tr.appendChild(td);rows.appendChild(tr);
 }
 if(!filtered.length){const tr=document.createElement("tr"),td=addCell(tr,"No buyer requests match this filter.");td.colSpan=7;rows.appendChild(tr);}
 $("rfq-result-count").textContent=filtered.length+" of "+rfqRecords.length+" request(s) shown.";
}
async function loadRfqs(){
 try{
  const j=await api("GET",null,"rfqs");rfqRecords=j.rfqs||[];
  updateRfqSummary();renderRfqs();
  note("admin-note",rfqRecords.length+" buyer RFQ record(s) loaded from Supabase.");
 }catch(err){note("admin-note","RFQ: "+err.message);}
}
async function updateRfq(id,status,select){
 select.disabled=true;
 try{
  await api("POST",{action:"update_rfq",id,status});
  const refreshed=await api("GET",null,"rfqs");
  rfqRecords=refreshed.rfqs||[];
  const saved=rfqRecords.find(q=>q.id===id);
  if(!saved||saved.status!==status)throw new Error("Supabase has not confirmed the new status. Please refresh and try again.");
  updateRfqSummary();renderRfqs();
  note("admin-note","RFQ status saved and verified in Supabase: "+status+".");
 }catch(err){note("admin-note",err.message);await loadRfqs();}
 finally{if(select.isConnected)select.disabled=false;}
}
$("rfq-search").addEventListener("input",renderRfqs);
$("rfq-status-filter").addEventListener("change",renderRfqs);
$("tab-producers").addEventListener("click",()=>{ $("producer-panel").classList.remove("hidden");$("rfq-panel").classList.add("hidden");$("tab-producers").classList.add("active");$("tab-rfqs").classList.remove("active");});
$("tab-rfqs").addEventListener("click",()=>{ $("rfq-panel").classList.remove("hidden");$("producer-panel").classList.add("hidden");$("tab-rfqs").classList.add("active");$("tab-producers").classList.remove("active");loadRfqs();});
$("refresh").addEventListener("click",()=>Promise.all([loadProducers(),loadRfqs()]));
$("logout").addEventListener("click",()=>{accessToken=null;$("dashboard").classList.add("hidden");$("login-panel").classList.remove("hidden");$("login-form").reset();note("login-note","Signed out.");});
