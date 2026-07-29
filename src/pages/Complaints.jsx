// ── SHIELD Complaints Page — FULL LINK ───────────────────────────────────────
// Données depuis AAR DB via useComplaints (hook existant) — plus de MOCK_COMPLAINTS

import { useState } from "react";
import { C } from "../theme.js";
import { supabase } from "../supabase.js";
import { blockAndBlacklist } from "../blockAndBlacklist.js";
import { Card, Badge, Btn, SectionHeader } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

const tagColor = t => ({
  "Arnaque marabout": C.danger, "Fraude": C.warning, "Escroquerie": C.purple,
  "Harcèlement": C.sky, "Phishing": C.danger, "Spam": C.muted,
}[t] || C.muted);

// ── Analyse IA locale via Ollama ─────────────────────────────────────────
async function analyzeComplaintWithOllama(rawText, msisdn) {
  const prompt = `Tu es un expert fraude télécom et Mobile Money en Afrique.
Analyse cette plainte client et réponds UNIQUEMENT en JSON valide, sans markdown.

Plainte : "${rawText}"
MSISDN signalé : ${msisdn || "inconnu"}

Format de réponse exact :
{
  "fraud_type": "Wangiri|ATO|IRSF|SIM Box|Phishing opérateur|Fraude Agent MM|Arnaque Marabout|Money Muling MM|Subscription Fraud|Faux positif",
  "confidence": 85,
  "ai_summary": "Résumé clair en 1-2 phrases basé sur le texte de la plainte",
  "ai_tag": "Wangiri|ATO|IRSF|SIM Box|Phishing|Fraude MM|Arnaque|Muling|Subscription|FP"
}`;

  try {
    const response = await fetch("/api/ollama/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:0.5b",
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.1, num_predict: 400 }
      })
    });
    if (!response.ok) throw new Error(`Ollama ${response.status}`);
    const data = await response.json();
    const clean = (data.response || "").replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("Ollama analyse plainte:", err);
    return null;
  }
}

// ── Composant carte IA ────────────────────────────────────────────────────
function AICard({ complaint, onAnalyze, analyzing }) {
  const hasAnalysis = complaint.ai_summary && complaint.ai_summary.length > 10;
  return (
    <div style={{ background: C.purpleL, border: `1px solid ${C.purple}33`, borderRadius: 10, padding: "14px 18px", marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: C.purple, color: C.white, borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700 }}>IA SHIELD</div>
          {complaint.ai_tag && <Badge label={complaint.ai_tag} color={C.purple} small />}
          {complaint.confidence > 0 && <span style={{ fontSize: 11, color: C.muted }}>Confiance : {complaint.confidence}%</span>}
        </div>
        {!hasAnalysis && (
          <button onClick={onAnalyze} disabled={analyzing}
            style={{ padding: "4px 10px", background: analyzing ? C.muted : C.purple,
              color: C.white, border: "none", borderRadius: 6, fontSize: 11,
              fontWeight: 700, cursor: analyzing ? "not-allowed" : "pointer" }}>
            {analyzing ? "Analyse..." : "Analyser"}
          </button>
        )}
      </div>
      {hasAnalysis ? (
        <p style={{ margin: 0, fontSize: 13, color: C.navy, lineHeight: 1.6 }}>{complaint.ai_summary}</p>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: "italic" }}>
          {analyzing ? "Ollama analyse la plainte..." : "Cliquez sur Analyser pour une analyse IA locale."}
        </p>
      )}
    </div>
  );
}


