import { useState } from "react";
import { C, fraudCatColor, fraudCatIcon, sevColor } from "../theme.js";
import { Card, Badge, Btn, SectionHeader, Modal } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

const ANALYSIS_MODULES = [
  { id:"global", icon:"🌐", label:"Analyse globale", desc:"Analyse complète — toutes les données combinées (alertes, blocages, règles, listes, antennes, MM)", cost:1000, duration:4000, premium:true },
  { id:"alerts", icon:"🔔", label:"Analyse des alertes", desc:"Corrélations entre alertes, foyers actifs, progression temporelle, patterns par type de fraude", cost:300, duration:2500 },
  { id:"blockings", icon:"🛑", label:"Analyse des blocages", desc:"Récidivistes, contournements (même IMEI nouvelle SIM), efficacité des blocages, taux de déblocage", cost:200, duration:1800 },
  { id:"cells", icon:"📡", label:"Analyse Cell IDs", desc:"Antennes à risque, clusters géographiques SIM Box, distance anormale entre cell IDs, foyers actifs", cost:300, duration:2200 },
  { id:"blacklist", icon:"🚫", label:"Analyse Blacklist", desc:"Doublons, entrées obsolètes, préfixes IMEI suspects, cohérence avec les blocages actifs", cost:150, duration:1500 },
  { id:"whitelist", icon:"✅", label:"Analyse Whitelist", desc:"Entrées qui pourraient être en blacklist, anomalies de comportement sur numéros en whitelist", cost:150, duration:1500 },
  { id:"mm", icon:"💸", label:"Analyse Mobile Money", desc:"Dépassements récurrents, comptes mules, ATO patterns, corrélation SIM Swap + MM", cost:400, duration:3000 },
  { id:"rules", icon:"⚙", label:"Analyse des règles", desc:"Règles inefficaces, faux positifs élevés, règles manquantes, chevauchements et conflits", cost:200, duration:1800 },
];

