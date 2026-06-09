import { useState, useMemo } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SearchInput, Select, SectionHeader, Modal, Avatar, ConfirmModal } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

const BL_TYPES = ["MSISDN","IMSI","IMEI","IMEI Préfixe","Préfixe numéro","Cell ID / BTS","Pays","Champ CDR"];
const TYPE_COLORS = { "MSISDN":C.navy,"IMSI":C.sky,"IMEI":C.purple,"IMEI Préfixe":C.warning,"Préfixe numéro":C.danger,"Cell ID / BTS":C.success,"Pays":C.textL,"Champ CDR":C.muted };

export default function Whitelist({ blacklist, setBlacklist, setSimProfile, users, addLog }) {
  const { currentUser, can } = useAuth();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importRaw, setImportRaw] = useState("");
  const [importType, setImportType] = useState("MSISDN");
  const [importReason, setImportReason] = useState("");
  const [addForm, setAddForm] = useState({ type:"MSISDN",value:"",reason:"",notes:"" });
  const [confirm, setConfirm] = useState(null);
  const [detailEntry, setDetailEntry] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(msg,color=C.success){ setToast({msg,color}); setTimeout(()=>setToast(null),3000); }

  const wlEntries = useMemo(() => {
    let list = blacklist.filter(e => e.list === "whitelist");
    if (search) list = list.filter(e => e.value.toLowerCase().includes(search.toLowerCase()) || e.reason.toLowerCase().includes(search.toLowerCase()));
    if (filterType !== "all") list = list.filter(e => e.type === filterType);
    if (filterStatus === "active") list = list.filter(e => e.active);
    if (filterStatus === "inactive") list = list.filter(e => !e.active);
    return list.sort((a,b) => b.date.localeCompare(a.date));
  }, [blacklist, search, filterType, filterStatus]);

  const activeCount = blacklist.filter(e => e.list==="whitelist" && e.active).length;
  const totalCount = blacklist.filter(e => e.list==="whitelist").length;
  const msisdnCount = blacklist.filter(e => e.list==="whitelist" && e.type==="MSISDN").length;
  const imeiCount = blacklist.filter(e => e.list==="whitelist" && e.type==="IMEI").length;

  function addEntry() {
    const entry = { id:Date.now(), list:"whitelist", type:addForm.type, value:addForm.value, reason:addForm.reason, notes:addForm.notes, addedBy:currentUser?.id, date:new Date().toISOString().slice(0,10), active:true, matches:0, lastMatch:null };
    setBlacklist(p => [entry,...p]);
    addLog?.("ADD_WHITELIST","whitelist",entry.id,`Ajout WL ${addForm.type} ${addForm.value} — ${addForm.reason}`,"Whitelist");
    setShowAdd(false);
    setAddForm({ type:"MSISDN",value:"",reason:"",notes:"" });
    showToast("Entrée ajoutée à la Whitelist");
  }

  function removeEntry(id) {
    setBlacklist(p => p.filter(e => e.id !== id));
    addLog?.("REMOVE_WHITELIST","whitelist",id,"Suppression entrée whitelist","Whitelist");
    showToast("Entrée supprimée");
  }

  function toggleEntry(id) {
    setBlacklist(p => p.map(e => e.id===id ? {...e,active:!e.active} : e));
  }

  function moveToBlacklist(id) {
    setBlacklist(p => p.map(e => e.id===id ? {...e,list:"blacklist"} : e));
    addLog?.("MOVE_TO_BLACKLIST","whitelist",id,"Déplacé vers Blacklist","Whitelist");
    showToast("Déplacé vers la Blacklist", C.danger);
  }

  function importEntries() {
    const lines = importRaw.split("\n").map(l=>l.trim()).filter(Boolean);
    const entries = lines.map((v,i) => ({ id:Date.now()+i, list:"whitelist", type:importType, value:v, reason:importReason||"Import batch", addedBy:currentUser?.id, date:new Date().toISOString().slice(0,10), active:true, matches:0, lastMatch:null }));
    setBlacklist(p => [...entries,...p]);
    addLog?.("IMPORT_WHITELIST","whitelist",null,`Import ${lines.length} entrées whitelist`,"Whitelist");
    setShowImport(false); setImportRaw(""); setImportStep(1);
    showToast(`${lines.length} entrées importées`);
  }

  const userName = id => users?.find(u=>u.id===id)?.name?.split(" ")[0] || "Auto";

  return (
    <div style={{ padding:"24px 20px", fontFamily:"'DM Sans','Segoe UI',sans-serif", position:"relative" }}>
      {toast && <div style={{ position:"fixed",top:20,right:20,background:toast.color,color:C.white,borderRadius:10,padding:"12px 20px",fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.15)" }}>{toast.msg}</div>}

      <SectionHeader title="Whitelist" sub="Numéros, IMEI et Cell IDs exemptés de détection"
        action={<>
          <Btn variant="secondary" small onClick={()=>{setShowImport(true);setImportStep(1);}}>📤 Import</Btn>
          <Btn onClick={()=>setShowAdd(true)}>+ Ajouter</Btn>
        </>} />

      {/* Info banner */}
      <div style={{ background:C.successL,border:`1px solid ${C.success}44`,borderRadius:10,padding:"12px 18px",marginBottom:18,display:"flex",alignItems:"center",gap:12 }}>
        <span style={{ fontSize:20 }}>✅</span>
        <div>
          <div style={{ fontSize:13,fontWeight:700,color:C.success }}>Whitelist — Exemptions de détection</div>
          <div style={{ fontSize:11,color:C.textL,marginTop:2 }}>Les entrées whitelist ne déclenchent aucune alerte même si elles correspondent à une règle. Utilisez la whitelist pour les numéros légitimes (service client, machines, partenaires).</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"flex",gap:12,marginBottom:18,flexWrap:"wrap" }}>
        {[{l:"Entrées actives",v:activeCount,c:C.success},{l:"Total entrées",v:totalCount,c:C.navy},{l:"MSISDN",v:msisdnCount,c:C.sky},{l:"IMEI",v:imeiCount,c:C.purple}].map(s=>(
          <Card key={s.l} style={{ flex:1,minWidth:100,padding:"12px 16px",borderTop:`3px solid ${s.c}` }}>
            <div style={{ fontSize:22,fontWeight:900,color:s.c }}>{s.v}</div>
            <div style={{ fontSize:11,color:C.textL,marginTop:4 }}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Valeur, raison..." />
        <Select value={filterType} onChange={setFilterType} options={[{value:"all",label:"Tous types"},...BL_TYPES.map(t=>({value:t,label:t}))]} />
        <Select value={filterStatus} onChange={setFilterStatus} options={[{value:"all",label:"Tous statuts"},{value:"active",label:"Actifs"},{value:"inactive",label:"Inactifs"}]} />
        {(search||filterType!=="all"||filterStatus!=="all") && <button onClick={()=>{setSearch("");setFilterType("all");setFilterStatus("all");}} style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer",fontWeight:600}}>✕</button>}
      </div>

      <div style={{ fontSize:12,color:C.textL,marginBottom:8 }}>{wlEntries.length} entrée{wlEntries.length>1?"s":""}</div>

      {/* Table */}
      <Card style={{ overflow:"hidden" }}>
        <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",minWidth:580 }}>
            <thead>
              <tr style={{ background:C.bg,borderBottom:`2px solid ${C.mutedL}` }}>
                {["Type","Valeur","Raison","Ajouté par","Date","Statut","Actions"].map(h=>(
                  <th key={h} style={{ padding:"10px 12px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"left",whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wlEntries.length===0 && (
                <tr><td colSpan={7} style={{ padding:"48px",textAlign:"center",color:C.muted }}>
                  <div style={{ fontSize:28,marginBottom:8 }}>✅</div>
                  <p style={{ margin:0 }}>Aucune entrée dans la Whitelist</p>
                  <button onClick={()=>setShowAdd(true)} style={{ marginTop:12,background:C.success,color:C.white,border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:700,fontSize:13 }}>+ Ajouter le premier</button>
                </td></tr>
              )}
              {wlEntries.map((e,idx)=>{
                const tc=TYPE_COLORS[e.type]||C.muted;
                const addedUser=users?.find(u=>u.id===e.addedBy);
                return (
                  <tr key={e.id} style={{ borderBottom:`1px solid ${C.mutedL}`,background:idx%2===0?C.white:"#FAFBFE",opacity:e.active?1:0.55 }}
                    onMouseOver={ev=>ev.currentTarget.style.background=C.bg} onMouseOut={ev=>ev.currentTarget.style.background=idx%2===0?C.white:"#FAFBFE"}>
                    <td style={{ padding:"10px 12px" }}><Badge label={e.type} color={tc} small /></td>
                    <td style={{ padding:"10px 12px",cursor:"pointer" }} onClick={()=>setDetailEntry(e)}>
                      <div style={{ fontFamily:"monospace",fontSize:12,fontWeight:700,color:C.navy }}>{e.value}</div>
                      {e.lastMatch && <div style={{ fontSize:10,color:C.muted }}>Dernier match : {e.lastMatch}</div>}
                    </td>
                    <td style={{ padding:"10px 12px",fontSize:11,color:C.textL,maxWidth:200 }}><div style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.reason}</div></td>
                    <td style={{ padding:"10px 12px" }}>
                      {addedUser ? <div style={{ display:"flex",alignItems:"center",gap:5 }}><Avatar user={addedUser} size={18}/><span style={{ fontSize:10,color:C.textL }}>{addedUser.name.split(" ")[0]}</span></div> : <span style={{ fontSize:10,color:C.muted }}>Auto</span>}
                    </td>
                    <td style={{ padding:"10px 12px",fontSize:11,color:C.muted,whiteSpace:"nowrap" }}>{e.date}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <button onClick={()=>toggleEntry(e.id)} style={{ background:e.active?C.successL:C.mutedL,border:`1px solid ${e.active?C.success:C.muted}44`,color:e.active?C.success:C.muted,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>
                        {e.active?"● Actif":"○ Inactif"}
                      </button>
                    </td>
                    <td style={{ padding:"8px 12px" }}>
                      <div style={{ display:"flex",gap:4 }}>
                        {e.type==="MSISDN"&&<Btn variant="sky" small onClick={()=>setSimProfile({msisdn:e.value,score:10,fraudType:"Whitelist"})}>SIM</Btn>}
                        <Btn variant="danger" small onClick={()=>setConfirm({msg:`Déplacer ${e.value} vers la Blacklist ?`,action:"blacklist",id:e.id})}>→ BL</Btn>
                        <button onClick={()=>setConfirm({msg:`Supprimer ${e.value} de la Whitelist ?`,action:"delete",id:e.id})} style={{ background:C.dangerL,border:"none",color:C.danger,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:13 }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Modal */}
      {showAdd && (
        <Modal title="Ajouter à la Whitelist" onClose={()=>setShowAdd(false)} width={480}>
          <div style={{ padding:"18px 20px" }}>
            <div style={{ background:C.successL,border:`1px solid ${C.success}44`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.textL }}>
              ✅ Les entrées whitelist ne génèrent aucune alerte même en cas de correspondance avec une règle.
            </div>
            <p style={{ margin:"0 0 8px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Type</p>
            <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:12 }}>
              {BL_TYPES.map(t=><button key={t} onClick={()=>setAddForm(f=>({...f,type:t}))} style={{ padding:"4px 9px",background:addForm.type===t?(TYPE_COLORS[t]+"18"):C.bg,border:`1px solid ${addForm.type===t?TYPE_COLORS[t]:C.mutedL}`,borderRadius:8,color:addForm.type===t?TYPE_COLORS[t]:C.textL,cursor:"pointer",fontSize:11,fontWeight:addForm.type===t?700:400 }}>{t}</button>)}
            </div>
            <p style={{ margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Valeur</p>
            <input value={addForm.value} onChange={e=>setAddForm(f=>({...f,value:e.target.value}))} placeholder="Ex: 77100XXXXX"
              style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",fontFamily:"monospace",marginBottom:12 }} />
            <p style={{ margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Raison</p>
            <input value={addForm.reason} onChange={e=>setAddForm(f=>({...f,reason:e.target.value}))} placeholder="Ex: Service client Orange, numéro machine..."
              style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",marginBottom:12 }} />
            <p style={{ margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Notes (optionnel)</p>
            <textarea value={addForm.notes} onChange={e=>setAddForm(f=>({...f,notes:e.target.value}))} rows={2}
              style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:C.navy,outline:"none",boxSizing:"border-box",resize:"vertical",marginBottom:18 }} />
            <div style={{ display:"flex",gap:8 }}>
              <Btn variant="ghost" onClick={()=>setShowAdd(false)} style={{ flex:1,justifyContent:"center" }}>Annuler</Btn>
              <Btn onClick={addEntry} disabled={!addForm.value||!addForm.reason} style={{ flex:2,justifyContent:"center",background:C.success,border:"none",color:C.white }}>✅ Ajouter à la Whitelist</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImport && (
        <Modal title="Import batch — Whitelist" onClose={()=>setShowImport(false)} width={480}>
          <div style={{ height:3,background:C.mutedL }}><div style={{ height:"100%",width:`${importStep/2*100}%`,background:C.success,transition:"width 0.3s" }} /></div>
          <div style={{ padding:"18px 20px" }}>
            {importStep===1 ? (
              <div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:12 }}>
                  {BL_TYPES.map(t=><button key={t} onClick={()=>setImportType(t)} style={{ padding:"4px 9px",background:importType===t?(TYPE_COLORS[t]+"18"):C.bg,border:`1px solid ${importType===t?TYPE_COLORS[t]:C.mutedL}`,borderRadius:8,color:importType===t?TYPE_COLORS[t]:C.textL,cursor:"pointer",fontSize:11,fontWeight:importType===t?700:400 }}>{t}</button>)}
                </div>
                <input value={importReason} onChange={e=>setImportReason(e.target.value)} placeholder="Raison de l'exemption..."
                  style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",marginBottom:12 }} />
                <textarea value={importRaw} onChange={e=>setImportRaw(e.target.value)} placeholder={"77100XXXXX\n77200XXXXX..."} rows={7}
                  style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.navy,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"monospace" }} />
                <p style={{ margin:"4px 0 14px",fontSize:11,color:C.muted }}>{importRaw.split("\n").filter(Boolean).length} entrées</p>
                <div style={{ display:"flex",gap:8 }}>
                  <Btn variant="ghost" onClick={()=>setShowImport(false)} style={{ flex:1,justifyContent:"center" }}>Annuler</Btn>
                  <Btn onClick={()=>setImportStep(2)} disabled={!importRaw.trim()} style={{ flex:2,justifyContent:"center" }}>Prévisualiser →</Btn>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background:C.bg,borderRadius:10,padding:"12px 14px",marginBottom:14 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:C.navy,marginBottom:8 }}>{importRaw.split("\n").filter(Boolean).length} entrées · {importType}</div>
                  {importRaw.split("\n").filter(Boolean).slice(0,6).map((v,i)=><div key={i} style={{ fontFamily:"monospace",fontSize:12,color:C.navy,padding:"3px 0",borderBottom:`1px solid ${C.mutedL}` }}>{v}</div>)}
                  {importRaw.split("\n").filter(Boolean).length>6&&<p style={{ margin:"6px 0 0",fontSize:11,color:C.muted }}>+ {importRaw.split("\n").filter(Boolean).length-6} autres...</p>}
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <Btn variant="ghost" onClick={()=>setImportStep(1)} style={{ flex:1,justifyContent:"center" }}>← Modifier</Btn>
                  <Btn onClick={importEntries} style={{ flex:2,justifyContent:"center",background:C.success,border:"none",color:C.white }}>✅ Confirmer l'import</Btn>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Confirm */}
      {confirm && (
        <ConfirmModal title="Confirmation" message={confirm.msg}
          confirmLabel={confirm.action==="blacklist"?"→ Blacklister":"Supprimer"}
          confirmColor={C.danger}
          onConfirm={()=>{ if(confirm.action==="delete") removeEntry(confirm.id); else if(confirm.action==="blacklist") moveToBlacklist(confirm.id); setConfirm(null); }}
          onCancel={()=>setConfirm(null)} />
      )}
    </div>
  );
}