const SUPABASE_URL="https://qbvbiaiwlgldxbnkpoyz.supabase.co";
const KEY="sb_publishable_73V0_NwW1j5pZTTdq15mwQ_irBusD0u";
const ENDPOINT=SUPABASE_URL+"/functions/v1/admin-api";
let accessToken=null;
const $=id=>document.getElementById(id);
function note(id,msg){$(id).textContent=msg;}
async function api(method="GET",body=null){
 const r=await fetch(ENDPOINT,{method,headers:{apikey:KEY,Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json().catch(()=>({}));
 if(!r.ok) throw new Error(j.error||"Request failed"); return j;
}
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);
 try{
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({email:f.get("email"),password:f.get("password")})});
  const j=await r.json();if(!r.ok)throw new Error(j.msg||j.message||j.error_description||"Sign in failed");
  accessToken=j.access_token;await loadProducers();$("login-panel").classList.add("hidden");$("dashboard").classList.remove("hidden");
 }catch(err){note("login-note",err.message);}
});
async function loadProducers(){
 note("admin-note","Loading producer records...");
 try{const j=await api();const rows=$("producer-rows");rows.innerHTML="";
  for(const p of j.producers||[]){
   const tr=document.createElement("tr");
   const vals=[p.business_name||"",p.regency_city||"",[p.contact_person,p.email||p.phone_whatsapp].filter(Boolean).join(" · "),p.description||"",p.verification_status||"pending"];
   vals.forEach((v,i)=>{const td=document.createElement("td");td.textContent=v;if(i===4)td.className="status";tr.appendChild(td);});
   const td=document.createElement("td");const actions=document.createElement("div");actions.className="admin-actions";
   [["verified","Approve"],["rejected","Reject"],["pending","Reset"]].forEach(([status,label])=>{const b=document.createElement("button");b.className="button "+(status==="rejected"?"danger":status==="pending"?"secondary":"");b.textContent=label;b.addEventListener("click",()=>review(p.id,status));actions.appendChild(b);});
   td.appendChild(actions);tr.appendChild(td);rows.appendChild(tr);
  }
  note("admin-note",(j.producers||[]).length+" producer record(s). Public catalogue shows verified profiles only.");
 }catch(err){note("admin-note",err.message);}
}
async function review(id,status){if(!confirm("Change producer status to "+status+"?"))return;try{await api("POST",{id,status});await loadProducers();}catch(err){note("admin-note",err.message);}}
$("refresh").addEventListener("click",loadProducers);
$("logout").addEventListener("click",()=>{accessToken=null;$("dashboard").classList.add("hidden");$("login-panel").classList.remove("hidden");$("login-form").reset();note("login-note","Signed out.");});