const MOCK_RESULTS = {
  global: {
    riskLevel:"critical", confidence:94,
    summary:"Analyse complète de 8 alertes, 4 blocages, 30 règles actives, 6 entrées blacklist et 2 anomalies antennes. Plusieurs patterns critiques identifiés.",
    findings:[
      { sev:"critical",icon:"🔴",title:"Foyer SIM Box actif — BTS-DKR-042",desc:"Antenne +919% de trafic. 3 SIMs score >87 fixées sur cette antenne. Préfixe IMEI 354921 commun — lot boîtiers SIM Box confirmé.",action:"Blacklister préfixe IMEI 354921. Bloquer l'antenne BTS-DKR-042." },
      { sev:"critical",icon:"🔴",title:"ATO Mobile Money — Corrélation SIM Swap",desc:"77987XXXXX : SIM Swap + envoi MM anormal (score 91). 100% bénéficiaires nouveaux. Schéma ATO classique.",action:"Bloquer SIM et geler compte MM associé." },
      { sev:"high",icon:"🟠",title:"Réseau Wangiri — Campagne 77630x",desc:"234 alertes Wangiri, numéros séquentiels 77630x, durée moy. 3.2s, destinations surtaxées internationales.",action:"Blacklister préfixe 77630. Renforcer règle séquentielle." },
      { sev:"medium",icon:"🟡",title:"Arnaque Marabout — Réseau Emirats",desc:"19 alertes corrélées, destinations AE+MA communes. Réseau coordonné probable.",action:"Renforcer règle fixe+Emirats. Ajouter tag case Marabout." },
    ],
    recommendations:["Blacklister préfixe IMEI 354921 globalement","Seuil déviation MM : 300% pour comptes <90j","SLA 30min pour alertes score >85","Partager détection Wangiri 77630x avec autres opérateurs"],
    stats:{ analyzed:8, casesAnalyzed:3, riskSIMs:5, riskIMEI:1, riskCells:1 }
  },
  alerts:{
    riskLevel:"high", confidence:89,
    summary:"Analyse de 8 alertes actives. 5 alertes critiques non assignées. Progression temporelle suggère une campagne organisée.",
    findings:[
      { sev:"critical",icon:"🔴",title:"5 alertes critiques sans analyste assigné",desc:"Les alertes a4, a6 n'ont pas d'analyste — risque de dépassement SLA.",action:"Assigner immédiatement à un analyste disponible." },
      { sev:"high",icon:"🟠",title:"Cluster temporel 07h30-08h34",desc:"6 des 8 alertes se sont déclenchées en 1h. Pattern de campagne coordonnée.",action:"Créer un case 'Campagne matinale 06/06' et regrouper." },
    ],
    recommendations:["Assigner les alertes critiques non assignées","Activer SLA critique à 2h","Créer des règles de corrélation temporelle"],
    stats:{ analyzed:8, casesAnalyzed:3, riskSIMs:3, riskIMEI:0, riskCells:1 }
  },
  blockings:{
    riskLevel:"medium", confidence:82,
    summary:"Analyse de 4 blocages. 1 déblocage détecté. Aucun contournement IMEI détecté dans les données actuelles.",
    findings:[
      { sev:"medium",icon:"🟡",title:"1 SIM débloquée — surveiller",desc:"77987XXXXX débloquée récemment. À surveiller pour réactivité frauduleuse.",action:"Ajouter en watchlist 14j." },
    ],
    recommendations:["Surveiller les SIMs récemment débloquées","Ajouter détection contournement IMEI dans les règles"],
    stats:{ analyzed:4, casesAnalyzed:0, riskSIMs:1, riskIMEI:0, riskCells:0 }
  },
  cells:{
    riskLevel:"critical", confidence:96,
    summary:"2 antennes anormales. BTS-DKR-042 : signature SIM Box confirmée. Toutes les SIMs fixées sur cette antenne.",
    findings:[
      { sev:"critical",icon:"🔴",title:"BTS-DKR-042 — Foyer SIM Box confirmé",desc:"+919% trafic. 3 SIMs score >87, toutes cell_id_fixed=true. Préfixe IMEI identique.",action:"Bloquer l'antenne. Blacklister le préfixe IMEI 354921." },
      { sev:"high",icon:"🟠",title:"BTS-TBB-003 — Anomalie secondaire",desc:"+394% trafic. 1 SIM suspecte, potentiel déplacement de réseau depuis DKR-042.",action:"Surveillance renforcée 48h." },
    ],
    recommendations:["Blacklister BTS-DKR-042","Surveiller les antennes voisines","Ajouter règle cluster géographique"],
    stats:{ analyzed:2, casesAnalyzed:1, riskSIMs:4, riskIMEI:1, riskCells:2 }
  },
  blacklist:{
    riskLevel:"low", confidence:78,
    summary:"6 entrées blacklist analysées. Cohérence correcte. 1 entrée désactivée à surveiller.",
    findings:[
      { sev:"low",icon:"🔵",title:"1 entrée désactivée — Pays AE",desc:"L'entrée Pays AE est désactivée. Si le trafic vers les Emirats reprend, réactiver.",action:"Réactiver si les alertes Marabout augmentent." },
    ],
    recommendations:["Réactiver blacklist Pays AE","Vérifier la cohérence blacklist/blocages mensuellement"],
    stats:{ analyzed:6, casesAnalyzed:0, riskSIMs:0, riskIMEI:1, riskCells:1 }
  },
  whitelist:{
    riskLevel:"medium", confidence:71,
    summary:"2 entrées whitelist. Comportement normal. Aucune anomalie critique détectée.",
    findings:[
      { sev:"medium",icon:"🟡",title:"Surveiller la whitelist BTS-DKR-001",desc:"Antenne en whitelist mais adjacente à BTS-DKR-042 qui est un foyer SIM Box.",action:"Vérifier que l'antenne est bien légitime et pas compromise." },
    ],
    recommendations:["Audit trimestriel de la whitelist","Croiser avec les nouvelles alertes"],
    stats:{ analyzed:2, casesAnalyzed:0, riskSIMs:0, riskIMEI:0, riskCells:1 }
  },
  mm:{
    riskLevel:"high", confidence:91,
    summary:"Analyse Mobile Money : 34 dépassements comportementaux ce mois. Baseline moyenne 45 000 XOF, transactions bloquées à 250 000-500 000 XOF.",
    findings:[
      { sev:"high",icon:"🟠",title:"Dépassements récurrents — Profil ATO",desc:"Comptes anciens >6 mois, KYC vérifié, bénéficiaires nouveaux 100% → ingénierie sociale probable.",action:"Exiger OTP au-delà de 150 000 XOF. Revoir seuils baseline." },
      { sev:"high",icon:"🟠",title:"ATO corrélé SIM Swap — 3 cas ce mois",desc:"SIM Swap suivi d'envoi MM dans les 30min. Schéma ATO confirmé.",action:"Bloquer MM pendant 2h après tout SIM Swap." },
    ],
    recommendations:["OTP obligatoire >150 000 XOF","Blocage MM 2h post-SIM Swap","Réduire seuil déviation à 300%"],
    stats:{ analyzed:34, casesAnalyzed:1, riskSIMs:5, riskIMEI:0, riskCells:0 }
  },
  rules:{
    riskLevel:"medium", confidence:85,
    summary:"30 règles analysées. 3 règles avec taux de faux positifs élevé. 2 types de fraude sans couverture règle.",
    findings:[
      { sev:"medium",icon:"🟡",title:"PBX Hacking — Aucune règle active",desc:"Le type 'PBX Hacking' n'a pas de règle de détection. Risque non couvert.",action:"Créer une règle : appels sortants massifs depuis PABX + destination surtaxée." },
      { sev:"medium",icon:"🟡",title:"Règle Wangiri — Taux FP 8%",desc:"La règle Wangiri déclenche 8% de faux positifs. Seuil trop bas.",action:"Augmenter le seuil call_missed_out_count de 100 à 150." },
    ],
    recommendations:["Créer règle PBX Hacking","Ajuster seuil Wangiri","Revoir les règles avec >5% de faux positifs"],
    stats:{ analyzed:30, casesAnalyzed:0, riskSIMs:0, riskIMEI:0, riskCells:0 }
  },
};

