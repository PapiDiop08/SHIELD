// ── SHIELD Dashboard — Source unique : props alerts (même que Détections) ────
import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
         ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { C, sevColor, statusColor, statusLabel, fraudCatIcon } from "../theme.js";
import { Card, Stat, Badge, Btn } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../supabase.js";

export default function Dashboard({ alerts, rules, cases, setSimProfile, navigate, simActive, setSimActive }) {
  const { currentUser } = useAuth();
  const [cellAnomalies, setCellAnomalies] = useState([]);

  // ── TOUT depuis les props alerts — même source que Détections ────────────
  const safeAlerts = alerts || [];
  const safeRules  = rules  || [];
  const safeCases  = cases  || [];

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const detectionsToday = safeAlerts.filter(a => {
    const d = new Date(a.createdAt || a.detected_at || 0);
    return d >= today;
  }).length;
  const fraudsBlocked = safeAlerts.filter(a => a.status === "blocked").length;
  const activeRules   = safeRules.filter(r => r.active).length;
  const openCases     = safeCases.filter(c => ["open","in_progress","escalated"].includes(c.status)).length;
  const myAlerts      = safeAlerts.filter(a => a.assignedTo === currentUser?.id && a.status !== "cleared");

  // Tendance 7 jours
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const label = d.toLocaleDateString("fr-FR", { weekday: "short" });
    const day = safeAlerts.filter(a => {
      const dt = new Date(a.createdAt || a.detected_at || 0);
      return dt >= d && dt < next;
    });
    return { d: label, v: day.length, blocked: day.filter(a => a.status === "blocked").length };
  });

  // Stacked bar par type
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const label = d.toLocaleDateString("fr-FR", { weekday: "short" });
    const day = safeAlerts.filter(a => {
      const dt = new Date(a.createdAt || a.detected_at || 0);
      return dt >= d && dt < next;
    });
    const e = { d: label, simbox: 0, irsf: 0, wangiri: 0, mm: 0, other: 0 };
    day.forEach(a => {
      const t = a.type || "";
      if (t.includes("SIM Box")) e.simbox++;
      else if (t.includes("IRSF")) e.irsf++;
      else if (t.includes("Wangiri")) e.wangiri++;
      else if (t.includes("Money") || t.includes("MM")) e.mm++;
      else e.other++;
    });
    return e;
  });

  // Pie par type
  const PIE_COLORS = [C.danger, C.warning, C.sky, C.teal, C.purple, C.success];
  const typeCount = {};
  safeAlerts.forEach(a => { typeCount[a.type] = (typeCount[a.type] || 0) + 1; });
  const pieData = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i] }));

  // Alertes récentes — depuis props (même source que Détections)
  const recentAlerts = [...safeAlerts]
    .sort((a, b) => new Date(b.createdAt || b.detected_at || 0) - new Date(a.createdAt || a.detected_at || 0))
    .slice(0, 10);

  // Cell anomalies — seul élément chargé séparément (pas dans useAlerts)
  useEffect(() => {
    supabase.from("cell_anomalies")
      .select("*, operators(name)")
      .order("traffic_pct", { ascending: false })
      .limit(50)
      .then(({ data: raw }) => {
        if (!raw) return;
        const seen = new Set();
        setCellAnomalies(
          raw.filter(c => {
            if (seen.has(c.cell_id)) return false;
            seen.add(c.cell_id); return true;
          }).slice(0, 4).map(c => ({
            id: c.id, name: c.cell_id, location: c.location,
            delta: `+${c.traffic_pct}%`,
            status: c.severity === "critical" ? "critical" : "warning",
            sims: c.suspicious_sims || 0,
            fraudType: c.fraud_type,
          }))
        );
      });
  }, []);

  const formatTime = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.navy }}>
            Bonjour, {currentUser?.name?.split(" ")[0]} 👋
          </h1>
          <p style={{ margin: "4px 0 0", color: C.textL, fontSize: 12 }}>
            Aujourd'hui · <span style={{ color: C.success }}>● Données Supabase chargées</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Bouton Simulation ON/OFF */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: simActive ? C.successL : C.bg,
            border: `1px solid ${simActive ? C.success : C.mutedL}`,
            borderRadius: 8, padding: "6px 12px", cursor: "pointer",
          }} onClick={() => setSimActive && setSimActive(p => !p)}>
            <div style={{
              width: 32, height: 18, borderRadius: 9,
              background: simActive ? C.success : C.mutedL,
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}>
              <div style={{
                position: "absolute", top: 2,
                left: simActive ? 14 : 2,
                width: 14, height: 14, borderRadius: "50%",
                background: C.white, transition: "left 0.2s",
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700,
              color: simActive ? C.success : C.muted, whiteSpace: "nowrap" }}>
              {simActive ? "🔴 Simulation ON" : "Simulation OFF"}
            </span>
          </div>
          <button onClick={() => window.location.reload()} style={{
            background: "none", border: `1px solid ${C.mutedL}`, borderRadius: 8,
            padding: "6px 14px", color: C.muted, cursor: "pointer", fontSize: 12,
          }}>🔄 Actualiser</button>
        </div>
      </div>

      {/* Bandeau mes alertes */}
      {myAlerts.length > 0 && (
        <div onClick={() => navigate("alerts")} style={{
          background: `${C.warning}18`, border: `1px solid ${C.warning}44`,
          borderRadius: 10, padding: "12px 18px", marginBottom: 20,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <span style={{ fontWeight: 700, color: C.warning, fontSize: 14 }}>
            {myAlerts.length} détection{myAlerts.length > 1 ? "s" : ""} assignée{myAlerts.length > 1 ? "s" : ""} à vous
          </span>
          <span style={{ marginLeft: "auto", color: C.warning, fontSize: 12 }}>Voir →</span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <Stat value={detectionsToday} label="Détections aujourd'hui" color={C.sky} icon="🎯" sub="Depuis minuit" />
        <Stat value={fraudsBlocked} label="Fraudes bloquées" color={C.danger} icon="🚫"
          sub={safeAlerts.length ? `${Math.round(fraudsBlocked/safeAlerts.length*100)}% taux` : "—"} />
        <Stat value={activeRules} label="Règles actives" color={C.warning} icon="⚙" />
        <Stat value={openCases} label="Cases ouverts" color={C.purple} icon="📁" />
        <Stat value={`${(fraudsBlocked * 4200 / 1000000).toFixed(1)}M XOF`} label="Économies est." color={C.success} icon="💰" />
      </div>

      {/* Tendance + Pie */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <Card style={{ flex: 2, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14 }}>Tendance — 7 jours</div>
          {safeAlerts.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, padding: "30px 0", fontSize: 13 }}>
              Aucune détection — en attente de CDR
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.sky} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.sky} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="v" stroke={C.sky} strokeWidth={2.5} fill="url(#g1)" name="Détections" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card style={{ flex: 1, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Par type</div>
          {pieData.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, padding: "30px 0", fontSize: 13 }}>—</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {pieData.map(d => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                    <span style={{ fontSize: 10, color: C.textL }}>{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Bar chart */}
      <Card style={{ padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14 }}>Fraudes par type — 7 jours</div>
        {safeAlerts.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: "20px 0", fontSize: 13 }}>En attente de CDR</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} barSize={12}>
              <XAxis dataKey="d" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="simbox" name="SIM Box" stackId="a" fill={C.danger} />
              <Bar dataKey="irsf" name="IRSF" stackId="a" fill={C.warning} />
              <Bar dataKey="wangiri" name="Wangiri" stackId="a" fill={C.sky} />
              <Bar dataKey="mm" name="Mobile Money" stackId="a" fill={C.teal} />
              <Bar dataKey="other" name="Autres" stackId="a" fill={C.mutedL} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Anomalies antennes */}
      <Card style={{ padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>📡 Anomalies antennes</div>
          <button onClick={() => navigate("cells")} style={{ background: "none", border: "none", color: C.sky, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            Voir toutes →
          </button>
        </div>
        {cellAnomalies.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 12 }}>Aucune anomalie détectée</div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            {cellAnomalies.map(c => (
              <div key={c.id} onClick={() => navigate("cells")} style={{
                flex: 1, background: c.status === "critical" ? C.dangerL : C.warningL,
                border: `1px solid ${c.status === "critical" ? C.danger : C.warning}33`,
                borderRadius: 8, padding: "10px 14px", cursor: "pointer",
              }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: c.status === "critical" ? C.danger : C.warning }}>
                  {c.delta}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginTop: 2 }}>{c.name}</div>
                <div style={{ fontSize: 10, color: C.textL }}>{c.sims} SIMs suspectes</div>
                {c.fraudType && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{c.fraudType}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Alertes récentes — MÊME SOURCE que Détections */}
      <Card style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
            Alertes récentes
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>
              (même source que Détections)
            </span>
          </div>
          <button onClick={() => navigate("alerts")} style={{ background: "none", border: "none", color: C.sky, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            Voir toutes →
          </button>
        </div>
        {recentAlerts.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: 20 }}>
            Aucune détection — en attente de CDR depuis le serveur
          </div>
        ) : (
          recentAlerts.map(a => (
            <div key={a.id}
              onClick={() => setSimProfile({ msisdn: a.msisdn, score: a.score, fraudType: a.type })}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 0", borderBottom: `1px solid ${C.mutedL}`,
                cursor: "pointer",
              }}
              onMouseOver={e => e.currentTarget.style.background = C.bg}
              onMouseOut={e => e.currentTarget.style.background = "none"}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: sevColor(a.severity), flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: C.muted, width: 42 }}>{formatTime(a.createdAt || a.detected_at)}</div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{fraudCatIcon(a.type)} {a.type}</span>
                <span style={{ fontSize: 11, color: C.textL }}> · {a.operator}</span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: C.navy }}>{a.msisdn}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: a.score >= 80 ? C.danger : C.warning }}>
                Score {a.score}
              </div>
              <Badge label={statusLabel(a.status)} color={statusColor(a.status)} small />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}