// ── SHIELD Complaints Page — FULL LINK ───────────────────────────────────────
// Données depuis Supabase via useComplaints (hook existant) — plus de MOCK_COMPLAINTS

import { useState } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SectionHeader } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

const tagColor = t => ({
  "Arnaque marabout": C.danger, "Fraude": C.warning, "Escroquerie": C.purple,
  "Harcèlement": C.sky, "Phishing": C.danger, "Spam": C.muted,
}[t] || C.muted);

// ── Composant analyse IA (inchangé — utilise les données Supabase) ────────
function AICard({ complaint }) {
  return (
    <div style={{ background: C.purpleL, border: `1px solid ${C.purple}33`, borderRadius: 10, padding: "14px 18px", marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ background: C.purple, color: C.white, borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700 }}>🤖 IA SHIELD</div>
        <Badge label={complaint.tag} color={tagColor(complaint.tag)} small />
        <span style={{ fontSize: 11, color: C.muted }}>Confiance : {complaint.confidence}%</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: C.navy, lineHeight: 1.6 }}>
        {complaint.summary || "Analyse IA disponible — comportement frauduleux potentiel détecté."}
      </p>
    </div>
  );
}

export default function Complaints({ complaints, setComplaints, setBlacklist, setSimProfile, addLog }) {
  const { currentUser } = useAuth();
  const [selected, setSelected]     = useState([]);
  const [viewDetail, setViewDetail] = useState(null);
  const [filterTag, setFilterTag]   = useState("Tous");
  const [actionDone, setActionDone] = useState(null);

  // complaints vient des props — chargé depuis Supabase via useComplaints dans App.jsx ✅
  const tags     = ["Tous", ...new Set(complaints.map(c => c.tag))];
  const filtered = filterTag === "Tous" ? complaints : (complaints||[]).filter(c => c.tag === filterTag);

  function doGroupAction(action) {
    const targets = (complaints||[]).filter(c => selected.includes(c.id));
    if (action === "block") {
      targets.forEach(c => {
        if (c.msisdn) {
          setBlacklist(p => [{
            id: Date.now() + Math.random(), list: "blacklist", type: "MSISDN",
            value: c.msisdn, reason: `Plainte : ${c.tag}`,
            addedBy: currentUser?.id, date: new Date().toISOString().slice(0, 10),
            active: true, matches: 0, lastMatch: null,
          }, ...p]);
          addLog?.("BLOCK_SIM", "complaint", c.id, `Blocage plainte — ${c.msisdn} — ${c.tag}`, "Plaintes");
        }
      });
    }
    setActionDone(action);
    setSelected([]);
  }

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader
        title="Plaintes & Signalements"
        sub={`${complaints.length} signalements · Données Supabase · Analyse IA automatique`}
        action={<Btn variant="secondary">📥 Importer CSV</Btn>}
      />

      {actionDone && (
        <div style={{ background: C.successL, border: `1px solid ${C.success}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 14, color: C.success, fontWeight: 700 }}>
          ✅ Action effectuée avec succès
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
          <Btn variant="warning" small onClick={() => doGroupAction("monitor")}>👁 Observer</Btn>
          <Btn variant="danger"  small onClick={() => doGroupAction("block")}>🚫 Bloquer</Btn>
        </div>
      )}

      {/* Corps principal */}
      {complaints.length === 0 ? (
        <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <p style={{ margin: 0 }}>Aucune plainte dans Supabase</p>
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
                <div style={{ fontSize: 32, marginBottom: 12 }}>👆</div>
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

                    <AICard complaint={c} />
                  </Card>

                  <Card style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Actions</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn variant="danger" small onClick={() => {
                        setBlacklist(p => [{
                          id: Date.now(), list: "blacklist", type: "MSISDN",
                          value: c.msisdn, reason: `Plainte : ${c.tag}`,
                          addedBy: currentUser?.id, date: new Date().toISOString().slice(0, 10),
                          active: true, matches: 0, lastMatch: null,
                        }, ...p]);
                        addLog?.("BLOCK_SIM", "complaint", c.id, `Blocage depuis plainte — ${c.msisdn}`, "Plaintes");
                      }}>🚫 Bloquer</Btn>
                      <Btn variant="warning" small>👁 Observer</Btn>
                      <Btn variant="ghost" small>✅ Faux positif</Btn>
                    </div>
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