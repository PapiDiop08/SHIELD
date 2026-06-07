import { useState, useMemo } from "react";
import { C } from "../theme.js";
import { Card, Badge, SectionHeader, SearchInput, Select } from "../components.jsx";
import { MOCK_LOGS } from "../mockData.js";
import { useAuth } from "../AuthContext.jsx";

const ACTION_COLORS = { LOGIN:C.success,LOGOUT:C.muted,CREATE_RULE:C.sky,EDIT_RULE:C.warning,TOGGLE_RULE:C.warning,BLOCK_SIM:C.danger,ADD_BLACKLIST:C.danger,IMPORT_BATCH:C.purple,ASSIGN_ALERT:C.sky,UPDATE_ALERT_STATUS:C.warning,CREATE_CASE:C.purple,UPDATE_CASE_STATUS:C.warning,CREATE_USER:C.sky,TOGGLE_USER:C.warning,CHANGE_ROLE:C.purple,RESET_PASSWORD:C.warning,VIEW_PAGE:C.muted,ADD_NOTE:C.sky,WATCHLIST_ADD:C.warning,AI_ANALYSIS_START:C.purple,AI_ANALYSIS_DONE:C.purple,UNBLOCK_SIM:C.success,BLOCK_SIM_MANUAL:C.danger };
const ACTION_ICONS = { LOGIN:"🔐",LOGOUT:"⎋",CREATE_RULE:"⚙",EDIT_RULE:"✏",BLOCK_SIM:"🚫",ASSIGN_ALERT:"👤",CREATE_CASE:"📁",CREATE_USER:"👤",CHANGE_ROLE:"🛡",RESET_PASSWORD:"🔑",VIEW_PAGE:"👁",ADD_NOTE:"📝",AI_ANALYSIS_START:"🧠",AI_ANALYSIS_DONE:"✅",UNBLOCK_SIM:"✅" };

