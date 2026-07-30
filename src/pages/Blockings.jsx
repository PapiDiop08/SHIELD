import { useState, useMemo } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SectionHeader, SearchInput, Select, Modal, Avatar, ConfirmModal } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function Blockings({ blockings, setBlockings, blacklist, setBlacklist, setSimProfile, users, operators, addLog, createBlocking, unblock, reblock, currentOperator }) {
  const { currentUser, can, isGFM } = useAuth();
  const [search, setSearch] = useState("");
  const [filterOp, setFilterOp] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterActive, setFilterActive] = useState("active");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [importRaw, setImportRaw] = useState("");
  const [addForm, setAddForm] = useState({ msisdn:"",reason:"",source:"analyst",operator:currentUser?.operator||"Partner 1",notes:"",interOpSource:"" });
  const [toast, setToast] = useState(null);

  function showToast(msg, color=C.success) { setToast({msg,color}); setTimeout(()=>setToast(null),3000); }

  const filtered = useMemo(() => {
    try {
      let list = [...(blockings || [])];
      if (search) list = list.filter(b => b.msisdn?.includes(search) || b.reason?.toLowerCase().includes(search.toLowerCase()) || (b.imei||"").includes(search));
      if (filterOp !== "all") list = list.filter(b => b.operator === filterOp);
      if (filterSource !== "all") list = list.filter(b => b.source === filterSource);
      if (filterActive === "active") list = list.filter(b => b.active);
      if (filterActive === "inactive") list = list.filter(b => !b.active);
      return list.sort((a, b) => {
        const da = String(a?.date || a?.created_at || "");
        const db = String(b?.date || b?.created_at || "");
        return db.localeCompare(da);
      });
    } catch(e) { console.error("Blockings sort error:", e); return []; }
  }, [blockings, search, filterOp, filterSource, filterActive]);

  const today = new Date().toISOString().slice(0,10);
  const month = new Date().toISOString().slice(0,7);
  const safeBlockings = blockings || [];
  const statsToday    = safeBlockings.filter(b => (b.date||b.created_at||"").startsWith(today) && b.active).length;
  const statsMonth    = safeBlockings.filter(b => (b.date||b.created_at||"").startsWith(month) && b.active).length;
  const statsTotal    = safeBlockings.filter(b => b.active).length;
  const statsInactive = safeBlockings.filter(b => !b.active).length;

  async function doUnblock(b) {
    await unblock?.(b.id);
    addLog?.("UNBLOCK_SIM","blocking",b.id,`Déblocage ${b.msisdn}`,"Blocages");
    showToast(`${b.msisdn} débloquée`, C.success);
  }

  async function doReblock(b) {
    await reblock?.(b.id);
    addLog?.("REBLOCK_SIM","blocking",b.id,`Re-blocage ${b.msisdn}`,"Blocages");
    showToast(`${b.msisdn} re-bloquée`, C.danger);
  }

  async function addBlocking() {
    const { data, error } = await (createBlocking?.({
      msisdn: addForm.msisdn, reason: addForm.reason,
      source: addForm.source, interOpSource: addForm.interOpSource||null,
      notes: addForm.notes||null,
    }, currentOperator?.id || null) || Promise.resolve({ data: null, error: null }));
    if (error) { showToast("Erreur : " + error.message, C.danger); return; }
    setBlacklist(p => [{id:Date.now(),list:"blacklist",type:"MSISDN",value:addForm.msisdn,reason:addForm.reason,addedBy:currentUser?.id,date:new Date().toISOString().slice(0,10),active:true,matches:0,lastMatch:null},...p]);
    addLog?.("BLOCK_SIM","blocking",data?.id||null,`Blocage ${addForm.msisdn} — ${addForm.reason}`,"Blocages");
    setShowAdd(false);
    setAddForm({msisdn:"",reason:"",source:"analyst",operator:currentUser?.operator||"Partner 1",notes:"",interOpSource:""});
    showToast(`${addForm.msisdn} bloquée`, C.danger);
  }

  async function importBatch() {
    const lines = importRaw.split("\n").map(l=>l.trim()).filter(Boolean);
    let ok = 0;
    for (const msisdn of lines) {
      const { error } = await (createBlocking?.({
        msisdn, reason: addForm.reason||"Import batch", source: addForm.source,
      }, currentOperator?.id || null) || Promise.resolve({ error: null }));
      if (!error) ok++;
    }
    addLog?.("IMPORT_BLOCKINGS","blocking",null,`Import ${ok}/${lines.length} blocages`,"Blocages");
    setShowImport(false); setImportRaw("");
    showToast(`${ok} SIMs bloquées`, C.danger);
  }

  const sourceLabel = { shield_auto:"BOT Auto", analyst:"USR Analyste", inter_operator:"Sync Inter-op" };
  const userName = id => users?.find(u=>u.id===id)?.name?.split(" ")[0] || "Auto";

  return (
    <div style={{padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif",position:"relative"}}>
      {toast && <div style={{position:"fixed",top:20,right:20,background:toast.color,color:C.white,borderRadius:10,padding:"12px 20px",fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>{toast.msg}</div>}

      <SectionHeader title="Gestion des blocages" sub={`${statsTotal} SIMs bloquées actives`}
        action={<>
          {can("blockSIM") && <Btn variant="secondary" small onClick={()=>setShowImport(true)}>Export Import</Btn>}
          {can("blockSIM") && <Btn onClick={()=>setShowAdd(true)}>[X] Bloquer</Btn>}
        </>} />

      {/* Stats */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        {[{l:"Aujourd'hui",v:statsToday,c:C.danger},{l:"Ce mois",v:statsMonth,c:C.warning},{l:"Total actifs",v:statsTotal,c:C.navy},{l:"Débloqués",v:statsInactive,c:C.success}].map(s=>(
          <Card key={s.l} style={{flex:1,minWidth:100,padding:"12px 16px",borderTop:`3px solid ${s.c}`}}>
            <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
            <div style={{fontSize:11,color:C.textL,marginTop:4}}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <SearchInput value={search} onChange={setSearch} placeholder="MSISDN, IMEI, raison..." />
        {isGFM() && <Select value={filterOp} onChange={setFilterOp} options={[{value:"all",label:"Tous opérateurs"},...(operators||[]).map(o=>({value:o.name,label:o.name}))]} />}
        <Select value={filterSource} onChange={setFilterSource} options={[{value:"all",label:"Toutes sources"},{value:"shield_auto",label:"BOT Auto"},{value:"analyst",label:"USR Analyste"},{value:"inter_operator",label:"Sync Inter-op"}]} />
        <Select value={filterActive} onChange={setFilterActive} options={[{value:"all",label:"Tous"},{value:"active",label:"Actifs"},{value:"inactive",label:"Débloqués"}]} />
        {(search||filterOp!=="all"||filterSource!=="all") && <button onClick={()=>{setSearch("");setFilterOp("all");setFilterSource("all");}} style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer",fontWeight:600}}>X</button>}
      </div>

      <div style={{fontSize:12,color:C.textL,marginBottom:8}}>{filtered.length} blocage{filtered.length>1?"s":""}</div>

      {/* Table */}
      <Card style={{overflow:"hidden"}}>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
            <thead>
              <tr style={{background:C.bg,borderBottom:`2px solid ${C.mutedL}`}}>
                {["MSISDN","Raison","Source","Bloqué par","Date","Statut","Actions"].map(h=>(
                  <th key={h} style={{padding:"10px 12px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <tr><td colSpan={7} style={{padding:"40px",textAlign:"center",color:C.muted}}><div style={{fontSize:28,marginBottom:8}}>BLK</div>Aucun blocage trouvé</td></tr>}
              {filtered.map((b,idx) => {
                const blocker = users?.find(u=>u.id===b.blockedBy);
                return (
                  <tr key={b.id} style={{borderBottom:`1px solid ${C.mutedL}`,background:b.active?idx%2===0?C.white:"#FAFBFE":C.bg,opacity:b.active?1:0.65}}
                    onMouseOver={e=>e.currentTarget.style.background=C.bg} onMouseOut={e=>e.currentTarget.style.background=b.active?idx%2===0?C.white:"#FAFBFE":C.bg}>
                    <td style={{padding:"10px 12px",cursor:"pointer"}} onClick={()=>setSimProfile({msisdn:b.msisdn,score:80,fraudType:b.reason})}>
                      <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:C.navy}}>{b.msisdn}</div>
                      {b.imei && <div style={{fontSize:10,color:C.muted}}>IMEI: {b.imei.slice(0,12)}</div>}
                      {isGFM() && <div style={{fontSize:10,color:C.textL}}>{b.operator}</div>}
                    </td>
                    <td style={{padding:"10px 12px",maxWidth:200}}>
                      <div style={{fontSize:12,color:C.textL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.reason}</div>
                      {b.interOpSource && <div style={{fontSize:10,color:C.purple}}>via {b.interOpSource}</div>}
                    </td>
                    <td style={{padding:"10px 12px"}}><Badge label={sourceLabel[b.source]||b.source||"—"} color={b.source==="inter_operator"?C.purple:b.source==="shield_auto"?C.sky:C.teal} small /></td>
                    <td style={{padding:"10px 12px"}}>
                      {blocker
                        ? <div style={{display:"flex",alignItems:"center",gap:6}}><Avatar user={blocker} size={20}/><span style={{fontSize:11,color:C.textL}}>{(blocker.name||"Auto").split(" ")[0]}</span></div>
                        : <span style={{fontSize:11,color:C.muted}}>{b.blockerName||"Auto"}</span>}
                    </td>
                    <td style={{padding:"10px 12px",fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>{b.date?.slice(0,10)}</td>
                    <td style={{padding:"10px 12px"}}>
                      <Badge label={b.active?"R Bloqué":"OK Débloqué"} color={b.active?C.danger:C.success} small />
                    </td>
                    <td style={{padding:"8px 12px"}}>
                      <div style={{display:"flex",gap:4}}>
                        <Btn variant="navy" small onClick={()=>setSimProfile({msisdn:b.msisdn,score:80,fraudType:b.reason})}>SIM</Btn>
                        {can("unblockSIM") && b.active && <Btn variant="success" small onClick={()=>setConfirm({action:"unblock",b,msg:`Débloquer ${b.msisdn} ?`})}>Débloquer</Btn>}
                        {can("blockSIM") && !b.active && <Btn variant="danger" small onClick={()=>setConfirm({action:"reblock",b,msg:`Re-bloquer ${b.msisdn} ?`})}>Re-bloquer</Btn>}
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
        <Modal title="Bloquer un numéro" onClose={()=>setShowAdd(false)} width={500}>
          <div style={{padding:"20px 24px"}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>MSISDN</label>
            <input value={addForm.msisdn} onChange={e=>setAddForm(f=>({...f,msisdn:e.target.value}))} placeholder="Ex: 77654XXXXX"
              style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:14,fontFamily:"monospace",color:C.navy,outline:"none",boxSizing:"border-box",marginBottom:14}} />

            <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>Source</label>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[{v:"analyst",l:"USR Analyste"},{v:"inter_operator",l:"Sync Inter-op"}].map(s=>(
                <button key={s.v} onClick={()=>setAddForm(f=>({...f,source:s.v}))} style={{flex:1,padding:"8px",background:addForm.source===s.v?`${C.sky}18`:C.bg,border:`2px solid ${addForm.source===s.v?C.sky:C.mutedL}`,borderRadius:8,color:addForm.source===s.v?C.sky:C.textL,cursor:"pointer",fontSize:12,fontWeight:700}}>{s.l}</button>
              ))}
            </div>

            {addForm.source==="inter_operator" && (
              <>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>Opérateur source</label>
                <select value={addForm.interOpSource} onChange={e=>setAddForm(f=>({...f,interOpSource:e.target.value}))}
                  style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,background:C.white,outline:"none",marginBottom:14}}>
                  <option value="">Sélectionner...</option>
                  {operators.map(o=><option key={o.id} value={o.name}>{o.name}</option>)}
                </select>
              </>
            )}

            {isGFM() && (
              <>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>Opérateur</label>
                <select value={addForm.operator} onChange={e=>setAddForm(f=>({...f,operator:e.target.value}))}
                  style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,background:C.white,outline:"none",marginBottom:14}}>
                  {operators.map(o=><option key={o.id} value={o.name}>{o.name}</option>)}
                </select>
              </>
            )}

            <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>Raison</label>
            <select value={addForm.reason} onChange={e=>setAddForm(f=>({...f,reason:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,background:C.white,outline:"none",marginBottom:8}}>
              <option value="">Choisir...</option>
              {["SIM Box confirmée","IRSF","Wangiri","ATO","Dépassement MM","Arnaque Marabout","Detection inter-opérateur","Autre"].map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <input value={addForm.reason} onChange={e=>setAddForm(f=>({...f,reason:e.target.value}))} placeholder="Ou raison personnalisée..."
              style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",marginBottom:14}} />

            <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>Notes (optionnel)</label>
            <textarea value={addForm.notes} onChange={e=>setAddForm(f=>({...f,notes:e.target.value}))} rows={2}
              style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:C.navy,outline:"none",boxSizing:"border-box",resize:"vertical",marginBottom:18}} />

            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" onClick={()=>setShowAdd(false)} style={{flex:1,justifyContent:"center"}}>Annuler</Btn>
              <Btn onClick={()=>setConfirm({action:"add",b:{msisdn:addForm.msisdn},msg:`Bloquer ${addForm.msisdn} ?`})} disabled={!addForm.msisdn||!addForm.reason}
                style={{flex:2,justifyContent:"center",background:C.danger,border:"none",color:C.white}}>[X] Confirmer le blocage</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImport && (
        <Modal title="Import batch — Blocages" onClose={()=>setShowImport(false)} width={480}>
          <div style={{padding:"20px 24px"}}>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[{v:"analyst",l:"USR Analyste"},{v:"inter_operator",l:"Sync Inter-op"}].map(s=>(
                <button key={s.v} onClick={()=>setAddForm(f=>({...f,source:s.v}))} style={{flex:1,padding:"8px",background:addForm.source===s.v?`${C.sky}18`:C.bg,border:`2px solid ${addForm.source===s.v?C.sky:C.mutedL}`,borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,color:addForm.source===s.v?C.sky:C.textL}}>{s.l}</button>
              ))}
            </div>
            <input value={addForm.reason} onChange={e=>setAddForm(f=>({...f,reason:e.target.value}))} placeholder="Raison du blocage..."
              style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box",marginBottom:12}} />
            <textarea value={importRaw} onChange={e=>setImportRaw(e.target.value)} placeholder={"77654XXXXX\n78901XXXXX..."} rows={7}
              style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.navy,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"monospace"}} />
            <p style={{margin:"4px 0 16px",fontSize:11,color:C.muted}}>{importRaw.split("\n").filter(Boolean).length} numéros</p>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" onClick={()=>setShowImport(false)} style={{flex:1,justifyContent:"center"}}>Annuler</Btn>
              <Btn onClick={importBatch} disabled={!importRaw.trim()||!addForm.reason} style={{flex:2,justifyContent:"center",background:C.danger,border:"none",color:C.white}}>
                [X] Bloquer {importRaw.split("\n").filter(Boolean).length} numéros
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm */}
      {confirm && (
        <ConfirmModal title="Confirmation requise" message={confirm.msg}
          confirmLabel="Confirmer"
          confirmColor={confirm.action==="unblock"?C.success:C.danger}
          onConfirm={()=>{
            if (confirm.action==="unblock") doUnblock(confirm.b);
            else if (confirm.action==="reblock") doReblock(confirm.b);
            else if (confirm.action==="add") addBlocking();
            setConfirm(null);
          }}
          onCancel={()=>setConfirm(null)} />
      )}
    </div>
  );
}