export default function Complaints({ complaints, setComplaints, setBlacklist, setSimProfile, addLog }) {
  const { currentUser } = useAuth();
  const [selected, setSelected]     = useState([]);
  const [viewDetail, setViewDetail] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);

  // Analyser une plainte avec Ollama local
  async function handleAnalyzeComplaint(c) {
    setAnalyzingId(c.id);
    try {
      const result = await analyzeComplaintWithOllama(c.raw_text || c.texte || "", c.msisdn_reported || c.msisdn);
      if (result) {
        // Mettre à jour AAR DB
        await supabase.from("complaints").update({
          fraud_type:  result.fraud_type  || c.fraud_type,
          confidence:  result.confidence  || c.confidence,
          ai_summary:  result.ai_summary  || "",
          ai_tag:      result.ai_tag      || "",
        }).eq("id", c.id);
        // Mettre à jour l'état local
        setComplaints(p => p.map(x => x.id === c.id ? {
          ...x,
          fraud_type: result.fraud_type || x.fraud_type,
          confidence: result.confidence || x.confidence,
          ai_summary: result.ai_summary || x.ai_summary,
          ai_tag:     result.ai_tag     || x.ai_tag,
        } : x));
        // Si viewDetail ouvert, mettre à jour
        if (viewDetail?.id === c.id) {
          setViewDetail(p => ({ ...p,
            fraud_type: result.fraud_type || p.fraud_type,
            confidence: result.confidence || p.confidence,
            ai_summary: result.ai_summary || p.ai_summary,
            ai_tag:     result.ai_tag     || p.ai_tag,
          }));
        }
        addLog?.("AI_ANALYZE_COMPLAINT", "complaint", c.id,
          `Analyse Ollama — ${result.fraud_type} — Confiance ${result.confidence}%`, "Plaintes");
      }
    } catch (err) {
      console.error("Erreur analyse plainte:", err);
    } finally {
      setAnalyzingId(null);
    }
  }
  const [filterTag, setFilterTag]   = useState("Tous");
  const [actionDone, setActionDone] = useState(null);
  const [threshold, setThreshold]   = useState(5);
  const [blocking, setBlocking]     = useState(null);

  // Auto-blocage : numéros avec count >= threshold non encore bloqués
  const complaintCounts = {};
  (complaints || []).forEach(c => {
    const num = c.msisdn_reported || c.msisdn;
    if (num) complaintCounts[num] = (complaintCounts[num] || 0) + 1;
  });
  const autoBlockCandidates = Object.entries(complaintCounts)
    .filter(([msisdn, count]) =>
      count >= threshold &&
      !(complaints || []).find(c => (c.msisdn_reported || c.msisdn) === msisdn && c.auto_blocked)
    )
    .map(([msisdn, count]) => ({ msisdn, count }));

  async function handleAutoBlock(msisdn) {
    if (!window.confirm(`Bloquer temporairement ${msisdn} (${threshold}+ signalements) ?`)) return;
    setBlocking(msisdn);
    try {
      const operator = currentUser?.operator || null;
      await supabase.from("blockings").insert({
        id: `b_auto_${Date.now()}`,
        msisdn,
        reason: `Auto-blocage — ${threshold} plaintes ou plus sur ce numéro`,
        operator,
        active: true,
        source: "auto",
        date: new Date().toISOString().slice(0, 10),
      });
      await supabase.from("complaints")
        .update({ auto_blocked: true })
        .eq("msisdn_reported", msisdn);
      setComplaints(p => p.map(c =>
        (c.msisdn_reported || c.msisdn) === msisdn ? { ...c, auto_blocked: true } : c
      ));
      addLog?.("AUTO_BLOCK", "complaint", null, `Auto-blocage ${msisdn} — ${threshold}+ plaintes`, "Plaintes");
    } catch (err) {
      console.error("Auto-block error:", err);
    } finally {
      setBlocking(null);
    }
  }

  // complaints vient des props — chargé depuis AAR DB via useComplaints dans App.jsx OK
  const tags     = ["Tous", ...new Set(complaints.map(c => c.tag))];
  const filtered = filterTag === "Tous" ? complaints : (complaints||[]).filter(c => c.tag === filterTag);

  async function doGroupAction(action) {
    const targets = (complaints||[]).filter(c => selected.includes(c.id));
    for (const c of targets) {
      const msisdn = c.msisdn_reported || c.msisdn;
      if (!msisdn) continue;
            if (action === "block") {
        await blockAndBlacklist({
          msisdn,
          operatorId: c.operator_id || null,
          reason: `Plainte groupée — ${c.fraud_type || c.tag}`,
          addLog,
        });
      } else if (action === "monitor") {
        await supabase.from("control_lists").insert([{
          list_type: "watchlist", entry_type: "msisdn",
          value: msisdn, reason: `Surveillance — ${c.fraud_type || c.tag}`,
          active: true,
        }]);
        addLog?.("WATCHLIST_ADD","complaint",c.id,`Watchlist ${msisdn}`,"Plaintes");
      }
    }
    setActionDone(action);
    setSelected([]);
  }

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader
        title="Plaintes & Signalements"
        sub={`${complaints.length} signalements · Données en direct`}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 12, color: "#8a96b8", fontWeight: 600 }}>
              Seuil auto-blocage :
            </label>
            <select
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              style={{ border: "1px solid #1e3060", borderRadius: 6, padding: "5px 10px", fontSize: 12, background: "#0d1b3e", color: "#fff", cursor: "pointer" }}>
              {[2, 3, 5, 10, 15, 20].map(n => (
                <option key={n} value={n}>{n} plaintes</option>
              ))}
            </select>
          </div>
        }
      />

      {/* ── Bannières auto-blocage ─────────────────────────────────────────── */}
      {autoBlockCandidates.map(({ msisdn, count }) => (
        <div key={msisdn} style={{
          background: "#fff3cd", border: "1px solid #ffc107",
          borderRadius: 10, padding: "14px 18px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#e53e3e" }}>⚠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#7c4a03" }}>
              Alerte auto-blocage — {count} plaintes sur <span style={{ fontFamily: "monospace" }}>{msisdn}</span>
            </div>
            <div style={{ fontSize: 12, color: "#a0620a", marginTop: 2 }}>
              Ce numéro a été signalé {count} fois (seuil : {threshold}). Blocage temporaire recommandé.
            </div>
          </div>
          <button
            onClick={() => handleAutoBlock(msisdn)}
            disabled={blocking === msisdn}
            style={{
              background: blocking === msisdn ? "#8a96b8" : "#e53e3e",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: blocking === msisdn ? "not-allowed" : "pointer",
            }}>
            {blocking === msisdn ? "Blocage…" : "Bloquer"}
          </button>
        </div>
      ))}

      {actionDone && (
        <div style={{ background: C.successL, border: `1px solid ${C.success}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 14, color: C.success, fontWeight: 700 }}>
          OK Action effectuée avec succès
        </div>
      )}

      {/* Filtres par tag */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tags.map(t => (
          <button key={t} onClick={() => setFilterTag(t)} style={{
            background: filterTag === t ? tagColor(t) : C.white,
            color: filterTag === t ? C.white : C.textL,
            border: `1px solid ${filterTag === t ? tagColor(t) : C.mutedL}`,
            borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>{t}</button>
        ))}
      </div>

      {/* Barre actions groupées */}
      {selected.length > 0 && (
        <div style={{ background: C.navy, borderRadius: 10, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ color: C.white, fontWeight: 700 }}>{selected.length} sélectionné{selected.length > 1 ? "s" : ""}</span>
          <button onClick={() => setSelected(filtered.map(c => c.id))}
            style={{ background: "none", border: `1px solid ${C.navyB}`, color: C.sky, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
            Tout ({filtered.length})
          </button>
          <button onClick={() => setSelected([])}
            style={{ background: "none", border: `1px solid ${C.navyB}`, color: C.muted, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
            Désélectionner
          </button>
          <div style={{ flex: 1 }} />
          <Btn variant="warning" small onClick={() => doGroupAction("monitor")}>Observer</Btn>
          <Btn variant="danger"  small onClick={() => doGroupAction("block")}>Bloquer</Btn>
        </div>
      )}

      {/* Corps principal */}
      {complaints.length === 0 ? (
        <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>Vide</div>
          <p style={{ margin: 0 }}>Aucune plainte enregistrée</p>
        </Card>
      ) : (
        <div style={{ display: "flex", gap: 14 }}>
          {/* Liste */}
          <div style={{ flex: 1 }}>
            <Card style={{ overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.mutedL}`, fontSize: 12, fontWeight: 700, color: C.navy }}>
                Numéros signalés ({filtered.length})
              </div>
              {filtered.map(c => (
                <div key={c.id}
                  onClick={() => setViewDetail(c.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                    borderBottom: `1px solid ${C.mutedL}`, cursor: "pointer",
                    background: selected.includes(c.id) ? C.skyL : viewDetail === c.id ? C.bg : C.white,
                  }}
                  onMouseOver={e => e.currentTarget.style.background = C.bg}
                  onMouseOut={e => e.currentTarget.style.background = selected.includes(c.id) ? C.skyL : viewDetail === c.id ? C.bg : C.white}
                >
                  <input type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={e => { e.stopPropagation(); setSelected(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id]); }}
                    onClick={e => e.stopPropagation()}
                    style={{ cursor: "pointer", accentColor: C.danger, width: 14, height: 14 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: C.navy }}>{c.msisdn}</span>
                      <Badge label={c.tag} color={tagColor(c.tag)} small />
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{c.date_raw}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: c.confidence >= 90 ? C.danger : C.warning }}>{c.confidence}%</div>
                    <div style={{ fontSize: 9, color: C.muted }}>IA</div>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Détail */}
          <div style={{ flex: 2 }}>
            {!viewDetail ? (
              <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>Select</div>
                <p style={{ margin: 0, fontSize: 14 }}>Cliquez sur un numéro pour voir les détails</p>
              </Card>
            ) : (() => {
              const c = complaints.find(x => x.id === viewDetail);
              if (!c) return null;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Card style={{ padding: "18px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 16, color: C.navy }}>{c.msisdn}</span>
                          <Badge label={c.tag} color={tagColor(c.tag)} />
                          {c.status === "resolved" && (
                            <span style={{ background: "#e8f5e9", color: "#2e7d32",
                              padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                              OK Résolu
                            </span>
                          )}
                          {c.status === "investigating" && (
                            <span style={{ background: "#fff8e1", color: "#f57f17",
                              padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                              En cours d'investigation
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>{c.date_raw}</div>
                      </div>
                      <Btn variant="navy" small onClick={() => setSimProfile({ msisdn: c.msisdn, score: c.confidence, fraudType: c.tag })}>
                        Voir profil SIM →
                      </Btn>
                    </div>

                    {c.raw && (
                      <div style={{ background: C.bg, borderRadius: 8, padding: "14px 16px", marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>Texte original</div>
                        <p style={{ margin: 0, fontSize: 13, color: C.navy, lineHeight: 1.7, fontStyle: "italic" }}>"{c.raw}"</p>
                      </div>
                    )}

                    <AICard complaint={c}
                onAnalyze={() => handleAnalyzeComplaint(c)}
                analyzing={analyzingId === c?.id} />
                  </Card>

                  <Card style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Actions</div>
                    {c.status === "resolved" ? (
                      <div style={{ padding: "8px 12px", background: "#e8f5e9", borderRadius: 8,
                        color: "#2e7d32", fontSize: 12, fontWeight: 600 }}>
                        OK Plainte traitée — actions effectuées
                      </div>
                    ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn variant="danger" small onClick={async () => {
                        const msisdn = c.msisdn_reported || c.msisdn;
                        if (!msisdn || !window.confirm(`Bloquer ${msisdn} ?`)) return;
                        await blockAndBlacklist({
                          msisdn,
                          operatorId: c.operator_id || null,
                          reason: `Plainte — ${c.fraud_type || c.tag}`,
                          addLog,
                        });
                        await supabase.from("complaints").update({ status: "resolved" }).eq("id", c.id);
                        setComplaints(p => p.map(x => x.id === c.id ? {...x, status: "resolved"} : x));
                      }}>Bloquer</Btn>
                      <Btn variant="warning" small onClick={async () => {
                        const msisdn = c.msisdn_reported || c.msisdn;
                        if (!msisdn) return;
                        await supabase.from("control_lists").insert([{
                          list_type: "watchlist", entry_type: "msisdn",
                          value: msisdn, reason: `Surveillance — ${c.fraud_type || c.tag}`,
                          active: true,
                        }]);
                        await supabase.from("complaints").update({ status: "investigating" }).eq("id", c.id);
                        setComplaints(p => p.map(x => x.id === c.id ? {...x, status: "investigating"} : x));
                        addLog?.("WATCHLIST_ADD", "complaint", c.id, `Watchlist ${msisdn}`, "Plaintes");
                      }}>Surveiller</Btn>
                      <Btn variant="ghost" small onClick={async () => {
                        const msisdn = c.msisdn_reported || c.msisdn;
                        if (!msisdn) return;
                        await supabase.from("control_lists").insert([{
                          list_type: "whitelist", entry_type: "msisdn",
                          value: msisdn, reason: `Faux positif — Plainte classée`,
                          active: true,
                        }]);
                        await supabase.from("complaints").update({ status: "resolved" }).eq("id", c.id);
                        setComplaints(p => p.map(x => x.id === c.id ? {...x, status: "resolved"} : x));
                        addLog?.("WHITELIST_ADD", "complaint", c.id, `Faux positif ${msisdn}`, "Plaintes");
                      }}>OK Faux positif</Btn>
                    </div>
                    )}
                  </Card>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}