export default function Logs({ logs: liveLogs, addLog, users }) {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterUser, setFilterUser] = useState("all");

  const allLogs = useMemo(() => {
    const combined = [...(liveLogs||[]),...MOCK_LOGS];
    const seen = new Set();
    return combined.filter(l=>{ if(seen.has(l.id)) return false; seen.add(l.id); return true; }).sort((a,b)=>b.ts.localeCompare(a.ts));
  },[liveLogs]);

  const filtered = useMemo(()=>{
    let list = allLogs;
    if(search) list = list.filter(l=>l.detail?.toLowerCase().includes(search.toLowerCase())||l.action?.toLowerCase().includes(search.toLowerCase())||l.userName?.toLowerCase().includes(search.toLowerCase()));
    if(filterAction!=="all") list = list.filter(l=>l.action===filterAction);
    if(filterUser!=="all") list = list.filter(l=>l.userId===filterUser);
    return list;
  },[allLogs,search,filterAction,filterUser]);

  const actions = [...new Set(allLogs.map(l=>l.action))].sort();

  return (
    <div style={{ padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader title="Audit Log" sub={`${allLogs.length} événements · Registre immuable`} />

      <div style={{ background:C.navyL,border:`1px solid ${C.navyB}`,borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10 }}>
        <span>🔒</span>
        <span style={{ fontSize:12,color:C.white,fontWeight:600 }}>Toutes les actions sont enregistrées automatiquement — Non modifiable, non supprimable, accessible à tous</span>
      </div>

      <div style={{ display:"flex",gap:10,marginBottom:14,flexWrap:"wrap" }}>
        <Card style={{ flex:1,minWidth:100,padding:"12px 16px" }}><div style={{ fontSize:20,fontWeight:900,color:C.navy }}>{allLogs.length}</div><div style={{ fontSize:11,color:C.textL }}>Total</div></Card>
        <Card style={{ flex:1,minWidth:100,padding:"12px 16px" }}><div style={{ fontSize:20,fontWeight:900,color:C.sky }}>{allLogs.filter(l=>l.ts.startsWith("2026-06-06")).length}</div><div style={{ fontSize:11,color:C.textL }}>Aujourd'hui</div></Card>
        <Card style={{ flex:1,minWidth:100,padding:"12px 16px" }}><div style={{ fontSize:20,fontWeight:900,color:C.danger }}>{allLogs.filter(l=>["BLOCK_SIM","ADD_BLACKLIST","RESET_PASSWORD"].includes(l.action)).length}</div><div style={{ fontSize:11,color:C.textL }}>Actions critiques</div></Card>
        <Card style={{ flex:1,minWidth:100,padding:"12px 16px" }}><div style={{ fontSize:20,fontWeight:900,color:C.success }}>{allLogs.filter(l=>l.action==="LOGIN").length}</div><div style={{ fontSize:11,color:C.textL }}>Connexions</div></Card>
      </div>

      <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher dans les logs..." />
        <Select value={filterAction} onChange={setFilterAction} options={[{value:"all",label:"Toutes actions"},...actions.map(a=>({value:a,label:`${ACTION_ICONS[a]||"•"} ${a}`}))]} />
        <Select value={filterUser} onChange={setFilterUser} options={[{value:"all",label:"Tous utilisateurs"},...(users||[]).map(u=>({value:u.id,label:u.name}))]} />
        {(search||filterAction!=="all"||filterUser!=="all")&&<button onClick={()=>{setSearch("");setFilterAction("all");setFilterUser("all");}} style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer",fontWeight:600}}>✕</button>}
      </div>

      <div style={{ fontSize:12,color:C.textL,marginBottom:8 }}>{filtered.length} événement{filtered.length>1?"s":""}</div>

      <Card style={{ overflow:"hidden" }}>
        <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",minWidth:680 }}>
            <thead>
              <tr style={{ background:C.bg,borderBottom:`2px solid ${C.mutedL}` }}>
                {["Timestamp","Type","Action","Utilisateur","Détail","Page"].map(h=>(
                  <th key={h} style={{ padding:"10px 12px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"left",whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0,200).map((log,idx)=>{
                const color=ACTION_COLORS[log.action]||C.muted;
                const icon=ACTION_ICONS[log.action]||"•";
                return (
                  <tr key={log.id} style={{ borderBottom:`1px solid ${C.mutedL}`,background:idx%2===0?C.white:"#FAFBFE" }}
                    onMouseOver={e=>e.currentTarget.style.background=C.bg} onMouseOut={e=>e.currentTarget.style.background=idx%2===0?C.white:"#FAFBFE"}>
                    <td style={{ padding:"9px 12px",fontFamily:"monospace",fontSize:11,color:C.muted,whiteSpace:"nowrap" }}>{log.ts}</td>
                    <td style={{ padding:"9px 12px",whiteSpace:"nowrap" }}><span style={{ background:color+"18",color,borderRadius:6,padding:"2px 6px",fontSize:10,fontWeight:700 }}>{icon}</span></td>
                    <td style={{ padding:"9px 12px" }}><Badge label={(log.action||"").replace(/_/g," ")} color={color} small /></td>
                    <td style={{ padding:"9px 12px",whiteSpace:"nowrap" }}>
                      <div style={{ fontSize:12,fontWeight:600,color:C.navy }}>{log.userName||"—"}</div>
                      {log.ip&&<div style={{ fontSize:10,color:C.muted,fontFamily:"monospace" }}>{log.ip}</div>}
                    </td>
                    <td style={{ padding:"9px 12px",fontSize:12,color:C.textL,maxWidth:300 }}><div style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{log.detail}</div></td>
                    <td style={{ padding:"9px 12px",fontSize:11,color:C.muted,whiteSpace:"nowrap" }}>{log.page}</td>
                  </tr>
                );
              })}
              {filtered.length===0&&<tr><td colSpan={6} style={{ padding:"40px",textAlign:"center",color:C.muted }}>Aucun événement trouvé</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {filtered.length>200&&<p style={{ textAlign:"center",color:C.muted,fontSize:12,marginTop:10 }}>200 premiers résultats — affinez vos filtres</p>}
    </div>
  );
}