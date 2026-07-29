// ── SHIELD — IA Analyse — Appel réel API Anthropic ───────────────────────
// L'IA reçoit les données réelles en contexte et analyse

import { useState } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SectionHeader } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

const ANALYSIS_MODULES = [
  { id:"global",    icon:"GLOB", label:"Analyse globale",       desc:"Analyse complète — alertes, blocages, règles, listes, antennes, Mobile Money combinés",         cost:1000, premium:true },
  { id:"alerts",    icon:"ALT", label:"Analyse des alertes",   desc:"Corrélations, foyers actifs, progression temporelle, patterns par type de fraude",               cost:300  },
  { id:"blockings", icon:"BLK", label:"Analyse des blocages",  desc:"Récidivistes, contournements IMEI, efficacité des blocages, taux de déblocage",                 cost:200  },
  { id:"cells",     icon:"ANT", label:"Analyse Cell IDs",      desc:"Antennes à risque, clusters SIM Box, distance anormale, foyers actifs géolocalisés",             cost:300  },
  { id:"blacklist", icon:"BL", label:"Analyse Blacklist",     desc:"Doublons, entrées obsolètes, préfixes IMEI suspects, cohérence avec blocages actifs",            cost:150  },
  { id:"whitelist", icon:"OK", label:"Analyse Whitelist",     desc:"Entrées à risque, anomalies comportementales sur numéros en whitelist",                          cost:150  },
  { id:"mm",        icon:"MM", label:"Analyse Mobile Money",  desc:"Dépassements récurrents, comptes mules, ATO patterns, corrélation SIM Swap + MM",               cost:400  },
  { id:"rules",     icon:"RGL", label:"Analyse des règles",    desc:"Règles inefficaces, faux positifs élevés, règles manquantes, chevauchements et conflits",        cost:200  },
];

const riskColors = { critical: C.danger, high: C.warning, medium: C.sky, low: C.success };

