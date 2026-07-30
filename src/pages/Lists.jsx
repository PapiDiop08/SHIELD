import { useState, useMemo } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SearchInput, Select, SectionHeader, Modal, Avatar, ConfirmModal } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

const TYPE_COLORS = { "MSISDN":C.navy,"IMSI":C.sky,"IMEI":C.purple,"IMEI Préfixe":C.warning,"Préfixe numéro":C.danger,"Cell ID / BTS":C.success,"Pays":C.textL,"Champ CDR":C.muted };
const BL_TYPES = ["MSISDN","IMSI","IMEI","IMEI Préfixe","Préfixe numéro","Cell ID / BTS","Pays","Champ CDR"];
const TAB_COLOR = { blacklist:C.danger,whitelist:C.success,watchlist:C.warning,greylist:C.muted };
const TAB_LABEL = { blacklist:"Blacklist",whitelist:"Whitelist",watchlist:"Watchlist",greylist:"Greylist" };

export default function Lists({ blacklist, setBlacklist, setSimProfile, users, addLog, addEntry, toggleEntry, deleteEntry, moveEntry }) {
  const { currentUser, can } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [detailEntry, setDetailEntry] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [addForm, setAddForm] = useState({ type:"MSISDN",value:"",reason:"",daysWatch:7 });
  const [importRaw, setImportRaw] = useState("");
  const [importType, setImportType] = useState("MSISDN");
  const [importReason, setImportReason] = useState("");
  const [toast, setToast] = useState(null);
  const [groupView, setGroupView] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  function showToast(msg,color=C.success){ setToast({msg,color}); setTimeout(()=>setToast(null),3000); }
  function toggleGroup(type){ setExpandedGroups(prev=>{ const s=new Set(prev); s.has(type)?s.delete(type):s.add(type); return s; }); }

  const current = useMemo(() => {
    let list = activeTab === "all" ? blacklist : blacklist.filter(e => e.list === activeTab);
    if (search) list = list.filter(e => e.value.toLowerCase().includes(search.toLowerCase()) || e.reason.toLowerCase().includes(search.toLowerCase()));
    if (filterType !== "all") list = list.filter(e => e.type === filterType);
    if (filterStatus === "active") list = list.filter(e => e.active);
    if (filterStatus === "inactive") list = list.filter(e => !e.active);
    list.sort((a,b) => {
      let va = sortBy==="matches"?(a.matches||0):sortBy==="value"?a.value:sortBy==="type"?a.type:a.date;
      let vb = sortBy==="matches"?(b.matches||0):sortBy==="value"?b.value:sortBy==="type"?b.type:b.date;
      if(va<vb) return sortDir==="asc"?-1:1;
      if(va>vb) return sortDir==="asc"?1:-1;
      return 0;
    });
    return list;
  },[blacklist,activeTab,search,filterType,filterStatus,sortBy,sortDir]);

  const bl = blacklist.filter(e=>e.list==="blacklist");
  const wl = blacklist.filter(e=>e.list==="whitelist");
  const wa = blacklist.filter(e=>e.list==="watchlist");
  const gl = blacklist.filter(e=>e.list==="greylist");

  function handleToggle(id){ setBlacklist(p=>{ const e=p.find(x=>x.id===id); if(toggleEntry) toggleEntry(id, !e?.active); return p.map(x=>x.id===id?{...x,active:!x.active}:x); }); }
  function handleDelete(id){ setBlacklist(p=>p.filter(e=>e.id!==id)); if(deleteEntry) deleteEntry(id); showToast("Supprimé"); }
  function handleMove(id,target){ setBlacklist(p=>p.map(e=>e.id===id?{...e,list:target}:e)); if(moveEntry) moveEntry(id,target); showToast(`→ ${TAB_LABEL[target]}`,TAB_COLOR[target]); }

  function doGroupAction(action){
    if(action==="delete"){ setBlacklist(p=>p.filter(e=>!selected.includes(e.id))); showToast(`${selected.length} supprimés`); }
    if(action==="disable"){ setBlacklist(p=>p.map(e=>selected.includes(e.id)?{...e,active:false}:e)); showToast("Désactivés"); }
    if(action==="enable"){ setBlacklist(p=>p.map(e=>selected.includes(e.id)?{...e,active:true}:e)); showToast("Activés"); }
    if(action==="whitelist"){ setBlacklist(p=>p.map(e=>selected.includes(e.id)?{...e,list:"whitelist"}:e)); showToast("→ Whitelist",C.success); }
    if(action==="blacklist"){ setBlacklist(p=>p.map(e=>selected.includes(e.id)?{...e,list:"blacklist"}:e)); showToast("→ Blacklist",C.danger); }
    setSelected([]);
  }

  function handleAdd(){
    const targetList = activeTab === "all" ? "blacklist" : activeTab;
    const entry={ id:Date.now(),list:targetList,type:addForm.type,value:addForm.value,reason:addForm.reason,addedBy:currentUser?.id,date:new Date().toISOString().slice(0,10),active:true,matches:0,lastMatch:null,...(targetList==="watchlist"?{daysLeft:addForm.daysWatch}:{}) };
    setBlacklist(p=>[entry,...p]);
    if(addEntry) addEntry(entry);
    addLog?.("ADD_"+targetList.toUpperCase(),targetList,entry.id,`Ajout ${addForm.type} ${addForm.value} — ${addForm.reason}`,"Listes");
    setShowAdd(false); setAddForm({type:"MSISDN",value:"",reason:"",daysWatch:7});
    showToast(`Ajouté`,TAB_COLOR[targetList]||C.navy);
  }

  function importEntries(){
    const targetList = activeTab === "all" ? "blacklist" : activeTab;
    const lines = importRaw.split("\n").map(l=>l.trim()).filter(Boolean);
    const entries = lines.map((v,i)=>({ id:Date.now()+i,list:targetList,type:importType,value:v,reason:importReason||"Import batch",addedBy:currentUser?.id,date:new Date().toISOString().slice(0,10),active:true,matches:0,lastMatch:null }));
    setBlacklist(p=>[...entries,...p]);
    addLog?.("IMPORT_BATCH",targetList,null,`Import ${lines.length} entrées — ${targetList}`,"Listes");
    setShowImport(false); setImportRaw(""); setImportStep(1);
    showToast(`${lines.length} entrées importées`,TAB_COLOR[targetList]||C.navy);
  }

  const allSel = current.length>0&&current.every(e=>selected.includes(e.id));
  const userName = id => users?.find(u=>u.id===id)?.name||id||"Auto";

  return (
    <div style={{ padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif",position:"relative" }}>
      {toast&&<div style={{ position:"fixed",top:20,right:20,background:toast.color,color:C.white,borderRadius:10,padding:"12px 20px",fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}

      <SectionHeader title="Listes de contrôle" sub={`${bl.filter(e=>e.active).length} BL · ${wl.filter(e=>e.active).length} WL · ${wa.filter(e=>e.active).length} WA`}
        action={<>
          <Btn variant="secondary" small onClick={()=>{setShowImport(true);setImportStep(1);}}>Export Import</Btn>
          <Btn small onClick={()=>setShowAdd(true)}>+ Ajouter</Btn>
        </>} />

      {/* Stats */}
      <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
        {[{l:"Blacklist",n:bl.length,a:bl.filter(e=>e.active).length,c:C.danger,t:"blacklist"},{l:"Whitelist",n:wl.length,a:wl.filter(e=>e.active).length,c:C.success,t:"whitelist"},{l:"Watchlist",n:wa.length,a:wa.filter(e=>e.active).length,c:C.warning,t:"watchlist"},{l:"Greylist",n:gl.length,a:gl.filter(e=>e.active).length,c:C.muted,t:"greylist"},{l:"Correspondances",n:blacklist.reduce((a,e)=>a+(e.matches||0),0),c:C.sky}].map(s=>(
          <div key={s.l} onClick={()=>s.t&&setActiveTab(s.t)} style={{ flex:1,minWidth:100,background:C.white,border:`1px solid ${s.t===activeTab?s.c:C.mutedL}`,borderTop:`3px solid ${s.c}`,borderRadius:12,padding:"12px 16px",cursor:s.t?"pointer":"default" }}>
            <div style={{ fontSize:22,fontWeight:900,color:s.c }}>{s.n}</div>
            {s.a!==undefined&&<div style={{ fontSize:10,color:C.success,fontWeight:600 }}>{s.a} actives</div>}
            <div style={{ fontSize:11,color:C.textL,marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs — Toutes | Blacklist | Whitelist | Watchlist | Greylist */}
      <div style={{ display:"flex",gap:4,marginBottom:14,background:C.white,border:`1px solid ${C.mutedL}`,borderRadius:12,padding:5,flexWrap:"wrap" }}>
        <button onClick={()=>{setActiveTab("all");setSelected([]);}} style={{ flex:1,minWidth:70,padding:"9px 10px",background:activeTab==="all"?C.navy:"none",border:"none",borderRadius:8,cursor:"pointer",color:activeTab==="all"?C.white:C.textL,fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
          Toutes <span style={{ background:activeTab==="all"?"rgba(255,255,255,0.25)":C.mutedL,color:activeTab==="all"?C.white:C.textL,borderRadius:12,padding:"1px 7px",fontSize:10,fontWeight:800 }}>{blacklist.length}</span>
        </button>
        {["blacklist","whitelist","watchlist","greylist"].map(tab=>(
          <button key={tab} onClick={()=>{setActiveTab(tab);setSelected([]);}} style={{ flex:1,minWidth:70,padding:"9px 10px",background:activeTab===tab?TAB_COLOR[tab]:"none",border:"none",borderRadius:8,cursor:"pointer",color:activeTab===tab?C.white:C.textL,fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
            {TAB_LABEL[tab]}
            <span style={{ background:activeTab===tab?"rgba(255,255,255,0.25)":C.mutedL,color:activeTab===tab?C.white:C.textL,borderRadius:12,padding:"1px 7px",fontSize:10,fontWeight:800 }}>
              {tab==="blacklist"?bl.length:tab==="whitelist"?wl.length:tab==="watchlist"?wa.length:gl.length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Valeur, raison..." />
        <Select value={filterType} onChange={setFilterType} options={[{value:"all",label:"Tous types"},...BL_TYPES.map(t=>({value:t,label:t}))]} />
        <Select value={filterStatus} onChange={setFilterStatus} options={[{value:"all",label:"Statut"},{value:"active",label:"Actifs"},{value:"inactive",label:"Inactifs"}]} />
        <Select value={`${sortBy}-${sortDir}`} onChange={v=>{const[b,d]=v.split("-");setSortBy(b);setSortDir(d);}} options={[{value:"date-desc",label:"Date ↓"},{value:"date-asc",label:"Date ↑"},{value:"matches-desc",label:"Matches ↓"},{value:"value-asc",label:"Valeur A→Z"},{value:"type-asc",label:"Type A→Z"}]} />
        <button onClick={()=>setGroupView(g=>!g)} style={{ padding:"7px 12px", background: groupView ? C.navy : C.white, border:`1px solid ${groupView ? C.navy : C.mutedL}`, color: groupView ? C.white : C.textL, borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
          {groupView ? "☰ Plat" : "⊞ Par type"}
        </button>
        {(search||filterType!=="all"||filterStatus!=="all")&&<button onClick={()=>{setSearch("");setFilterType("all");setFilterStatus("all");}} style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer",fontWeight:600}}>✕</button>}
      </div>

      {/* Group actions */}
      {selected.length>0&&(
        <div style={{ background:C.navy,borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap" }}>
          <span style={{ color:C.white,fontWeight:700,fontSize:12 }}>{selected.length} sélectionné{selected.length>1?"s":""}</span>
          <button onClick={()=>setSelected(current.map(e=>e.id))} style={{ background:"none",border:`1px solid ${C.navyB}`,color:C.sky,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11 }}>Tout ({current.length})</button>
          <button onClick={()=>setSelected([])} style={{ background:"none",border:`1px solid ${C.navyB}`,color:C.muted,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11 }}>Désélectionner</button>
          <div style={{ flex:1 }} />
          <Btn variant="success" small onClick={()=>doGroupAction("enable")}>▶ Activer</Btn>
          <Btn variant="warning" small onClick={()=>doGroupAction("disable")}>⏸ Désactiver</Btn>
          {activeTab==="blacklist"&&<Btn variant="sky" small onClick={()=>doGroupAction("whitelist")}>OK → WL</Btn>}
          {activeTab!=="blacklist"&&<Btn variant="danger" small onClick={()=>doGroupAction("blacklist")}>→ BL</Btn>}
          <Btn variant="danger" small onClick={()=>setConfirm({msg:`Supprimer ${selected.length} entrée(s) ?`,action:"delete"})}>Del</Btn>
        </div>
      )}

      <div style={{ fontSize:12,color:C.textL,marginBottom:8 }}>{current.length} entrée{current.length>1?"s":""}</div>

      {/* ── VUE GROUPÉE PAR TYPE ────────────────────────────────────── */}
      {groupView && (() => {
        // Regrouper par type
        const groups = {};
        current.forEach(e => { if(!groups[e.type]) groups[e.type]=[]; groups[e.type].push(e); });
        const orderedTypes = BL_TYPES.filter(t => groups[t]);
        const otherTypes   = Object.keys(groups).filter(t => !BL_TYPES.includes(t));
        const allTypes = [...orderedTypes, ...otherTypes];
        if (allTypes.length === 0) return <Card style={{ padding:"40px 24px", textAlign:"center", color:C.muted }}>Aucune entrée</Card>;
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {allTypes.map(type => {
              const entries = groups[type];
              const isOpen  = expandedGroups.has(type);
              const tc      = TYPE_COLORS[type] || C.muted;
              const matches = entries.reduce((s,e)=>s+(e.matches||0),0);
              const active  = entries.filter(e=>e.active).length;
              return (
                <Card key={type} style={{ overflow:"hidden" }}>
                  {/* Header du groupe */}
                  <div onClick={()=>toggleGroup(type)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", cursor:"pointer", background: isOpen ? tc+"0A" : C.white, borderBottom: isOpen ? `1px solid ${tc}22` : "none" }}
                    onMouseOver={e=>e.currentTarget.style.background=tc+"10"}
                    onMouseOut={e=>e.currentTarget.style.background=isOpen?tc+"0A":C.white}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:tc, flexShrink:0 }} />
                    <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:900, color:C.navy }}>{type}</span>
                      <span style={{ background:tc+"18", color:tc, border:`1px solid ${tc}33`, borderRadius:12, padding:"1px 9px", fontSize:11, fontWeight:800 }}>{entries.length}</span>
                      <span style={{ fontSize:11, color:C.muted }}>{active} actif{active>1?"s":""}</span>
                      {matches > 0 && <span style={{ fontSize:11, color:C.warning, fontWeight:700 }}>⚡ {matches} matches</span>}
                    </div>
                    <span style={{ fontSize:18, color:tc, fontWeight:700, transform: isOpen?"rotate(90deg)":"rotate(0deg)", transition:"transform 0.2s", flexShrink:0 }}>›</span>
                  </div>
                  {/* Entrées du groupe */}
                  {isOpen && (
                    <div>
                      {entries.map((e, i) => (
                        <div key={e.id} onClick={()=>setDetailEntry(e)} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 18px",
                          borderBottom: i < entries.length-1 ? `1px solid ${C.mutedL}` : "none",
                          background: i%2===0?C.white:"#FAFBFE", cursor:"pointer",
                          opacity: e.active ? 1 : 0.5 }}
                          onMouseOver={ev=>ev.currentTarget.style.background=C.bg}
                          onMouseOut={ev=>ev.currentTarget.style.background=i%2===0?C.white:"#FAFBFE"}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:C.navy }}>{e.value}</div>
                            <div style={{ fontSize:11, color:C.textL, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.reason}</div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                            {e.matches>0 && <span style={{ fontSize:12, fontWeight:800, color:C.warning }}>⚡{e.matches}</span>}
                            <span style={{ fontSize:10, color:C.muted }}>{e.date}</span>
                            <span style={{ background:e.active?C.successL:C.mutedL, color:e.active?C.success:C.muted, border:`1px solid ${e.active?C.success:C.muted}44`, borderRadius:12, padding:"2px 8px", fontSize:10, fontWeight:700 }}>
                              {e.active?"● Actif":"○ Inactif"}
                            </span>
                            {e.type==="MSISDN"&&<button onClick={ev=>{ev.stopPropagation();setSimProfile({msisdn:e.value,score:75,fraudType:e.reason});}} style={{ background:C.skyL, border:`1px solid ${C.sky}33`, color:C.sky, borderRadius:6, padding:"3px 8px", cursor:"pointer", fontSize:11, fontWeight:700 }}>SIM →</button>}
                            <button onClick={ev=>{ev.stopPropagation();setConfirm({msg:`Supprimer ${e.value} ?`,action:"delete_one",id:e.id});}} style={{ background:C.dangerL, border:"none", color:C.danger, borderRadius:6, padding:"3px 7px", cursor:"pointer", fontSize:12 }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ── VUE PLATE (tableau) ─────────────────────────────────────── */}
      {!groupView && <Card style={{ overflow:"hidden" }}>
        <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",minWidth:650 }}>
            <thead>
              <tr style={{ background:C.bg,borderBottom:`2px solid ${C.mutedL}` }}>
                <th style={{ padding:"10px 10px",width:36 }}>
                  <input type="checkbox" checked={allSel} onChange={()=>allSel?setSelected([]):setSelected(current.map(e=>e.id))} style={{ cursor:"pointer",accentColor:C.red }} />
                </th>
                {[["Type","type"],["Valeur","value"],["Raison",null],["Ajouté par",null],["Date","date"],["Matches","matches"],["Statut",null],["Actions",null]].map(([h,sk])=>(
                  <th key={h} onClick={sk ? () => { setSortBy(sk); setSortDir(d => d === "asc" ? "desc" : "asc"); } : undefined} style={{ padding:"10px 10px",fontSize:10,fontWeight:700,color:sortBy===sk?C.navy:C.muted,textTransform:"uppercase",textAlign:"left",cursor:sk?"pointer":"default",whiteSpace:"nowrap" }}>
                    {h}{sk&&sortBy===sk&&(sortDir==="asc"?" ↑":" ↓")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.length===0&&<tr><td colSpan={9} style={{ padding:"40px",textAlign:"center",color:C.muted }}>Aucune entrée</td></tr>}
              {current.map((e,idx)=>{
                const tc=TYPE_COLORS[e.type]||C.muted;
                const isSel=selected.includes(e.id);
                const addedUser=users?.find(u=>u.id===e.addedBy);
                return (
                  <tr key={e.id} style={{ borderBottom:`1px solid ${C.mutedL}`,background:isSel?C.skyL:idx%2===0?C.white:"#FAFBFE",opacity:e.active?1:0.55 }}
                    onMouseOver={ev=>!isSel&&(ev.currentTarget.style.background=C.bg)} onMouseOut={ev=>!isSel&&(ev.currentTarget.style.background=idx%2===0?C.white:"#FAFBFE")}>
                    <td style={{ padding:"10px" }}><input type="checkbox" checked={isSel} onChange={()=>setSelected(p=>p.includes(e.id)?p.filter(x=>x!==e.id):[...p,e.id])} style={{ cursor:"pointer",accentColor:C.red }} /></td>
                    <td style={{ padding:"10px" }}><Badge label={e.type} color={tc} small /></td>
                    <td style={{ padding:"10px",cursor:"pointer",minWidth:140 }} onClick={()=>setDetailEntry(e)}>
                      <div style={{ fontFamily:"monospace",fontSize:12,fontWeight:700,color:C.navy }}>{e.value}</div>
                      {e.lastMatch&&<div style={{ fontSize:10,color:C.muted }}>Dernier match : {e.lastMatch}</div>}
                      {e.daysLeft!==undefined&&<div style={{ fontSize:10,color:C.warning,fontWeight:600 }}>⏱ {e.daysLeft}j</div>}
                    </td>
                    <td style={{ padding:"10px",fontSize:11,color:C.textL,maxWidth:200 }}><div style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.reason}</div></td>
                    <td style={{ padding:"10px" }}>
                      {addedUser?<div style={{ display:"flex",alignItems:"center",gap:5 }}><Avatar user={addedUser} size={18} /><span style={{ fontSize:10,color:C.textL,whiteSpace:"nowrap" }}>{addedUser.name.split(" ")[0]}</span></div>:<span style={{ fontSize:10,color:C.muted }}>Auto</span>}
                    </td>
                    <td style={{ padding:"10px",fontSize:11,color:C.muted,whiteSpace:"nowrap" }}>{e.date}</td>
                    <td style={{ padding:"10px",textAlign:"center" }}>{e.matches>0?<span style={{ fontSize:15,fontWeight:900,color:TAB_COLOR[activeTab] }}>{e.matches}</span>:<span style={{ color:C.muted }}>—</span>}</td>
                    <td style={{ padding:"10px" }}>
                      <button onClick={()=>handleToggle(e.id)} style={{ background:e.active?C.successL:C.mutedL,border:`1px solid ${e.active?C.success:C.muted}44`,color:e.active?C.success:C.muted,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>
                        {e.active?"● Actif":"○ Inactif"}
                      </button>
                    </td>
                    <td style={{ padding:"8px 10px" }}>
                      <div style={{ display:"flex",gap:4 }}>
                        <button onClick={()=>setDetailEntry(e)} style={{ background:C.navyL,border:"none",color:C.white,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,fontWeight:700 }}>Détails</button>
                        {e.type==="MSISDN"&&<button onClick={()=>setSimProfile({msisdn:e.value,score:75,fraudType:e.reason})} style={{ background:C.skyL,border:`1px solid ${C.sky}33`,color:C.sky,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,fontWeight:700 }}>SIM</button>}
                        <button onClick={()=>setConfirm({msg:`Supprimer ${e.value} ?`,action:"delete_one",id:e.id})} style={{ background:C.dangerL,border:"none",color:C.danger,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:13 }}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>}

      {/* Detail Modal */}
      {detailEntry&&(
        <Modal title={null} onClose={()=>setDetailEntry(null)} width={500}>
          <div style={{ background:C.navy,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div><div style={{ display:"flex",gap:8,marginBottom:4 }}><Badge label={detailEntry.type} color={TYPE_COLORS[detailEntry.type]||C.muted} small /><Badge label={detailEntry.active?"Actif":"Inactif"} color={detailEntry.active?C.success:C.muted} small /></div><div style={{ fontFamily:"monospace",fontSize:17,fontWeight:900,color:C.white }}>{detailEntry.value}</div></div>
            <button onClick={()=>setDetailEntry(null)} style={{ background:"none",border:"none",color:C.muted,fontSize:24,cursor:"pointer" }}>×</button>
          </div>
          <div style={{ padding:"18px 20px" }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
              {[["Raison",detailEntry.reason],["Ajouté par",userName(detailEntry.addedBy)],["Date",detailEntry.date],["Matches",detailEntry.matches||0],["Dernier match",detailEntry.lastMatch||"Aucun"]].map(([k,v])=>(
                <div key={k} style={{ background:C.bg,borderRadius:8,padding:"10px 12px" }}>
                  <div style={{ fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:3 }}>{k}</div>
                  <div style={{ fontSize:12,fontWeight:600,color:C.navy }}>{v}</div>
                </div>
              ))}
            </div>
            {detailEntry.type==="MSISDN"&&(
              <div style={{ background:C.skyL,border:`1px solid ${C.sky}33`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ fontSize:13,color:C.navy,fontWeight:600 }}>MOB Profil SIM disponible</span>
                <Btn variant="sky" small onClick={()=>{setSimProfile({msisdn:detailEntry.value,score:75,fraudType:detailEntry.reason});setDetailEntry(null);}}>Voir →</Btn>
              </div>
            )}
            <div style={{ borderTop:`1px solid ${C.mutedL}`,paddingTop:12 }}>
              <div style={{ fontSize:11,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase" }}>Actions</div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                <Btn variant={detailEntry.active?"warning":"success"} small onClick={()=>{handleToggle(detailEntry.id);setDetailEntry(null);}}>{detailEntry.active?"⏸ Désactiver":"▶ Activer"}</Btn>
                {activeTab==="blacklist"&&<Btn variant="success" small onClick={()=>{handleMove(detailEntry.id,"whitelist");setDetailEntry(null);}}>OK → WL</Btn>}
                {activeTab==="blacklist"&&<Btn variant="purple" small onClick={()=>{handleMove(detailEntry.id,"watchlist");setDetailEntry(null);}}>→ WA</Btn>}
                {activeTab!=="blacklist"&&<Btn variant="danger" small onClick={()=>{handleMove(detailEntry.id,"blacklist");setDetailEntry(null);}}>→ BL</Btn>}
                <Btn variant="ghost" small onClick={()=>{handleDelete(detailEntry.id);setDetailEntry(null);}}>Del Supprimer</Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Modal */}
      {showAdd&&(
        <Modal title={`Ajouter → ${TAB_LABEL[activeTab]||"Blacklist"}`} onClose={()=>setShowAdd(false)} width={460}>
          <div style={{ padding:"18px 20px" }}>
            <p style={{ margin:"0 0 8px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Type</p>
            <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:12 }}>
              {BL_TYPES.map(t=><button key={t} onClick={()=>setAddForm(f=>({...f,type:t}))} style={{ padding:"4px 9px",background:addForm.type===t?(TYPE_COLORS[t]+"18"):C.bg,border:`1px solid ${addForm.type===t?TYPE_COLORS[t]:C.mutedL}`,borderRadius:8,color:addForm.type===t?TYPE_COLORS[t]:C.textL,cursor:"pointer",fontSize:11,fontWeight:addForm.type===t?700:400 }}>{t}</button>)}
            </div>
            <p style={{ margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Valeur</p>
            <input value={addForm.value} onChange={e=>setAddForm(f=>({...f,value:e.target.value}))} placeholder="Ex: 77654XXXXX" style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",fontFamily:"monospace",marginBottom:12 }} />
            <p style={{ margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Raison</p>
            <input value={addForm.reason} onChange={e=>setAddForm(f=>({...f,reason:e.target.value}))} placeholder="Ex: SIM Box confirmée..." style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",marginBottom:(activeTab==="watchlist")?(12):18 }} />
            {activeTab==="watchlist"&&(
              <div style={{ marginBottom:18 }}>
                <p style={{ margin:"0 0 8px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Durée d'observation</p>
                <div style={{ display:"flex",gap:8 }}>{[3,7,14,30].map(d=><button key={d} onClick={()=>setAddForm(f=>({...f,daysWatch:d}))} style={{ flex:1,padding:"7px",background:addForm.daysWatch===d?`${C.warning}18`:C.bg,border:`2px solid ${addForm.daysWatch===d?C.warning:C.mutedL}`,borderRadius:8,color:addForm.daysWatch===d?C.warning:C.textL,cursor:"pointer",fontSize:13,fontWeight:700 }}>{d}j</button>)}</div>
              </div>
            )}
            <div style={{ display:"flex",gap:8 }}>
              <Btn variant="ghost" onClick={()=>setShowAdd(false)} style={{ flex:1,justifyContent:"center" }}>Annuler</Btn>
              <Btn onClick={handleAdd} disabled={!addForm.value} style={{ flex:2,justifyContent:"center",background:TAB_COLOR[activeTab],border:"none",color:C.white }}>Ajouter</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImport&&(
        <Modal title="Importer une liste CSV" onClose={()=>setShowImport(false)} width={520}>
          <div style={{ height:3,background:C.mutedL }}><div style={{ height:"100%",width:`${importStep/2*100}%`,background:activeTab!=="all"?TAB_COLOR[activeTab]:C.navy,transition:"width 0.3s" }} /></div>
          <div style={{ padding:"18px 20px" }}>
            {importStep===1?(
              <div>
                {/* Liste cible */}
                <p style={{ margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Liste cible</p>
                <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap" }}>
                  {["blacklist","whitelist","watchlist","greylist"].map(tab=>(
                    <button key={tab} onClick={()=>setActiveTab(tab)} style={{ padding:"5px 10px",background:activeTab===tab?(TAB_COLOR[tab]+"18"):C.bg,border:`1px solid ${activeTab===tab?TAB_COLOR[tab]:C.mutedL}`,borderRadius:8,color:activeTab===tab?TAB_COLOR[tab]:C.textL,cursor:"pointer",fontSize:11,fontWeight:activeTab===tab?700:400 }}>{TAB_LABEL[tab]}</button>
                  ))}
                </div>
                {/* Type */}
                <p style={{ margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase" }}>Type par défaut</p>
                <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:12 }}>{BL_TYPES.map(t=><button key={t} onClick={()=>setImportType(t)} style={{ padding:"4px 9px",background:importType===t?(TYPE_COLORS[t]+"18"):C.bg,border:`1px solid ${importType===t?TYPE_COLORS[t]:C.mutedL}`,borderRadius:8,color:importType===t?TYPE_COLORS[t]:C.textL,cursor:"pointer",fontSize:11,fontWeight:importType===t?700:400 }}>{t}</button>)}</div>
                <input value={importReason} onChange={e=>setImportReason(e.target.value)} placeholder="Raison (défaut)..." style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",marginBottom:12 }} />
                {/* File input CSV */}
                <div style={{ border:`2px dashed ${C.mutedL}`,borderRadius:10,padding:"14px 16px",marginBottom:12,textAlign:"center",background:C.bg }}>
                  <p style={{ margin:"0 0 8px",fontSize:12,color:C.textL }}>Format CSV : <code style={{ fontFamily:"monospace",background:C.mutedL,padding:"1px 5px",borderRadius:4 }}>valeur,type,raison</code> ou une valeur par ligne</p>
                  <input type="file" accept=".csv,.txt" onChange={e=>{
                    const file=e.target.files[0]; if(!file)return;
                    const reader=new FileReader();
                    reader.onload=ev=>{
                      const text=ev.target.result;
                      const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
                      // Detect CSV (has commas) vs plain list
                      const isCSV=lines.some(l=>l.includes(","));
                      if(isCSV){
                        setImportRaw(lines.map(l=>{const p=l.split(",");return p[0].trim();}).join("\n"));
                        const firstType=lines[0]?.split(",")[1]?.trim();
                        if(firstType&&BL_TYPES.includes(firstType))setImportType(firstType);
                        const firstReason=lines[0]?.split(",")[2]?.trim();
                        if(firstReason)setImportReason(firstReason);
                      } else {
                        setImportRaw(lines.join("\n"));
                      }
                    };
                    reader.readAsText(file);
                  }} style={{ cursor:"pointer",fontSize:12,color:C.navy }} />
                </div>
                <textarea value={importRaw} onChange={e=>setImportRaw(e.target.value)} placeholder={"77654XXXXX\n78901XXXXX\n..."} rows={5} style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.navy,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"monospace" }} />
                <p style={{ margin:"4px 0 14px",fontSize:11,color:C.muted }}>{importRaw.split("\n").filter(Boolean).length} entrées détectées</p>
                <div style={{ display:"flex",gap:8 }}><Btn variant="ghost" onClick={()=>setShowImport(false)} style={{ flex:1,justifyContent:"center" }}>Annuler</Btn><Btn onClick={()=>setImportStep(2)} disabled={!importRaw.trim()} style={{ flex:2,justifyContent:"center" }}>Prévisualiser →</Btn></div>
              </div>
            ):(
              <div>
                <div style={{ background:C.bg,borderRadius:10,padding:"12px 14px",marginBottom:14 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:C.navy,marginBottom:8 }}>{importRaw.split("\n").filter(Boolean).length} entrées · {importType} → {TAB_LABEL[activeTab]||activeTab}</div>
                  {importRaw.split("\n").filter(Boolean).slice(0,5).map((v,i)=><div key={i} style={{ fontFamily:"monospace",fontSize:12,color:C.navy,padding:"3px 0",borderBottom:`1px solid ${C.mutedL}` }}>{v}</div>)}
                  {importRaw.split("\n").filter(Boolean).length>5&&<p style={{ margin:"6px 0 0",fontSize:11,color:C.muted }}>+ {importRaw.split("\n").filter(Boolean).length-5} autres...</p>}
                </div>
                <div style={{ display:"flex",gap:8 }}><Btn variant="ghost" onClick={()=>setImportStep(1)} style={{ flex:1,justifyContent:"center" }}>← Modifier</Btn><Btn onClick={importEntries} style={{ flex:2,justifyContent:"center",background:activeTab!=="all"?TAB_COLOR[activeTab]:C.navy,border:"none",color:C.white }}>Importer {importRaw.split("\n").filter(Boolean).length} entrées</Btn></div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Confirm */}
      {confirm&&(
        <ConfirmModal title="Confirmation" message={confirm.msg} confirmLabel="Confirmer" confirmColor={C.danger}
          onConfirm={()=>{ if(confirm.action==="delete")doGroupAction("delete"); if(confirm.action==="delete_one")handleDelete(confirm.id); setConfirm(null); }}
          onCancel={()=>setConfirm(null)} />
      )}
    </div>
  );
}