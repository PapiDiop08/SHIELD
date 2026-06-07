import { useState } from "react";
import { C, ROLES, ALL_FRAUD_TYPES, FRAUD_CATEGORIES } from "../theme.js";
import { Card, Badge, Btn, SectionHeader, Modal, Avatar } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

// ── Onboarding steps ───────────────────────────────────────────────────────
const STEPS = [
  { id:"info",      label:"Infos", icon:"🏢" },
  { id:"contacts",  label:"Contacts", icon:"👤" },
  { id:"packs",     label:"Packs & IA", icon:"📦" },
  { id:"fraud",     label:"Types fraude", icon:"🎯" },
  { id:"udf",       label:"Champs CDR", icon:"🗂" },
  { id:"pricing",   label:"Tarification", icon:"💰" },
  { id:"review",    label:"Récapitulatif", icon:"✅" },
];

const PACK_OPTIONS = [
  { id:"mm",      label:"Mobile Money",     desc:"Détection fraude MM, ATO, dépassements comportementaux", icon:"💸", price:50000 },
  { id:"ai",      label:"IA Analyse",       desc:"Accès aux analyses IA standard par module", icon:"🧠", price:100000 },
  { id:"deepai",  label:"IA Approfondie",   desc:"Analyse globale complète, rapports exécutifs, corrélations avancées", icon:"🔬", price:200000 },
  { id:"interop", label:"Inter-opérateur",  desc:"Partage de détections avec d'autres opérateurs partenaires", icon:"🔄", price:30000 },
  { id:"api",     label:"API Blocage",      desc:"Intégration directe pour blocage en temps réel", icon:"⚡", price:80000 },
];

const CDR_TYPES = ["Voice CDR","SMS CDR","Data CDR","Mobile Money CDR","Roaming CDR"];
const DELIVERY_MODES = ["SFTP push","S3 bucket","API REST","Email CSV","Upload manuel"];
const FREQUENCIES = ["Temps réel","5 minutes","15 minutes","30 minutes","1 heure","Quotidien"];

const EMPTY_OP = {
  // Info
  name:"", code:"", country:"SN", timezone:"Africa/Dakar", language:"fr", website:"", notes:"",
  // Contacts
  contacts:[{ name:"",email:"",phone:"",role:"admin_op",isPrimary:true }],
  // Packs
  packs:{ mm:false, ai:false, deepai:false, interop:false, api:false },
  // Fraud types
  fraudTypes: ALL_FRAUD_TYPES.slice(0,8),
  // CDR config
  cdrTypes:["Voice CDR"],
  cdrDelivery:"SFTP push",
  cdrFrequency:"5 minutes",
  cdrFormat:"CSV",
  cdrSeparator:";",
  cdrEncoding:"UTF-8",
  cdrSamplePath:"",
  // Pricing
  monthlyFee:250000, perAlertFee:5, perBlockFee:10, perAIFee:500,
  // Status
  active:true, slaEnabled:false, slaConfig:{critical:2,high:8,medium:24},
};

function StepBar({ steps, current, onGo }) {
  return (
    <div style={{display:"flex",alignItems:"center",marginBottom:28,overflowX:"auto",paddingBottom:4}}>
      {steps.map((s,i)=>{
        const idx = steps.findIndex(x=>x.id===current);
        const done = i < idx;
        const active = s.id === current;
        return (
          <div key={s.id} style={{display:"flex",alignItems:"center",flexShrink:0}}>
            <div onClick={()=>done&&onGo(s.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:done?"pointer":"default"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:done?C.success:active?C.navy:C.mutedL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:done?16:14,fontWeight:700,color:done?C.white:active?C.white:C.muted,border:`2px solid ${done?C.success:active?C.navy:C.mutedL}`}}>
                {done?"✓":s.icon}
              </div>
              <div style={{fontSize:10,fontWeight:active||done?700:400,color:active?C.navy:done?C.success:C.muted,whiteSpace:"nowrap"}}>{s.label}</div>
            </div>
            {i<steps.length-1&&<div style={{width:40,height:2,background:done?C.success:C.mutedL,margin:"0 4px",marginBottom:18,flexShrink:0}}/>}
          </div>
        );
      })}
    </div>
  );
}