function buildPrompt(moduleId, data) {
  const { alerts = [], rules = [], blockings = [], blacklist = [], cases = [], operators = [] } = data;

  const activeAlerts = alerts.filter(a => !["cleared","false_positive"].includes(a.status));
  const activeBlockings = blockings.filter(b => b.active);
  const activeRules = rules.filter(r => r.active);

  const contextMap = {
    global: `Tu es un expert fraude télécom et Mobile Money avec 10+ ans d'expérience terrain en Afrique.
Analyse TOUTES ces données SHIELD et identifie les patterns critiques :

ALERTES ACTIVES (${activeAlerts.length}) :
${JSON.stringify(activeAlerts.slice(0, 30), null, 1)}

BLOCAGES ACTIFS (${activeBlockings.length}) :
${JSON.stringify(activeBlockings.slice(0, 15), null, 1)}

RÈGLES ACTIVES (${activeRules.length}) :
${JSON.stringify(activeRules.slice(0, 20).map(r => ({name:r.name,fraud_type:r.fraud_type,severity:r.severity,triggered:r.triggered,blocked:r.blocked})), null, 1)}

LISTES CONTRÔLE (${blacklist.length} entrées) :
${JSON.stringify(blacklist.slice(0, 15), null, 1)}`,

    alerts: `Tu es un expert fraude télécom. Analyse ces alertes SHIELD :
${JSON.stringify(activeAlerts.slice(0, 40), null, 1)}
Opérateurs actifs : ${operators.map(o=>o.name||o.code).join(', ')}`,

    blockings: `Tu es un expert fraude télécom. Analyse ces blocages SHIELD :
ACTIFS : ${JSON.stringify(activeBlockings.slice(0, 30), null, 1)}
TOUS : ${JSON.stringify(blockings.slice(0, 40), null, 1)}`,

    cells: `Tu es un expert fraude télécom. Analyse les données liées aux antennes dans ces alertes :
${JSON.stringify(activeAlerts.filter(a => a.cell_id).slice(0, 40), null, 1)}`,

    blacklist: `Tu es un expert fraude télécom. Analyse ces listes de contrôle SHIELD :
${JSON.stringify(blacklist.slice(0, 40), null, 1)}`,

    whitelist: `Tu es un expert fraude télécom. Analyse les entrées whitelist de ces listes :
${JSON.stringify(blacklist.filter(e => e.list_type === 'whitelist' || e.list === 'whitelist').slice(0, 30), null, 1)}`,

    mm: `Tu es un expert fraude Mobile Money. Analyse les alertes MM de ces données :
${JSON.stringify(activeAlerts.filter(a => ['ATO','Fraude Agent MM','Money Muling MM'].includes(a.fraud_type)).slice(0, 30), null, 1)}
Blocages MM : ${JSON.stringify(activeBlockings.slice(0, 15), null, 1)}`,

    rules: `Tu es un expert fraude télécom. Analyse l'efficacité de ces règles de détection SHIELD :
${JSON.stringify(rules.slice(0, 50).map(r => ({name:r.name,fraud_type:r.fraud_type,severity:r.severity,active:r.active,triggered:r.triggered||0,blocked:r.blocked||0})), null, 1)}
Alertes actives par type : ${JSON.stringify(
  activeAlerts.reduce((acc, a) => { acc[a.fraud_type] = (acc[a.fraud_type]||0)+1; return acc; }, {}), null, 1
)}`,
  };

  const context = contextMap[moduleId] || contextMap.global;

  return `${context}

INSTRUCTIONS :
Réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après.
Format exact :
{
  "riskLevel": "critical|high|medium|low",
  "confidence": 85,
  "summary": "Résumé exécutif en 2-3 phrases",
  "findings": [
    {
      "sev": "critical|high|medium|low",
      "icon": "R|O|Y|B",
      "title": "Titre court du problème",
      "desc": "Description détaillée avec données chiffrées si possible",
      "action": "Action concrète recommandée"
    }
  ],
  "recommendations": ["Recommandation 1", "Recommandation 2", "Recommandation 3"],
  "stats": {
    "analyzed": 0,
    "riskSIMs": 0,
    "riskIMEI": 0,
    "riskCells": 0
  }
}

Sois précis, opérationnel, basé sur les données fournies. Minimum 2 findings, maximum 5.`;
}