const riskColors = { critical:C.danger, high:C.warning, medium:C.sky, low:C.success };

export default function AIAnalysis({ alerts, rules, blockings, blacklist, cases, operators, addLog }) {
  const { currentUser } = useAuth();
  const [selectedModules, setSelectedModules] = useState([]);
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState({});
  const [activeResult, setActiveResult] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [showCostModal, setShowCostModal] = useState(false);

  const totalCost = selectedModules.reduce((a,id)=>{
    const m = ANALYSIS_MODULES.find(x=>x.id===id);
    return a+(m?.cost||0);
  },0);

  const maxDuration = selectedModules.reduce((a,id)=>{
    const m = ANALYSIS_MODULES.find(x=>x.id===id);
    return Math.max(a,m?.duration||0);
  },0);

  function toggleModule(id) {
    setSelectedModules(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  }

  function runAnalysis() {
    setShowCostModal(false);
    setStatus("loading");
    setResults({});
    setActiveResult(null);
    addLog?.("AI_ANALYSIS_START","ai",null,`Analyse IA — modules: ${selectedModules.join(", ")}`,"IA Analyse");

    setTimeout(()=>{
      const r = {};
      selectedModules.forEach(id=>{ r[id] = MOCK_RESULTS[id] || MOCK_RESULTS.global; });
      setResults(r);
      setActiveResult(selectedModules[0]);
      setStatus("done");
      setUsageCount(p=>p+1);
      addLog?.("AI_ANALYSIS_DONE","ai",null,`Analyse IA terminée — ${selectedModules.length} modules`,"IA Analyse");
    }, maxDuration);
  }

  const currentResult = activeResult ? results[activeResult] : null;

  return (
    <div style={{padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <SectionHeader title="IA Analyse — Diagnostic interne"
        sub="Super Admin & GFM Analyste uniquement · Facturation à l'usage · IA locale — données jamais envoyées à l'extérieur" />

      {/* Info banner */}
      <div style={{background:C.navyL,border:`1px solid ${C.navyB}`,borderRadius:10,padding:"12px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
        <div style={{fontSize:22}}>🧠</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:3}}>Intelligence Artificielle locale — SHIELD</div>
          <div style={{fontSize:12,color:C.muted}}>L'IA analyse vos données de fraude pour détecter des patterns invisibles individuellement. Fonctionnement 100% local, aucune donnée externe.</div>
        </div>
        <div style={{textAlign:"center",flexShrink:0,background:C.navyB,borderRadius:8,padding:"8px 14px"}}>
          <div style={{fontSize:18,fontWeight:900,color:C.warning}}>{usageCount}</div>
          <div style={{fontSize:10,color:C.muted}}>analyse{usageCount>1?"s":""}</div>
        </div>
      </div>

      {/* Data summary */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {[{l:"Alertes actives",v:alerts.filter(a=>!["cleared","closed"].includes(a.status)).length,c:C.danger},{l:"Cases ouverts",v:cases.filter(c=>c.status!=="closed").length,c:C.warning},{l:"Blocages actifs",v:blockings.filter(b=>b.active).length,c:C.sky},{l:"Règles actives",v:rules.filter(r=>r.active).length,c:C.success}].map(s=>(
          <Card key={s.l} style={{flex:1,minWidth:100,padding:"12px 16px"}}>
            <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
            <div style={{fontSize:11,color:C.textL,marginTop:3}}>{s.l}</div>
          </Card>
        ))}
      </div>

      {status==="idle"&&(
        <>
          {/* Module selection */}
          <div style={{fontSize:14,fontWeight:700,color:C.navy,marginBottom:14}}>Choisissez les modules à analyser</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,marginBottom:20}}>
            {ANALYSIS_MODULES.map(m=>{
              const isSelected = selectedModules.includes(m.id);
              return (
                <div key={m.id} onClick={()=>toggleModule(m.id)} style={{background:isSelected?C.navyL:C.white,border:`2px solid ${isSelected?C.sky:C.mutedL}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
                  {m.premium&&<div style={{position:"absolute",top:10,right:10}}><Badge label="PREMIUM" color={C.purple} small/></div>}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <span style={{fontSize:20}}>{m.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:isSelected?C.white:C.navy}}>{m.label}</div>
                      <div style={{fontSize:11,color:isSelected?C.sky:C.muted}}>{m.cost} XOF</div>
                    </div>
                    <div style={{width:22,height:22,borderRadius:6,background:isSelected?C.sky:C.bg,border:`2px solid ${isSelected?C.sky:C.mutedL}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:isSelected?C.white:C.muted}}>
                      {isSelected?"✓":""}
                    </div>
                  </div>
                  <div style={{fontSize:11,color:isSelected?C.muted:"#6b7280",lineHeight:1.5}}>{m.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Launch bar */}
          {selectedModules.length>0&&(
            <div style={{background:C.navy,borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div>
                <div style={{color:C.white,fontWeight:700,fontSize:14}}>{selectedModules.length} module{selectedModules.length>1?"s":""} sélectionné{selectedModules.length>1?"s":""}</div>
                <div style={{color:C.muted,fontSize:12}}>Coût estimé : {totalCost.toLocaleString()} XOF</div>
              </div>
              <div style={{flex:1}}/>
              <Btn variant="ghost" onClick={()=>setSelectedModules([])}>Tout déselectionner</Btn>
              <Btn onClick={()=>setShowCostModal(true)} style={{fontSize:14,padding:"11px 24px"}}>🚀 Lancer l'analyse</Btn>
            </div>
          )}
          {selectedModules.length===0&&(
            <div style={{textAlign:"center",padding:"24px",color:C.muted,background:C.white,borderRadius:12,border:`1px solid ${C.mutedL}`}}>
              <div style={{fontSize:28,marginBottom:8}}>☝️</div>
              <p style={{margin:0}}>Sélectionnez au moins un module pour lancer l'analyse</p>
            </div>
          )}
        </>
      )}

      {/* Loading */}
      {status==="loading"&&(
        <Card style={{padding:"48px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:20}}>⏳</div>
          <div style={{fontSize:16,fontWeight:700,color:C.navy,marginBottom:16}}>Analyse en cours...</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxWidth:360,margin:"0 auto"}}>
            {selectedModules.map(id=>{
              const m=ANALYSIS_MODULES.find(x=>x.id===id);
              return (
                <div key={id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 16px",background:C.bg,borderRadius:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.sky,flexShrink:0}}/>
                  <span style={{fontSize:13,color:C.textL}}>{m?.icon} {m?.label}...</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Results */}
      {status==="done"&&Object.keys(results).length>0&&(
        <div style={{display:"flex",gap:16}}>
          {/* Module tabs */}
          <div style={{width:200,flexShrink:0}}>
            <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>Résultats</div>
            {selectedModules.map(id=>{
              const m=ANALYSIS_MODULES.find(x=>x.id===id);
              const r=results[id];
              const isActive=activeResult===id;
              return (
                <div key={id} onClick={()=>setActiveResult(id)} style={{background:isActive?C.navy:C.white,border:`1px solid ${isActive?C.navy:C.mutedL}`,borderRadius:10,padding:"10px 14px",marginBottom:8,cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:16}}>{m?.icon}</span>
                    <span style={{fontSize:12,fontWeight:700,color:isActive?C.white:C.navy}}>{m?.label}</span>
                  </div>
                  {r&&<Badge label={r.riskLevel} color={riskColors[r.riskLevel]} small/>}
                </div>
              );
            })}
            <div style={{marginTop:14}}>
              <Btn variant="ghost" small onClick={()=>{setStatus("idle");setResults({});setSelectedModules([]);}}>Nouvelle analyse</Btn>
            </div>
          </div>

          {/* Result detail */}
          <div style={{flex:1}}>
            {currentResult&&(
              <>
                <Card style={{padding:"18px 20px",marginBottom:12,borderLeft:`5px solid ${riskColors[currentResult.riskLevel]}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                    <Badge label={`Risque ${currentResult.riskLevel}`} color={riskColors[currentResult.riskLevel]}/>
                    <Badge label={`Confiance ${currentResult.confidence}%`} color={C.purple} small/>
                    <div style={{flex:1}}/>
                    <Btn variant="ghost" small>📄 Exporter PDF</Btn>
                  </div>
                  <p style={{margin:0,fontSize:13,color:C.text,lineHeight:1.6}}>{currentResult.summary}</p>
                  <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
                    {Object.entries(currentResult.stats).map(([k,v])=>(
                      <div key={k} style={{background:C.bg,borderRadius:8,padding:"8px 12px",textAlign:"center",minWidth:70}}>
                        <div style={{fontSize:18,fontWeight:900,color:C.navy}}>{v}</div>
                        <div style={{fontSize:9,color:C.muted}}>{k}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {currentResult.findings.map((f,i)=>(
                  <Card key={i} style={{padding:"14px 18px",marginBottom:10,borderLeft:`4px solid ${riskColors[f.sev]||C.muted}`}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                      <span style={{fontSize:18,flexShrink:0}}>{f.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                          <span style={{fontWeight:700,fontSize:13,color:C.navy}}>{f.title}</span>
                          <Badge label={f.sev} color={riskColors[f.sev]||C.muted} small/>
                        </div>
                        <p style={{margin:"0 0 8px",fontSize:12,color:C.textL,lineHeight:1.5}}>{f.desc}</p>
                        <div style={{background:riskColors[f.sev]+"18",border:`1px solid ${riskColors[f.sev]}33`,borderRadius:7,padding:"7px 12px"}}>
                          <span style={{fontSize:11,fontWeight:700,color:riskColors[f.sev]}}>💡 </span>
                          <span style={{fontSize:12,color:C.text}}>{f.action}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                <Card style={{padding:"16px 20px"}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:12}}>Recommandations</div>
                  {currentResult.recommendations.map((r,i)=>(
                    <div key={i} style={{display:"flex",gap:12,padding:"9px 0",borderBottom:`1px solid ${C.mutedL}`}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:C.navy,color:C.white,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</div>
                      <span style={{fontSize:13,color:C.text,lineHeight:1.5}}>{r}</span>
                    </div>
                  ))}
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cost confirm modal */}
      {showCostModal&&(
        <Modal title="Confirmer l'analyse" onClose={()=>setShowCostModal(false)} width={440}>
          <div style={{padding:"20px 24px"}}>
            <div style={{background:C.bg,borderRadius:10,padding:"16px",marginBottom:18}}>
              <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:10}}>Modules sélectionnés :</div>
              {selectedModules.map(id=>{
                const m=ANALYSIS_MODULES.find(x=>x.id===id);
                return (
                  <div key={id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.mutedL}`}}>
                    <span style={{fontSize:13,color:C.navy}}>{m?.icon} {m?.label}</span>
                    <span style={{fontSize:13,fontWeight:700,color:C.navy}}>{m?.cost} XOF</span>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",fontWeight:900,fontSize:15}}>
                <span style={{color:C.navy}}>Total</span>
                <span style={{color:C.danger}}>{totalCost.toLocaleString()} XOF</span>
              </div>
            </div>
            <p style={{margin:"0 0 18px",fontSize:13,color:C.textL}}>Cette analyse sera facturée et enregistrée dans les logs. L'IA analysera vos données localement.</p>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" onClick={()=>setShowCostModal(false)} style={{flex:1,justifyContent:"center"}}>Annuler</Btn>
              <Btn onClick={runAnalysis} style={{flex:2,justifyContent:"center"}}>🚀 Confirmer et lancer</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}