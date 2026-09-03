// ── SHIELD Billing Page — FULL LINK ─────────────────────────────────────────
// Calcul depuis operators/alerts/blockings données + ai_usage AAR DB

import { useState, useEffect, useCallback } from "react";
import { C } from "../theme.js";
import { Card, Btn, SectionHeader, Badge } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../supabase.js";

// ── Export CSV facturation ──────────────────────────────────────────────
function exportBillingCSV(rows, filename, currentMonth) {
  const headers = ["Operateur", "Abonnement_Base_XOF", "Detections", "Cout_Detections_XOF", "Blocages", "Cout_Blocages_XOF", "Pack_MM_XOF", "Pack_IA_XOF", "Usage_IA_XOF", "Total_XOF"];
  const lines = [
    `Facturation SHIELD — ${currentMonth}`,
    headers.join(";"),
    ...rows.map(o => [
      o.name || "",
      o.monthlyFee || 250000,
      o.opAlerts, o.alertCost,
      o.opBlocked, o.blockCost,
      o.mmCost, o.aiPackCost, o.aiUsageCost,
      o.total,
    ].join(";")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Hook : usage IA depuis AAR DB par opérateur ────────────────────────
function useAIUsage() {
  const [aiUsage, setAIUsage] = useState({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const firstDay = new Date();
      firstDay.setDate(1);
      firstDay.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("ai_usage")
        .select("operator_id, tokens_used, cost_usd")
        .gte("used_at", firstDay.toISOString());

      const map = {};
      (data || []).forEach(r => {
        if (!map[r.operator_id]) map[r.operator_id] = { tokens: 0, costUsd: 0 };
        map[r.operator_id].tokens += r.tokens_used || 0;
        map[r.operator_id].costUsd += parseFloat(r.cost_usd) || 0;
      });
      setAIUsage(map);
    } catch (err) {
      console.error("useAIUsage error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { aiUsage, loading, refetch: fetch };
}

export default function Billing({ operators, alerts, blockings }) {
  const [showDetail, setShowDetail] = useState(null); // opérateur sélectionné pour le détail
  const { currentUser } = useAuth();
  const currentMonth = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  const { aiUsage, loading: aiLoading, refetch: refetchAI } = useAIUsage();

  // Alertes et blocages du mois en cours seulement
  const monthAlerts   = (alerts||[]).filter(a => a.createdAt?.slice(0, 7) === currentMonthKey);
  const activeBlockings = (blockings||[]).filter(b => b.active);

  // Calcul facturation par opérateur
  const opBills = operators.map(op => {
    const opAlerts  = monthAlerts.filter(a => a.operator === op.name || a.operatorId === op.id).length;
    const opBlocked = activeBlockings.filter(b => b.operator === op.name || b.operatorId === op.id).length;
    const ai        = aiUsage[op.id] || { tokens: 0, costUsd: 0 };

    const base       = op.monthlyFee || 250000;
    const alertCost  = opAlerts  * (op.perAlertFee  || 5);
    const blockCost  = opBlocked * (op.perBlockFee  || 10);
    const mmCost     = op.packs?.mm  ? 50000  : 0;
    const aiPackCost = op.packs?.ai  ? 100000 : 0;
    const aiUsageCost = Math.round(ai.costUsd * 655); // USD → XOF approximatif
    const total = base + alertCost + blockCost + mmCost + aiPackCost + aiUsageCost;

    return {
      ...op,
      opAlerts, opBlocked,
      alertCost, blockCost, mmCost, aiPackCost, aiUsageCost,
      aiTokens: ai.tokens,
      total,
    };
  });

  const grandTotal = opBills.reduce((a, b) => a + b.total, 0);

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader
        title="Facturation"
        sub={`${currentMonth} · Données en temps réel · Visible Super Admin uniquement`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={refetchAI}
              style={{ background: "none", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "6px 14px", color: C.muted, cursor: "pointer", fontSize: 12 }}>
              Sync
            </button>
            <Btn variant="secondary" onClick={() => exportBillingCSV(opBills, `facturation_shield_${currentMonthKey}.csv`, currentMonth)}>Import Exporter Excel</Btn>
            <Btn onClick={() => window.print()}>Générer factures PDF</Btn>
          </div>
        }
      />

      {/* KPIs globaux */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
        <Card style={{ flex: 1, padding: "16px 20px", borderTop: `3px solid ${C.success}` }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.success }}>{grandTotal.toLocaleString()} XOF</div>
          <div style={{ fontSize: 12, color: C.textL, marginTop: 4 }}>Total facturable ce mois</div>
        </Card>
        <Card style={{ flex: 1, padding: "16px 20px", borderTop: `3px solid ${C.sky}` }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.sky }}>{(operators||[]).filter(o => o.active).length}</div>
          <div style={{ fontSize: 12, color: C.textL, marginTop: 4 }}>Opérateurs actifs</div>
        </Card>
        <Card style={{ flex: 1, padding: "16px 20px", borderTop: `3px solid ${C.warning}` }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.warning }}>{monthAlerts.length}</div>
          <div style={{ fontSize: 12, color: C.textL, marginTop: 4 }}>Alertes ce mois </div>
        </Card>
        <Card style={{ flex: 1, padding: "16px 20px", borderTop: `3px solid ${C.danger}` }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.danger }}>{activeBlockings.length}</div>
          <div style={{ fontSize: 12, color: C.textL, marginTop: 4 }}>Blocages actifs </div>
        </Card>
      </div>

      {/* Carte par opérateur */}
      {opBills.map(op => (
        <Card key={op.id} style={{ padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: C.navy }}>{op.name}</span>
                <Badge label={op.code} color={C.navyB} small />
                <Badge label={op.active ? "Actif" : "Inactif"} color={op.active ? C.success : C.muted} small />
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{op.contact}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.success }}>{op.total.toLocaleString()} XOF</div>
              <div style={{ fontSize: 11, color: C.muted }}>Total {currentMonth}</div>
              <Badge label="En attente" color={C.warning} small />
            </div>
          </div>

          {/* Détail des lignes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, padding: "14px", background: C.bg, borderRadius: 10 }}>
            {[
              ["Forfait mensuel", op.monthlyFee || 0, C.navy],
              [`${op.opAlerts} alertes`, op.alertCost, C.sky],
              [`${op.opBlocked} blocages`, op.blockCost, C.warning],
              op.packs?.mm ? ["Pack Mobile Money", op.mmCost, C.teal] : null,
              op.packs?.ai ? ["Pack IA", op.aiPackCost, C.purple] : null,
              op.aiTokens > 0 ? [`IA usage (${op.aiTokens.toLocaleString()} tokens)`, op.aiUsageCost, C.purple] : null,
            ].filter(Boolean).map(([l, v, c]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v.toLocaleString()} XOF</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Barre de répartition visuelle */}
          <div style={{ marginTop: 12, height: 6, background: C.mutedL, borderRadius: 4, display: "flex", overflow: "hidden" }}>
            {[
              { v: op.monthlyFee || 0, c: C.navy },
              { v: op.alertCost, c: C.sky },
              { v: op.blockCost, c: C.warning },
              { v: op.mmCost + op.aiPackCost + op.aiUsageCost, c: C.purple },
            ].filter(s => s.v > 0).map((s, i) => (
              <div key={i} style={{
                flex: s.v,
                background: s.c,
                height: "100%",
              }} />
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn variant="secondary" small onClick={() => setShowDetail(op)}>Voir détails</Btn>
            <Btn variant="ghost" small>Générer facture PDF</Btn>
            <Btn variant="ghost" small>Email Envoyer par email</Btn>
          </div>
        </Card>
      ))}

      {/* Modal détail opérateur */}
      {showDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: C.white, borderRadius: 16, padding: 28, width: 560, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.navy }}>{showDetail.name} — Détail facturation</div>
              <button onClick={() => setShowDetail(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.muted }}>X</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                ["Période", currentMonth],
                ["Forfait mensuel", `${(showDetail.monthlyFee||0).toLocaleString()} XOF`],
                ["Alertes générées", monthAlerts.filter(a => a.operatorId === showDetail.id || a.operator === showDetail.name).length],
                ["Coût alertes", `${(monthAlerts.filter(a => a.operatorId === showDetail.id || a.operator === showDetail.name).length * (showDetail.perAlertFee||5)).toLocaleString()} XOF`],
                ["Blocages actifs", blockings.filter(b => b.active && (b.operatorId === showDetail.id || b.operator === showDetail.name)).length],
                ["Coût blocages", `${(blockings.filter(b => b.active && (b.operatorId === showDetail.id || b.operator === showDetail.name)).length * (showDetail.perBlockFee||10)).toLocaleString()} XOF`],
                ["Pack Mobile Money", showDetail.packs?.mm ? "50,000 XOF" : "Non souscrit"],
                ["Pack IA", showDetail.packs?.ai ? "100,000 XOF" : "Non souscrit"],
              ].map(([label, val]) => (
                <div key={label} style={{ background: C.bg, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${C.mutedL}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted }}>Total facturable</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: C.success }}>
                  {opBills.find(b => b.operator.id === showDetail.id)?.total?.toLocaleString() || 0} XOF
                </div>
              </div>
              <Btn onClick={() => setShowDetail(null)}>Fermer</Btn>
            </div>
          </div>
        </div>
      )}

      {operators.length === 0 && (
        <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>OP</div>
          <p style={{ margin: 0 }}>Aucun opérateur configuré</p>
        </Card>
      )}
    </div>
  );
}