export default function AIAnalysis({ alerts = [], rules = [], blockings = [], blacklist = [], cases = [], operators = [], addLog }) {
  const { currentUser } = useAuth();
  const [selectedModules, setSelectedModules] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState({});
  const [activeResult, setActiveResult] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [showCostModal, setShowCostModal] = useState(false);
  const [loadingModule, setLoadingModule] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const totalCost = selectedModules.reduce((a, id) => {
    const m = ANALYSIS_MODULES.find(x => x.id === id);
    return a + (m?.cost || 0);
  }, 0);

  function toggleModule(id) {
    setSelectedModules(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  async function callOllamaAPI(moduleId) {
    const prompt = buildPrompt(moduleId, { alerts, rules, blockings, blacklist, cases, operators });

    const response = await fetch("/api/ollama/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:0.5b",
        prompt: prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.1, num_predict: 1500 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.response || "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  }

  async function runAnalysis() {
    setShowCostModal(false);
    setStatus("loading");
    setResults({});
    setActiveResult(null);
    setErrorMsg(null);
    addLog?.("AI_ANALYSIS_START", "ai", null,
      `Analyse IA — modules: ${selectedModules.join(", ")} — ${totalCost} XOF`, "IA Analyse");

    const newResults = {};

    for (const moduleId of selectedModules) {
      setLoadingModule(moduleId);
      try {
        const result = await callOllamaAPI(moduleId);
        newResults[moduleId] = result;
      } catch (err) {
        console.error(`Erreur module ${moduleId}:`, err);
        newResults[moduleId] = {
          riskLevel: "medium",
          confidence: 0,
          summary: `Erreur lors de l'analyse : ${err.message}`,
          findings: [{ sev:"medium", icon:"!", title:"Erreur IA", desc:err.message, action:"Vérifier la connexion et réessayer." }],
          recommendations: ["Réessayer l'analyse"],
          stats: { analyzed: 0, riskSIMs: 0, riskIMEI: 0, riskCells: 0 }
        };
      }
    }

    setResults(newResults);
    setActiveResult(selectedModules[0]);
    setLoadingModule(null);
    setStatus("done");
    setUsageCount(p => p + 1);
    addLog?.("AI_ANALYSIS_DONE", "ai", null,
      `Analyse IA terminée — ${selectedModules.length} modules`, "IA Analyse");
  }

  const currentResult = activeResult ? results[activeResult] : null;
  const activeAlerts = (alerts || []).filter(a => !["cleared","false_positive"].includes(a.status));

  return (
    <div style={{ padding: "24px 20px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader title="IA Analyse — Diagnostic opérationnel"
        sub="Super Admin & AAR Analyste uniquement · IA 100% locale — Llama 3 · Zéro donnée externe" />

      {/* Banner */}
      <div style={{ background: C.navyL, border: `1px solid ${C.navyB}`, borderRadius: 10,
        padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.purple }}>IA</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 3 }}>
            Intelligence Artificielle — Analyse temps réel
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            L'IA analyse vos données réelles : {activeAlerts.length} alertes actives,{" "}
            {(blockings||[]).filter(b=>b.active).length} blocages, {(rules||[]).filter(r=>r.active).length} règles.
            Résultats opérationnels basés sur votre contexte réel.
          </div>
        </div>
        <div style={{ textAlign:"center", flexShrink:0, background:C.navyB, borderRadius:8, padding:"8px 14px" }}>
          <div style={{ fontSize:18, fontWeight:900, color:C.warning }}>{usageCount}</div>
          <div style={{ fontSize:10, color:C.muted }}>analyse{usageCount>1?"s":""}</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        {[
          { l:"Alertes actives", v:activeAlerts.length, c:C.danger },
          { l:"Blocages actifs", v:(blockings||[]).filter(b=>b.active).length, c:C.warning },
          { l:"Règles actives",  v:(rules||[]).filter(r=>r.active).length, c:C.sky },
          { l:"Listes contrôle", v:(blacklist||[]).length, c:C.success },
        ].map(s => (
          <Card key={s.l} style={{ flex:1, minWidth:110, padding:"12px 16px" }}>
            <div style={{ fontSize:22, fontWeight:900, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{s.l}</div>
          </Card>
        ))}
      </div>

      {status === "idle" && (
        <>
          <div style={{ fontSize:14, fontWeight:700, color:C.navy, marginBottom:14 }}>
            Choisissez les modules à analyser
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12, marginBottom:20 }}>
            {ANALYSIS_MODULES.map(m => {
              const isSelected = selectedModules.includes(m.id);
              return (
                <div key={m.id} onClick={() => toggleModule(m.id)}
                  style={{ background:isSelected?C.navyL:C.white,
                    border:`2px solid ${isSelected?C.sky:C.mutedL}`,
                    borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"all 0.15s", position:"relative" }}>
                  {m.premium && (
                    <div style={{ position:"absolute", top:10, right:10 }}>
                      <Badge label="PREMIUM" color={C.purple} small />
                    </div>
                  )}
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:20 }}>{m.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:isSelected?C.white:C.navy }}>{m.label}</div>
                      <div style={{ fontSize:11, color:isSelected?C.sky:C.muted }}>{m.cost} XOF</div>
                    </div>
                    <div style={{ width:22, height:22, borderRadius:6,
                      background:isSelected?C.sky:C.bg, border:`2px solid ${isSelected?C.sky:C.mutedL}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:13, color:isSelected?C.white:C.muted }}>
                      {isSelected ? "v" : ""}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:isSelected?C.muted:"#6b7280", lineHeight:1.5 }}>{m.desc}</div>
                </div>
              );
            })}
          </div>

          {selectedModules.length > 0 ? (
            <div style={{ background:C.navy, borderRadius:12, padding:"16px 20px",
              display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <div>
                <div style={{ color:C.white, fontWeight:700, fontSize:14 }}>
                  {selectedModules.length} module{selectedModules.length>1?"s":""} sélectionné{selectedModules.length>1?"s":""}
                </div>
                <div style={{ color:C.muted, fontSize:12 }}>Coût estimé : {totalCost.toLocaleString()} XOF</div>
              </div>
              <div style={{ flex:1 }} />
              <Btn variant="ghost" onClick={() => setSelectedModules([])}>Tout déselectionner</Btn>
              <Btn onClick={() => setShowCostModal(true)} style={{ fontSize:14, padding:"11px 24px" }}>
                Lancer l'analyse
              </Btn>
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"24px", color:C.muted,
              background:C.white, borderRadius:12, border:`1px solid ${C.mutedL}` }}>
              <div style={{ fontSize:11, color: C.muted, marginBottom:8 }}>Sélectionner un module</div>
              <p style={{ margin:0 }}>Sélectionnez au moins un module pour lancer l'analyse</p>
            </div>
          )}
        </>
      )}

      {/* Loading */}
      {status === "loading" && (
        <Card style={{ padding:"48px", textAlign:"center" }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Analyse en cours…</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:16 }}>
            Analyse en cours...
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, maxWidth:380, margin:"0 auto" }}>
            {selectedModules.map(id => {
              const m = ANALYSIS_MODULES.find(x => x.id === id);
              const isDone = results[id] !== undefined;
              const isActive = loadingModule === id;
              return (
                <div key={id} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"8px 16px", background:C.bg, borderRadius:8 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%",
                    background: isDone ? C.success : isActive ? C.sky : C.mutedL,
                    flexShrink:0, transition:"background 0.3s" }} />
                  <span style={{ fontSize:13, color: isDone ? C.success : C.textL }}>
                    {m?.icon} {m?.label}{isDone ? " v" : isActive ? "..." : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:20, fontSize:12, color:C.muted }}>
            L'IA analyse vos données en temps réel — {activeAlerts.length} alertes, {(rules||[]).filter(r=>r.active).length} règles
          </div>
        </Card>
      )}

      {/* Results */}
      {status === "done" && Object.keys(results).length > 0 && (
        <div style={{ display:"flex", gap:16 }}>
          {/* Tabs modules */}
          <div style={{ width:200, flexShrink:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:"uppercase", marginBottom:8 }}>
              Résultats
            </div>
            {selectedModules.map(id => {
              const m = ANALYSIS_MODULES.find(x => x.id === id);
              const r = results[id];
              const isActive = activeResult === id;
              return (
                <div key={id} onClick={() => setActiveResult(id)}
                  style={{ background:isActive?C.navy:C.white,
                    border:`1px solid ${isActive?C.navy:C.mutedL}`,
                    borderRadius:10, padding:"10px 14px", marginBottom:8, cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:16 }}>{m?.icon}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:isActive?C.white:C.navy }}>
                      {m?.label}
                    </span>
                  </div>
                  {r && <Badge label={r.riskLevel} color={riskColors[r.riskLevel]} small />}
                </div>
              );
            })}
            <div style={{ marginTop:14 }}>
              <Btn variant="ghost" small onClick={() => { setStatus("idle"); setResults({}); setSelectedModules([]); }}>
                Nouvelle analyse
              </Btn>
            </div>
          </div>

          {/* Détail résultat */}
          <div style={{ flex:1 }}>
            {currentResult && (
              <>
                <Card style={{ padding:"18px 20px", marginBottom:12,
                  borderLeft:`5px solid ${riskColors[currentResult.riskLevel] || C.muted}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
                    <Badge label={`Risque ${currentResult.riskLevel}`} color={riskColors[currentResult.riskLevel] || C.muted} />
                    <Badge label={`Confiance ${currentResult.confidence}%`} color={C.purple} small />
                    <div style={{ flex:1 }} />
                  </div>
                  <p style={{ margin:0, fontSize:13, color:C.text, lineHeight:1.6 }}>{currentResult.summary}</p>
                  {currentResult.stats && (
                    <div style={{ display:"flex", gap:10, marginTop:14, flexWrap:"wrap" }}>
                      {Object.entries(currentResult.stats).map(([k, v]) => (
                        <div key={k} style={{ background:C.bg, borderRadius:8, padding:"8px 12px", textAlign:"center", minWidth:70 }}>
                          <div style={{ fontSize:18, fontWeight:900, color:C.navy }}>{v}</div>
                          <div style={{ fontSize:9, color:C.muted }}>{k}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {(currentResult.findings || []).map((f, i) => (
                  <Card key={i} style={{ padding:"14px 18px", marginBottom:10,
                    borderLeft:`4px solid ${riskColors[f.sev] || C.muted}` }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{f.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                          <span style={{ fontWeight:700, fontSize:13, color:C.navy }}>{f.title}</span>
                          <Badge label={f.sev} color={riskColors[f.sev] || C.muted} small />
                        </div>
                        <p style={{ margin:"0 0 8px", fontSize:12, color:C.textL, lineHeight:1.5 }}>{f.desc}</p>
                        <div style={{ background:(riskColors[f.sev]||C.muted)+"18",
                          border:`1px solid ${(riskColors[f.sev]||C.muted)}33`,
                          borderRadius:7, padding:"7px 12px" }}>
                          
                          <span style={{ fontSize:12, color:C.text }}>{f.action}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {(currentResult.recommendations || []).length > 0 && (
                  <Card style={{ padding:"16px 20px" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:12 }}>
                      Recommandations
                    </div>
                    {currentResult.recommendations.map((r, i) => (
                      <div key={i} style={{ display:"flex", gap:12, padding:"9px 0",
                        borderBottom:`1px solid ${C.mutedL}` }}>
                        <div style={{ width:22, height:22, borderRadius:"50%", background:C.navy,
                          color:C.white, display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:11, fontWeight:700, flexShrink:0 }}>{i+1}</div>
                        <span style={{ fontSize:13, color:C.text, lineHeight:1.5 }}>{r}</span>
                      </div>
                    ))}
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmation */}
      {showCostModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex",
          alignItems:"center", justifyContent:"center", zIndex:1000 }}
          onClick={() => setShowCostModal(false)}>
          <div style={{ background:C.white, borderRadius:16, width:420, padding:28,
            maxHeight:"90vh", overflowY:"auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:16 }}>
              Confirmer l'analyse IA
            </div>
            <div style={{ background:C.bg, borderRadius:10, padding:16, marginBottom:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:10 }}>
                Modules sélectionnés :
              </div>
              {selectedModules.map(id => {
                const m = ANALYSIS_MODULES.find(x => x.id === id);
                return (
                  <div key={id} style={{ display:"flex", justifyContent:"space-between",
                    padding:"7px 0", borderBottom:`1px solid ${C.mutedL}` }}>
                    <span style={{ fontSize:13, color:C.navy }}>{m?.icon} {m?.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:C.navy }}>{m?.cost} XOF</span>
                  </div>
                );
              })}
              <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0",
                fontWeight:900, fontSize:15 }}>
                <span style={{ color:C.navy }}>Total</span>
                <span style={{ color:C.danger }}>{totalCost.toLocaleString()} XOF</span>
              </div>
            </div>
            <p style={{ margin:"0 0 18px", fontSize:13, color:C.muted }}>
              IA locale Llama 3 — {activeAlerts.length} alertes, {(rules||[]).filter(r=>r.active).length} règles analysées. Zéro donnée externe.
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <Btn variant="ghost" onClick={() => setShowCostModal(false)} style={{ flex:1, justifyContent:"center" }}>
                Annuler
              </Btn>
              <Btn onClick={runAnalysis} style={{ flex:2, justifyContent:"center" }}>
                Confirmer et lancer
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}