export default function Operators({ operators, setOperators, users, setUsers, addLog }) {
  const { currentUser } = useAuth();
  const [view, setView] = useState("list"); // list | create | detail
  const [editOp, setEditOp] = useState(null);
  const [step, setStep] = useState("info");
  const [form, setForm] = useState(EMPTY_OP);
  const [toast, setToast] = useState(null);

  function showToast(msg,c=C.success){ setToast({msg,c}); setTimeout(()=>setToast(null),3000); }

  function startCreate() { setForm(EMPTY_OP); setStep("info"); setEditOp(null); setView("create"); }
  function startEdit(op) { setForm({...EMPTY_OP,...op}); setStep("info"); setEditOp(op); setView("create"); }

  const stepIdx = STEPS.findIndex(s=>s.id===step);
  const isLast = stepIdx===STEPS.length-1;
  const isFirst = stepIdx===0;

  function next() { if (!isLast) setStep(STEPS[stepIdx+1].id); }
  function prev() { if (!isFirst) setStep(STEPS[stepIdx-1].id); }

  function saveOperator() {
    const op = {
      ...form,
      id: editOp?.id || `op${Date.now()}`,
      rules: editOp?.rules||0,
      detections: editOp?.detections||0,
      blocked: editOp?.blocked||0,
      contractStart: editOp?.contractStart||new Date().toISOString().slice(0,10),
      contact: form.contacts[0]?.email||"",
    };
    if (editOp) {
      setOperators(p=>p.map(o=>o.id===editOp.id?op:o));
      addLog?.("EDIT_OPERATOR","operator",op.id,`Modification opérateur ${op.name}`,"Opérateurs");
      showToast(`${op.name} mis à jour`);
    } else {
      setOperators(p=>[...p,op]);
      // Auto-create admin user for operator
      const adminContact = form.contacts.find(c=>c.isPrimary)||form.contacts[0];
      if (adminContact?.email) {
        const u = { id:`u${Date.now()}`, name:adminContact.name||`Admin ${op.name}`, email:adminContact.email, role:"admin", operator:op.name, active:true, lastLogin:"—", avatar:(adminContact.name||"A").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(), createdAt:new Date().toISOString().slice(0,10) };
        setUsers(p=>[...p,u]);
      }
      addLog?.("CREATE_OPERATOR","operator",op.id,`Création opérateur ${op.name} — ${Object.values(form.packs).filter(Boolean).length} packs`,"Opérateurs");
      showToast(`${op.name} créé — Email d'invitation envoyé`);
    }
    setView("list"); setEditOp(null);
  }

  function addContact() { setForm(f=>({...f,contacts:[...f.contacts,{name:"",email:"",phone:"",role:"analyst",isPrimary:false}]})); }
  function updateContact(i,k,v) { setForm(f=>{ const c=[...f.contacts]; c[i]={...c[i],[k]:v}; return {...f,contacts:c}; }); }
  function removeContact(i) { setForm(f=>({...f,contacts:f.contacts.filter((_,idx)=>idx!==i)})); }
  function setPrimary(i) { setForm(f=>({...f,contacts:f.contacts.map((c,idx)=>({...c,isPrimary:idx===i}))})); }

  function toggleFraudType(t) { setForm(f=>({...f,fraudTypes:f.fraudTypes.includes(t)?f.fraudTypes.filter(x=>x!==t):[...f.fraudTypes,t]})); }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (view==="list") return (
    <div style={{padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {toast&&<div style={{position:"fixed",top:20,right:20,background:toast.c,color:C.white,borderRadius:10,padding:"12px 20px",fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>{toast.msg}</div>}

      <SectionHeader title="Opérateurs partenaires" sub={`${operators.filter(o=>o.active).length} actifs · Visible Super Admin uniquement`}
        action={<Btn onClick={startCreate}>+ Onboarder un opérateur</Btn>} />

      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {[{l:"Opérateurs actifs",v:operators.filter(o=>o.active).length,c:C.success},{l:"Mobile Money",v:operators.filter(o=>o.packs?.mm).length,c:C.teal},{l:"Avec IA",v:operators.filter(o=>o.packs?.ai||o.packs?.deepai).length,c:C.purple},{l:"API Blocage",v:operators.filter(o=>o.packs?.api).length,c:C.sky}].map(s=>(
          <Card key={s.l} style={{flex:1,minWidth:100,padding:"12px 16px",borderTop:`3px solid ${s.c}`}}>
            <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
            <div style={{fontSize:11,color:C.textL,marginTop:4}}>{s.l}</div>
          </Card>
        ))}
      </div>

      {operators.map(op=>{
        const opUsers = users.filter(u=>u.operator===op.name&&u.active);
        const totalPackCost = Object.entries(op.packs||{}).filter(([,v])=>v).reduce((a,[k])=>{ const p=PACK_OPTIONS.find(x=>x.id===k); return a+(p?.price||0); },0);
        return (
          <Card key={op.id} style={{padding:"20px 24px",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
              <div style={{width:52,height:52,background:C.skyL,border:`2px solid ${C.sky}44`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:C.sky,flexShrink:0}}>{op.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                  <span style={{fontWeight:900,fontSize:15,color:C.navy}}>{op.name}</span>
                  <Badge label={op.code||"—"} color={C.navyB} small/>
                  <Badge label={op.active?"Actif":"Inactif"} color={op.active?C.success:C.muted} small/>
                  {op.packs?.mm&&<Badge label="💸 MM" color={C.teal} small/>}
                  {op.packs?.ai&&<Badge label="🧠 IA" color={C.purple} small/>}
                  {op.packs?.deepai&&<Badge label="🔬 IA+" color={C.red} small/>}
                  {op.packs?.api&&<Badge label="⚡ API" color={C.sky} small/>}
                  {op.slaEnabled&&<Badge label="⏱ SLA" color={C.warning} small/>}
                </div>
                <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:10}}>
                  {[["Règles",op.rules,C.sky],["Détections",op.detections,C.danger],["Bloqués",op.blocked,C.warning],["Utilisateurs",opUsers.length,C.purple]].map(([l,v,c])=>(
                    <div key={l}><span style={{fontSize:17,fontWeight:800,color:c}}>{v}</span><span style={{fontSize:11,color:C.textL,marginLeft:4}}>{l}</span></div>
                  ))}
                </div>
                <div style={{display:"flex",gap:16,fontSize:12,color:C.muted,flexWrap:"wrap"}}>
                  <span>📧 {op.contact||op.contacts?.[0]?.email||"—"}</span>
                  <span>📅 {op.contractStart}</span>
                  <span>💰 {((op.monthlyFee||0)+totalPackCost).toLocaleString()} XOF/mois</span>
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexDirection:"column",flexShrink:0}}>
                <Btn variant="secondary" small onClick={()=>startEdit(op)}>✏ Modifier</Btn>
                <Btn variant={op.active?"warning":"success"} small onClick={()=>{ setOperators(p=>p.map(o=>o.id===op.id?{...o,active:!o.active}:o)); addLog?.("TOGGLE_OPERATOR","operator",op.id,`${op.name} ${op.active?"désactivé":"activé"}`,"Opérateurs"); showToast(`${op.name} ${op.active?"désactivé":"activé"}`); }}>
                  {op.active?"Désactiver":"Activer"}
                </Btn>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  // ── CREATE / EDIT VIEW ────────────────────────────────────────────────────
  const Field = ({label,k,type="text",placeholder,half}) => (
    <div style={{gridColumn:half?"span 1":"span 2"}}>
      <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>{label}</label>
      <input type={type} value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={placeholder}
        style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box"}}/>
    </div>
  );

  return (
    <div style={{padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {toast&&<div style={{position:"fixed",top:20,right:20,background:toast.c,color:C.white,borderRadius:10,padding:"12px 20px",fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>{toast.msg}</div>}

      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
        <Btn variant="ghost" onClick={()=>setView("list")}>← Retour</Btn>
        <h1 style={{margin:0,fontSize:18,fontWeight:900,color:C.navy}}>{editOp?"Modifier":"Onboarder"} un opérateur{form.name?` — ${form.name}`:""}</h1>
      </div>

      <StepBar steps={STEPS} current={step} onGo={setStep}/>

      <div style={{display:"flex",gap:20}}>
        {/* Main form */}
        <div style={{flex:1}}>
          <Card style={{padding:"24px"}}>

            {/* ── STEP: INFO ── */}
            {step==="info"&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:18}}>🏢 Informations générales</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <div style={{gridColumn:"span 2"}}>
                    <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Nom de l'opérateur *</label>
                    <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Orange Sénégal"
                      style={{width:"100%",border:`2px solid ${C.sky}`,borderRadius:8,padding:"10px 14px",fontSize:15,fontWeight:700,color:C.navy,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  {[["Code opérateur","code","Ex: OG",true],["Pays","country","SN",true],["Fuseau horaire","timezone","Africa/Dakar",true],["Langue","language","fr",true],["Site web","website","https://...",false]].map(([l,k,p,half])=>(
                    <div key={k} style={{gridColumn:half?"span 1":"span 2"}}>
                      <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>{l}</label>
                      <input value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={p}
                        style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box"}}/>
                    </div>
                  ))}
                  <div style={{gridColumn:"span 2"}}>
                    <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Notes internes</label>
                    <textarea value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Contexte, spécificités, historique..."
                      style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",resize:"vertical"}}/>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP: CONTACTS ── */}
            {step==="contacts"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.navy}}>👤 Contacts & Utilisateurs</div>
                  <Btn variant="secondary" small onClick={addContact}>+ Ajouter un contact</Btn>
                </div>
                <div style={{background:C.skyL,border:`1px solid ${C.sky}33`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.navy}}>
                  Le contact principal recevra un email d'invitation pour créer son compte Admin Opérateur.
                </div>
                {form.contacts.map((c,i)=>(
                  <div key={i} style={{background:c.isPrimary?`${C.sky}08`:C.bg,border:`2px solid ${c.isPrimary?C.sky:C.mutedL}`,borderRadius:12,padding:"16px 18px",marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:14,fontWeight:700,color:C.navy}}>Contact {i+1}</span>
                        {c.isPrimary&&<Badge label="⭐ Principal" color={C.sky} small/>}
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        {!c.isPrimary&&<button onClick={()=>setPrimary(i)} style={{background:C.skyL,border:`1px solid ${C.sky}44`,color:C.sky,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontWeight:700}}>Définir principal</button>}
                        {form.contacts.length>1&&<button onClick={()=>removeContact(i)} style={{background:C.dangerL,border:"none",color:C.danger,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:13}}>🗑</button>}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                      {[["Nom complet","name","Ex: Moussa Ndiaye"],["Email professionnel","email","moussa@operateur.sn"],["Téléphone","phone","+221 77 XXX XX XX"]].map(([l,k,p])=>(
                        <div key={k} style={{gridColumn:k==="phone"?"span 1":"span 1"}}>
                          <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>{l}</label>
                          <input value={c[k]||""} onChange={e=>updateContact(i,k,e.target.value)} placeholder={p}
                            style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:C.navy,outline:"none",boxSizing:"border-box"}}/>
                        </div>
                      ))}
                      <div>
                        <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Rôle dans SHIELD</label>
                        <select value={c.role||"analyst"} onChange={e=>updateContact(i,"role",e.target.value)}
                          style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:C.navy,background:C.white,outline:"none"}}>
                          {["admin","analyst","supervisor"].map(r=><option key={r} value={r}>{ROLES[r]?.icon} {ROLES[r]?.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── STEP: PACKS ── */}
            {step==="packs"&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:6}}>📦 Packs & fonctionnalités</div>
                <p style={{margin:"0 0 18px",fontSize:12,color:C.textL}}>Sélectionnez les modules auxquels cet opérateur aura accès. Chaque pack est facturé en supplément du forfait mensuel de base.</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {PACK_OPTIONS.map(p=>{
                    const isOn = form.packs?.[p.id];
                    return (
                      <div key={p.id} onClick={()=>setForm(f=>({...f,packs:{...f.packs,[p.id]:!f.packs?.[p.id]}}))}
                        style={{display:"flex",alignItems:"center",gap:14,background:isOn?C.navyL:C.bg,border:`2px solid ${isOn?C.sky:C.mutedL}`,borderRadius:12,padding:"14px 18px",cursor:"pointer"}}>
                        <span style={{fontSize:22,flexShrink:0}}>{p.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:isOn?C.white:C.navy}}>{p.label}</div>
                          <div style={{fontSize:11,color:isOn?C.muted:C.textL,marginTop:2}}>{p.desc}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:isOn?C.sky:C.muted}}>{p.price.toLocaleString()} XOF/mois</div>
                          <div style={{width:28,height:28,borderRadius:8,background:isOn?C.sky:C.white,border:`2px solid ${isOn?C.sky:C.mutedL}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:isOn?C.white:C.muted,marginLeft:"auto",marginTop:4}}>
                            {isOn?"✓":""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── STEP: FRAUD TYPES ── */}
            {step==="fraud"&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:6}}>🎯 Types de fraude activés</div>
                <p style={{margin:"0 0 18px",fontSize:12,color:C.textL}}>Choisissez les types de fraude pertinents pour cet opérateur. Seuls ces types apparaîtront dans les règles et alertes.</p>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:12,color:C.textL}}>{form.fraudTypes.length} type{form.fraudTypes.length>1?"s":""} sélectionné{form.fraudTypes.length>1?"s":""}</span>
                  <div style={{display:"flex",gap:8}}>
                    <Btn variant="secondary" small onClick={()=>setForm(f=>({...f,fraudTypes:[...ALL_FRAUD_TYPES]}))}>Tout sélectionner</Btn>
                    <Btn variant="ghost" small onClick={()=>setForm(f=>({...f,fraudTypes:[]}))}>Tout déselectionner</Btn>
                  </div>
                </div>
                {Object.entries(FRAUD_CATEGORIES).map(([cat,def])=>(
                  <div key={cat} style={{marginBottom:16}}>
                    <div style={{fontSize:12,fontWeight:700,color:def.color,marginBottom:8}}>{def.icon} {cat}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                      {def.types.map(t=>{
                        const on=form.fraudTypes.includes(t);
                        return (
                          <button key={t} onClick={()=>toggleFraudType(t)}
                            style={{padding:"5px 12px",background:on?`${def.color}18`:C.bg,border:`1px solid ${on?def.color:C.mutedL}`,borderRadius:20,color:on?def.color:C.textL,fontSize:11,fontWeight:on?700:400,cursor:"pointer"}}>
                            {on?"✓ ":""}{t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── STEP: UDF / CDR ── */}
            {step==="udf"&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:6}}>🗂 Configuration CDR</div>
                <p style={{margin:"0 0 18px",fontSize:12,color:C.textL}}>Configurez comment l'opérateur va nous envoyer ses données CDR. Ces paramètres seront utilisés par l'ETL pour ingérer les fichiers.</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <div style={{gridColumn:"span 2"}}>
                    <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>Types de CDR disponibles</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                      {CDR_TYPES.map(t=>{
                        const on=form.cdrTypes?.includes(t);
                        return (
                          <button key={t} onClick={()=>setForm(f=>({...f,cdrTypes:on?f.cdrTypes.filter(x=>x!==t):[...(f.cdrTypes||[]),t]}))}
                            style={{padding:"6px 14px",background:on?`${C.sky}18`:C.bg,border:`1px solid ${on?C.sky:C.mutedL}`,borderRadius:20,color:on?C.sky:C.textL,fontSize:12,fontWeight:on?700:400,cursor:"pointer"}}>
                            {on?"✓ ":""}{t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {[["Mode de livraison","cdrDelivery",DELIVERY_MODES],["Fréquence","cdrFrequency",FREQUENCIES]].map(([l,k,opts])=>(
                    <div key={k}>
                      <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>{l}</label>
                      <select value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                        style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,background:C.white,outline:"none"}}>
                        {opts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  {[["Format fichier","cdrFormat","CSV"],["Séparateur","cdrSeparator",";"],["Encodage","cdrEncoding","UTF-8"]].map(([l,k,p])=>(
                    <div key={k}>
                      <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>{l}</label>
                      <input value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={p}
                        style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box"}}/>
                    </div>
                  ))}
                  <div style={{gridColumn:"span 2"}}>
                    <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Chemin SFTP / Bucket S3 (optionnel)</label>
                    <input value={form.cdrSamplePath||""} onChange={e=>setForm(f=>({...f,cdrSamplePath:e.target.value}))} placeholder="Ex: sftp://ftp.operateur.sn/cdr/ ou s3://bucket-name/prefix/"
                      style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}/>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP: PRICING ── */}
            {step==="pricing"&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:6}}>💰 Tarification</div>
                <p style={{margin:"0 0 18px",fontSize:12,color:C.textL}}>Définissez la structure tarifaire pour cet opérateur. Le total mensuel sera calculé automatiquement dans la page Facturation.</p>

                <div style={{background:C.bg,borderRadius:10,padding:"16px",marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:12}}>Structure de facturation</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    {[["Forfait mensuel de base (XOF)","monthlyFee","Inclut accès plateforme + règles de base"],["Par alerte générée (XOF)","perAlertFee","Facturation à l'usage"],["Par blocage actif (XOF)","perBlockFee","Facturation à l'usage"],["Par analyse IA (XOF)","perAIFee","Par lancement d'analyse"]].map(([l,k,desc])=>(
                      <div key={k}>
                        <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>{l}</label>
                        <input type="number" value={form[k]||0} onChange={e=>setForm(f=>({...f,[k]:parseInt(e.target.value)||0}))} min="0"
                          style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:14,fontWeight:700,color:C.navy,outline:"none",boxSizing:"border-box"}}/>
                        <div style={{fontSize:10,color:C.muted,marginTop:4}}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SLA config */}
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.navy}}>⏱ SLA</div>
                    <button onClick={()=>setForm(f=>({...f,slaEnabled:!f.slaEnabled}))} style={{background:form.slaEnabled?C.successL:C.mutedL,border:`1px solid ${form.slaEnabled?C.success:C.muted}44`,color:form.slaEnabled?C.success:C.muted,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      {form.slaEnabled?"● SLA Activé":"○ SLA Désactivé"}
                    </button>
                  </div>
                  {form.slaEnabled&&(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                      {[["Critique 🔴","critical",C.danger],["Élevé 🟠","high",C.warning],["Moyen 🔵","medium",C.sky]].map(([l,k,color])=>(
                        <div key={k} style={{background:C.bg,borderRadius:8,padding:"12px 14px",border:`1px solid ${color}22`}}>
                          <label style={{display:"block",fontSize:10,fontWeight:700,color,marginBottom:8}}>{l}</label>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <input type="number" value={form.slaConfig?.[k]||0} onChange={e=>setForm(f=>({...f,slaConfig:{...f.slaConfig,[k]:parseInt(e.target.value)||1}}))} min="1"
                              style={{width:54,border:`2px solid ${color}44`,borderRadius:8,padding:"6px 8px",fontSize:16,fontWeight:700,color,background:C.white,outline:"none",textAlign:"center"}}/>
                            <span style={{fontSize:11,color:C.textL}}>h</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Estimated monthly */}
                <div style={{background:C.successL,border:`1px solid ${C.success}44`,borderRadius:10,padding:"14px 18px"}}>
                  <div style={{fontSize:12,color:C.success,fontWeight:600,marginBottom:4}}>Estimation mensuelle (base)</div>
                  <div style={{fontSize:22,fontWeight:900,color:C.success}}>
                    {(form.monthlyFee + Object.entries(form.packs||{}).filter(([,v])=>v).reduce((a,[k])=>{ const p=PACK_OPTIONS.find(x=>x.id===k); return a+(p?.price||0); },0)).toLocaleString()} XOF/mois
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>Hors usage (alertes, blocages, IA)</div>
                </div>
              </div>
            )}

            {/* ── STEP: REVIEW ── */}
            {step==="review"&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:18}}>✅ Récapitulatif — {form.name}</div>

                {[
                  { title:"Informations", icon:"🏢", items:[["Nom",form.name],["Code",form.code],["Pays",form.country],["Timezone",form.timezone]] },
                  { title:"Contacts", icon:"👤", items:form.contacts.map(c=>[`${c.isPrimary?"⭐ ":""}${c.name||"—"}`,`${c.email} · ${ROLES[c.role]?.label||c.role}`]) },
                  { title:"CDR", icon:"🗂", items:[["Types",form.cdrTypes?.join(", ")||"—"],["Livraison",form.cdrDelivery],["Fréquence",form.cdrFrequency],["Format",`${form.cdrFormat} · sep:${form.cdrSeparator}`]] },
                  { title:"Tarification", icon:"💰", items:[["Forfait",`${(form.monthlyFee||0).toLocaleString()} XOF/mois`],["Par alerte",`${form.perAlertFee} XOF`],["Par blocage",`${form.perBlockFee} XOF`],["SLA",form.slaEnabled?"Activé":"Désactivé"]] },
                ].map(sec=>(
                  <div key={sec.title} style={{background:C.bg,borderRadius:10,padding:"14px 16px",marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:10}}>{sec.icon} {sec.title}</div>
                    {sec.items.map(([k,v])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.mutedL}`}}>
                        <span style={{fontSize:12,color:C.textL}}>{k}</span>
                        <span style={{fontSize:12,fontWeight:600,color:C.navy,maxWidth:"60%",textAlign:"right"}}>{v||"—"}</span>
                      </div>
                    ))}
                  </div>
                ))}

                <div style={{background:C.bg,borderRadius:10,padding:"14px 16px",marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:10}}>📦 Packs activés</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {Object.entries(form.packs||{}).filter(([,v])=>v).map(([k])=>{ const p=PACK_OPTIONS.find(x=>x.id===k); return p?<Badge key={k} label={`${p.icon} ${p.label}`} color={C.purple}/>:null; })}
                    {!Object.values(form.packs||{}).some(Boolean)&&<span style={{fontSize:12,color:C.muted}}>Aucun pack activé</span>}
                  </div>
                </div>

                <div style={{background:C.bg,borderRadius:10,padding:"14px 16px",marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:10}}>🎯 Types de fraude ({form.fraudTypes?.length||0})</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {(form.fraudTypes||[]).slice(0,10).map(t=><Badge key={t} label={t} color={C.sky} small/>)}
                    {(form.fraudTypes?.length||0)>10&&<Badge label={`+${form.fraudTypes.length-10} autres`} color={C.muted} small/>}
                  </div>
                </div>

                <div style={{background:C.skyL,border:`1px solid ${C.sky}33`,borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:12,color:C.navy}}>
                  📧 Un email d'invitation sera envoyé à <strong>{form.contacts[0]?.email||"—"}</strong> pour créer son compte Admin Opérateur.
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{display:"flex",gap:8,marginTop:24,paddingTop:16,borderTop:`1px solid ${C.mutedL}`}}>
              {!isFirst&&<Btn variant="ghost" onClick={prev} style={{flex:1,justifyContent:"center"}}>← Précédent</Btn>}
              {isFirst&&<Btn variant="ghost" onClick={()=>setView("list")} style={{flex:1,justifyContent:"center"}}>Annuler</Btn>}
              {!isLast&&<Btn onClick={next} disabled={!form.name} style={{flex:2,justifyContent:"center"}}>Suivant →</Btn>}
              {isLast&&<Btn onClick={saveOperator} style={{flex:2,justifyContent:"center",background:C.success,border:"none",color:C.white}}>
                🚀 {editOp?"Sauvegarder":"Créer l'opérateur"}
              </Btn>}
            </div>
          </Card>
        </div>

        {/* Sidebar summary */}
        <div style={{width:220,flexShrink:0}}>
          <Card style={{padding:"16px 18px",position:"sticky",top:20}}>
            <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:12}}>Résumé</div>
            {form.name&&<div style={{fontSize:14,fontWeight:900,color:C.navy,marginBottom:8}}>{form.name}</div>}
            {form.code&&<Badge label={form.code} color={C.navyB} small/>}
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:11,color:C.textL}}>👤 {form.contacts?.filter(c=>c.email).length||0} contact{form.contacts?.filter(c=>c.email).length>1?"s":""}</div>
              <div style={{fontSize:11,color:C.textL}}>📦 {Object.values(form.packs||{}).filter(Boolean).length} pack{Object.values(form.packs||{}).filter(Boolean).length>1?"s":""}</div>
              <div style={{fontSize:11,color:C.textL}}>🎯 {form.fraudTypes?.length||0} types fraude</div>
              <div style={{fontSize:11,color:C.textL}}>🗂 {form.cdrTypes?.join(", ")||"—"}</div>
            </div>
            <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.mutedL}`}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Estimation mensuelle</div>
              <div style={{fontSize:16,fontWeight:900,color:C.success}}>
                {((form.monthlyFee||0)+Object.entries(form.packs||{}).filter(([,v])=>v).reduce((a,[k])=>{ const p=PACK_OPTIONS.find(x=>x.id===k); return a+(p?.price||0); },0)).toLocaleString()} XOF
              </div>
            </div>
            <div style={{marginTop:10}}>
              {STEPS.map((s,i)=>{
                const idx=STEPS.findIndex(x=>x.id===step);
                const done=i<idx; const active=s.id===step;
                return (
                  <div key={s.id} onClick={()=>done&&setStep(s.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",cursor:done?"pointer":"default"}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:done?C.success:active?C.navy:C.mutedL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:C.white,flexShrink:0,fontWeight:700}}>{done?"✓":i+1}</div>
                    <span style={{fontSize:11,color:active?C.navy:done?C.success:C.muted,fontWeight:active||done?700:400}}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}