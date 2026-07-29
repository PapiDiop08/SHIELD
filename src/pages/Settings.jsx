import { useState } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SectionHeader } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function Settings({ operators, setOperators, addLog }) {
  const { currentUser, can } = useAuth();
  const [activeTab, setActiveTab] = useState("sla");
  const [toast, setToast] = useState(null);

  function showToast(msg, c=C.success){ setToast({msg,c}); setTimeout(()=>setToast(null),3000); }

  function toggleSLA(opId) {
    setOperators(p => p.map(op => {
      if (op.id !== opId) return op;
      const enabled = !op.slaEnabled;
      addLog?.("TOGGLE_SLA","operator",opId,`SLA ${enabled?"activé":"désactivé"} — ${op.name}`,"Paramètres");
      return { ...op, slaEnabled: enabled, slaConfig: enabled ? (op.slaConfig||{critical:2,high:8,medium:24}) : op.slaConfig };
    }));
    showToast("SLA mis à jour", C.sky);
  }

  function updateSLA(opId, field, value) {
    setOperators(p => p.map(op => op.id===opId ? { ...op, slaConfig: { ...(op.slaConfig||{}), [field]: parseInt(value)||1 } } : op));
  }

  function saveSLA() {
    addLog?.("SAVE_SLA","settings",null,"Configuration SLA sauvegardée","Paramètres");
    showToast("Configuration SLA sauvegardée");
  }

  return (
    <div style={{padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {toast && <div style={{position:"fixed",top:20,right:20,background:toast.c,color:C.white,borderRadius:10,padding:"12px 20px",fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>{toast.msg}</div>}

      <SectionHeader title="Paramètres" />

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:C.white,border:`1px solid ${C.mutedL}`,borderRadius:12,padding:5}}>
        {[{k:"sla",l:"SLA"},{k:"general",l:"Général"}].map(t=>(
          <button key={t.k} onClick={()=>setActiveTab(t.k)}
            style={{flex:1,padding:"9px 14px",background:activeTab===t.k?C.navy:"none",border:"none",borderRadius:8,cursor:"pointer",color:activeTab===t.k?C.white:C.textL,fontWeight:700,fontSize:13}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* SLA Tab */}
      {activeTab==="sla" && (
        <div>
          <div style={{background:C.skyL,border:`1px solid ${C.sky}33`,borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:C.navy}}>
            <strong>SLA (Service Level Agreement)</strong> — Définissez les délais maximum de traitement des alertes par sévérité et par opérateur.
            La SLA peut être activée ou désactivée indépendamment pour chaque opérateur.
            {!can("manageSettings") && <div style={{marginTop:6,fontSize:12,color:C.warning}}>! Seul l'Admin Opérateur peut modifier les SLA.</div>}
          </div>

          {operators.map(op => (
            <Card key={op.id} style={{padding:"18px 22px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:op.slaEnabled?18:0}}>
                <div style={{width:40,height:40,background:C.skyL,border:`2px solid ${C.sky}33`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:C.sky,flexShrink:0}}>{op.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.navy}}>{op.name}</div>
                  <div style={{fontSize:11,color:C.textL}}>{op.country} · {op.active?"Actif":"Inactif"}</div>
                </div>
                <button onClick={()=>can("manageSettings")&&toggleSLA(op.id)}
                  style={{background:op.slaEnabled?C.successL:C.mutedL,border:`1px solid ${op.slaEnabled?C.success:C.muted}44`,color:op.slaEnabled?C.success:C.muted,borderRadius:20,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:can("manageSettings")?"pointer":"not-allowed"}}>
                  {op.slaEnabled?"● SLA Activé":"○ SLA Désactivé"}
                </button>
              </div>

              {op.slaEnabled && op.slaConfig && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                  {[["Critique R","critical",C.danger],["Élevé O","high",C.warning],["Moyen B","medium",C.sky]].map(([label,key,color])=>(
                    <div key={key} style={{background:C.bg,borderRadius:10,padding:"14px 16px",border:`1px solid ${color}22`}}>
                      <label style={{display:"block",fontSize:11,fontWeight:700,color,textTransform:"uppercase",marginBottom:10}}>{label}</label>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input type="number" value={op.slaConfig[key]||0}
                          onChange={e=>can("manageSettings")&&updateSLA(op.id,key,e.target.value)}
                          min="1" disabled={!can("manageSettings")}
                          style={{width:64,border:`2px solid ${color}44`,borderRadius:8,padding:"7px 10px",fontSize:18,fontWeight:700,color,background:C.white,outline:"none",textAlign:"center"}}/>
                        <span style={{fontSize:12,color:C.textL}}>heure{(op.slaConfig[key]||0)>1?"s":""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}

          {can("manageSettings") && (
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
              <Btn onClick={saveSLA}>Save Sauvegarder les SLA</Btn>
            </div>
          )}
        </div>
      )}

      {/* General Tab */}
      {activeTab==="general" && (
        <Card style={{padding:"24px"}}>
          <div style={{fontSize:14,fontWeight:700,color:C.navy,marginBottom:16}}>Informations de la plateforme</div>
          {[
            ["Nom de la plateforme","SHIELD Fraud Detection"],
            ["Version","v5.0.0"],
            ["Organisation","Global Fraud Management"],
            ["Environnement","Production"],
            ["Fuseau horaire","Africa/Dakar (UTC+0)"],
            ["Base de données","Snowflake (en attente d'intégration)"],
            ["Ingestion CDR","AWS S3 + Lambda (en attente)"],
            ["API Backend","FastAPI sur EC2 (en attente)"],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.mutedL}`}}>
              <span style={{fontSize:13,color:C.textL}}>{k}</span>
              <span style={{fontSize:13,fontWeight:700,color:C.navy}}>{v}</span>
            </div>
          ))}

          <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.mutedL}`}}>
            <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:12}}>Architecture cible</div>
            <div style={{background:C.bg,borderRadius:10,padding:"14px 16px",fontFamily:"monospace",fontSize:11,color:C.textL,lineHeight:1.8}}>
              Opérateurs (CDR batch 5min)<br/>
              &nbsp;&nbsp;↓ SFTP / API REST / S3<br/>
              AWS S3 Landing Zone<br/>
              &nbsp;&nbsp;↓ Lambda / Glue (ETL)<br/>
              Snowflake (Data Warehouse)<br/>
              &nbsp;&nbsp;↓ Vues agrégées MSISDN/IMEI/Cell<br/>
              FastAPI (EC2 — Backend SHIELD)<br/>
              &nbsp;&nbsp;↓ REST API<br/>
              SHIELD Frontend (Vercel / EC2)
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}