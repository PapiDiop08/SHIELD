import { useState, useMemo } from "react";
import { C, sevColor, sevLabel, statusColor, statusLabel, fraudCatIcon, fraudCatColor } from "../theme.js";
import { Card, Badge, Btn, SearchInput, Select, SectionHeader, ConfirmModal, Avatar } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function Alerts({ alerts, setAlerts, cases, users, setSimProfile, addLog }) {
  const { currentUser, can } = useAuth();
  const [search, setSearch] = useState("");
  const [filterSev, setFilterSev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [sortBy, setSortBy] = useState("time");
  const [selected, setSelected] = useState([]);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const analysts = users.filter(u => u.active && ["analyst","admin","superadmin","gfm_analyst"].includes(u.role));
  const types = [...new Set(alerts.map(a => a.type))];
  const operators = [...new Set(alerts.map(a => a.operator))];

  const filtered = useMemo(() => {
    let list = [...alerts].filter(a => !["cleared","closed","false_positive"].includes(a.status));
    if (search) list = list.filter(a => a.msisdn.includes(search) || a.type.toLowerCase().includes(search.toLowerCase()) || a.operator.toLowerCase().includes(search.toLowerCase()));
    if (filterSev !== "all") list = list.filter(a => a.severity === filterSev);
    if (filterStatus !== "all") list = list.filter(a => a.status === filterStatus);
    if (filterType !== "all") list = list.filter(a => a.type === filterType);
    if (filterAssigned === "me") list = list.filter(a => a.assignedTo === currentUser?.id);
    if (filterAssigned === "unassigned") list = list.filter(a => !a.assignedTo);
    list.sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "severity" ? ["critical","high","medium","low"].indexOf(a.severity) - ["critical","high","medium","low"].indexOf(b.severity) : b.time.localeCompare(a.time));
    return list;
  }, [alerts, search, filterSev, filterStatus, filterType, filterAssigned, sortBy, currentUser]);

  function assignAlert(alertId, userId) {
    setAlerts(p => p.map(a => a.id === alertId ? { ...a, assignedTo: userId } : a));
    const u = users.find(x => x.id === userId);
    addLog("ASSIGN_ALERT","alert",alertId,`Alerte assignée à ${u?.name}`,"Alertes");
  }

  function assignSelected(userId) {
    selected.forEach(id => assignAlert(id, userId));
    setSelected([]);
    setShowAssignMenu(false);
  }

  function updateStatus(alertId, status) {
    setAlerts(p => p.map(a => a.id === alertId ? { ...a, status } : a));
    addLog("UPDATE_ALERT_STATUS","alert",alertId,`Statut → ${statusLabel(status)}`,"Alertes");
  }

  function doConfirmedAction() {
    if (!confirm) return;
    updateStatus(confirm.alertId, confirm.status);
    setConfirm(null);
  }

  const allSel = filtered.length > 0 && filtered.every(a => selected.includes(a.id));

  return (
    <div style={{ padding: "24px 20px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader title="Alertes"
        sub={<><span style={{ color: C.success }}>● Live</span> — {filtered.length} alertes actives · {alerts.filter(a => a.severity === "critical").length} critiques</>} />

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[{ l: "Critique", f: "critical", c: C.danger },{ l: "Élevé", f: "high", c: C.warning },{ l: "Moyen", f: "medium", c: C.sky },{ l: "Mes alertes", f: "me", c: C.purple }].map(s => (
          <Card key={s.l} style={{ flex: 1, minWidth: 100, padding: "10px 14px", cursor: "pointer", borderTop: `3px solid ${s.c}` }}
            onClick={() => s.f === "me" ? setFilterAssigned(filterAssigned === "me" ? "all" : "me") : setFilterSev(filterSev === s.f ? "all" : s.f)}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.f === "me" ? alerts.filter(a => a.assignedTo === currentUser?.id && !["cleared","closed"].includes(a.status)).length : alerts.filter(a => a.severity === s.f).length}</div>
            <div style={{ fontSize: 11, color: C.textL }}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="MSISDN, type, opérateur..." />
        <Select value={filterSev} onChange={setFilterSev} options={[{value:"all",label:"Sévérité"},{value:"critical",label:"Critique"},{value:"high",label:"Élevé"},{value:"medium",label:"Moyen"}]} />
        <Select value={filterStatus} onChange={setFilterStatus} options={[{value:"all",label:"Statut"},{value:"alert",label:"Alerte"},{value:"monitor",label:"Surveillance"},{value:"investigating",label:"En cours"}]} />
        <Select value={filterType} onChange={setFilterType} options={[{value:"all",label:"Type"}, ...types.map(t=>({value:t,label:`${fraudCatIcon(t)} ${t}`}))]} />
        <Select value={filterAssigned} onChange={setFilterAssigned} options={[{value:"all",label:"Assignation"},{value:"me",label:"Mes alertes"},{value:"unassigned",label:"Non assignées"}]} />
        <Select value={sortBy} onChange={setSortBy} options={[{value:"time",label:"Récentes"},{value:"score",label:"Score ↓"},{value:"severity",label:"Sévérité"}]} />
        {(search||filterSev!=="all"||filterStatus!=="all"||filterType!=="all"||filterAssigned!=="all") && <button onClick={()=>{setSearch("");setFilterSev("all");setFilterStatus("all");setFilterType("all");setFilterAssigned("all");}} style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer",fontWeight:600}}>✕</button>}
      </div>

      {/* Group actions */}
      {selected.length > 0 && (
        <div style={{ background: C.navy, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ color: C.white, fontWeight: 700, fontSize: 12 }}>{selected.length} sélectionnée{selected.length>1?"s":""}</span>
          <button onClick={() => setSelected([])} style={{ background:"none",border:`1px solid ${C.navyB}`,color:C.muted,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11 }}>Désélectionner</button>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative" }}>
            <Btn variant="sky" small onClick={() => setShowAssignMenu(!showAssignMenu)}>👤 Assigner</Btn>
            {showAssignMenu && (
              <div style={{ position:"absolute",top:"100%",right:0,background:C.white,border:`1px solid ${C.mutedL}`,borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:99,minWidth:200,marginTop:4,maxHeight:240,overflowY:"auto" }}>
                {analysts.map(u=>(
                  <div key={u.id} onClick={()=>assignSelected(u.id)} style={{ padding:"9px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:13 }}
                    onMouseOver={e=>e.currentTarget.style.background=C.bg} onMouseOut={e=>e.currentTarget.style.background=C.white}>
                    <Avatar user={u} size={22} />{u.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Btn variant="warning" small onClick={()=>{selected.forEach(id=>updateStatus(id,"investigating"));setSelected([]);}}>🔍 En cours</Btn>
          <Btn variant="success" small onClick={()=>setConfirm({alertId:null,status:"cleared",bulk:true,msg:`Clôturer ${selected.length} alertes ?`})}>✓ Clôturer</Btn>
        </div>
      )}

      <div style={{ fontSize: 12, color: C.textL, marginBottom: 8 }}>{filtered.length} alerte{filtered.length>1?"s":""}</div>

      {/* Scrollable table */}
      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.mutedL}` }}>
                <th style={{ padding: "10px 10px", width: 36 }}>
                  <input type="checkbox" checked={allSel} onChange={() => allSel ? setSelected([]) : setSelected(filtered.map(a=>a.id))} style={{ cursor:"pointer",accentColor:C.red }} />
                </th>
                {["","Heure · MSISDN","Type · Opérateur","Score","Statut","Assigné","Actions"].map(h=>(
                  <th key={h} style={{ padding:"10px 10px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"left",whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding:"40px",textAlign:"center",color:C.muted }}>
                  <div style={{ fontSize:28,marginBottom:8 }}>🔍</div>Aucune alerte
                </td></tr>
              )}
              {filtered.map(a => {
                const assignedUser = users.find(u => u.id === a.assignedTo);
                const isSel = selected.includes(a.id);
                return (
                  <tr key={a.id} style={{ borderBottom:`1px solid ${C.mutedL}`,background:isSel?C.skyL:C.white }}
                    onMouseOver={e=>!isSel&&(e.currentTarget.style.background=C.bg)} onMouseOut={e=>!isSel&&(e.currentTarget.style.background=C.white)}>
                    <td style={{ padding:"10px" }}>
                      <input type="checkbox" checked={isSel} onChange={()=>setSelected(p=>p.includes(a.id)?p.filter(x=>x!==a.id):[...p,a.id])} style={{ cursor:"pointer",accentColor:C.red }} />
                    </td>
                    <td style={{ padding:"2px 0",width:4 }}>
                      <div style={{ width:4,background:sevColor(a.severity),height:52 }} />
                    </td>
                    <td style={{ padding:"10px" }}>
                      <div style={{ fontSize:11,color:C.muted }}>{a.time}</div>
                      <div style={{ fontSize:12,fontWeight:700,color:C.navy,fontFamily:"monospace" }}>{a.msisdn}</div>
                    </td>
                    <td style={{ padding:"10px",cursor:"pointer" }} onClick={()=>setSimProfile({msisdn:a.msisdn,score:a.score,fraudType:a.type})}>
                      <div style={{ fontWeight:700,fontSize:13,color:C.navy,whiteSpace:"nowrap" }}>{fraudCatIcon(a.type)} {a.type}</div>
                      <div style={{ fontSize:11,color:C.textL,whiteSpace:"nowrap" }}>{a.operator}</div>
                    </td>
                    <td style={{ padding:"10px",textAlign:"center" }}>
                      <div style={{ fontSize:18,fontWeight:900,color:a.score>=80?C.danger:a.score>=60?C.warning:C.sky }}>{a.score}</div>
                    </td>
                    <td style={{ padding:"10px" }}><Badge label={statusLabel(a.status)} color={statusColor(a.status)} small /></td>
                    <td style={{ padding:"10px" }}>
                      {assignedUser
                        ? <div style={{ display:"flex",alignItems:"center",gap:6 }}><Avatar user={assignedUser} size={20} /><span style={{ fontSize:11,color:C.textL,whiteSpace:"nowrap" }}>{assignedUser.name.split(" ")[0]}</span></div>
                        : <select onChange={e=>{if(e.target.value)assignAlert(a.id,e.target.value);}} style={{ border:`1px solid ${C.mutedL}`,borderRadius:6,padding:"3px 6px",fontSize:11,color:C.muted,background:C.white,cursor:"pointer",maxWidth:110 }}>
                            <option value="">Assigner...</option>
                            {analysts.map(u=><option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>)}
                          </select>
                      }
                    </td>
                    <td style={{ padding:"8px 10px" }}>
                      <div style={{ display:"flex",gap:4 }}>
                        <Btn variant="navy" small onClick={()=>setSimProfile({msisdn:a.msisdn,score:a.score,fraudType:a.type})}>Voir</Btn>
                        <select value={a.status} onChange={e=>setConfirm({alertId:a.id,status:e.target.value,msg:`Confirmer : ${statusLabel(e.target.value)} pour ${a.msisdn} ?`})}
                          style={{ border:`1px solid ${C.mutedL}`,borderRadius:6,padding:"3px 5px",fontSize:10,color:C.navy,background:C.white,cursor:"pointer",maxWidth:90 }}>
                          {["alert","monitor","investigating","blocked","cleared","false_positive"].map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          title="Confirmation"
          message={confirm.msg}
          confirmLabel="Confirmer"
          confirmColor={confirm.status === "false_positive" ? C.success : confirm.status === "cleared" ? C.success : C.danger}
          onConfirm={() => {
            if (confirm.bulk) { selected.forEach(id => updateStatus(id, confirm.status)); setSelected([]);}
            else doConfirmedAction();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}