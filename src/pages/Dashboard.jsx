// ── SHIELD Dashboard Page ───────────────────────────────────────────────────
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { C, sevColor, statusColor, statusLabel, fraudCatIcon } from "../theme.js";
import { Card, Stat, Badge } from "../components.jsx";
import { TREND_DATA, WEEKLY_DATA, PIE_DATA, CELL_ANOMALIES } from "../mockData.js";
import { useAuth } from "../AuthContext.jsx";

export default function Dashboard({ alerts, rules, cases, setSimProfile, navigate }) {
  const { currentUser } = useAuth();
  const myAlerts = alerts.filter(a => a.assignedTo === currentUser?.id && a.status !== "cleared");
  const blocked = alerts.filter(a => a.status === "blocked");
  const openCases = cases.filter(c => c.status === "open" || c.status === "investigating");

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.navy }}>Bonjour, {currentUser?.name?.split(" ")[0]} 👋</h1>
        <p style={{ margin: "4px 0 0", color: C.textL, fontSize: 12 }}>Aujourd'hui · <span style={{ color: C.success }}>● Système actif</span></p>
      </div>

      {myAlerts.length > 0 && (
        <div onClick={() => navigate("alerts")} style={{ background: `${C.warning}18`, border: `1px solid ${C.warning}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <span style={{ fontWeight: 700, color: C.warning, fontSize: 14 }}>{myAlerts.length} alerte{myAlerts.length > 1 ? "s" : ""} assignée{myAlerts.length > 1 ? "s" : ""} à vous</span>
          <span style={{ marginLeft: "auto", color: C.warning, fontSize: 12 }}>Voir →</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <Stat value={alerts.length} label="Détections aujourd'hui" color={C.sky} sub="↑ +12% vs hier" icon="🎯" />
        <Stat value={blocked.length} label="Fraudes bloquées" color={C.danger} sub={`${Math.round(blocked.length / Math.max(alerts.length, 1) * 100)}% taux`} icon="🚫" />
        <Stat value={rules.filter(r => r.active).length} label="Règles actives" color={C.warning} icon="⚙" />
        <Stat value={openCases.length} label="Cases ouverts" color={C.purple} icon="📁" />
        <Stat value="142M XOF" label="Économies ce mois" color={C.success} icon="💰" />
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <Card style={{ flex: 2, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14 }}>Tendance — 7 jours</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={TREND_DATA}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.sky} stopOpacity={0.15} /><stop offset="95%" stopColor={C.sky} stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="d" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="v" stroke={C.sky} strokeWidth={2.5} fill="url(#g1)" dot={{ fill: C.sky, r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card style={{ flex: 1, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Par type</div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart><Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>{PIE_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 8, fontSize: 12 }} /></PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {PIE_DATA.map(d => <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} /><span style={{ fontSize: 10, color: C.textL }}>{d.name}</span></div>)}
          </div>
        </Card>
      </div>

      <Card style={{ padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14 }}>Fraudes par type — 7 jours</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={WEEKLY_DATA} barSize={14}>
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
      </Card>

      <Card style={{ padding: "16px 20px", marginBottom: 20, borderLeft: `4px solid ${C.teal}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>💸 Mobile Money — Aujourd'hui</div>
        <div style={{ display: "flex", gap: 14 }}>
          {[{ l: "Tx bloquées", v: 67, c: C.danger }, { l: "ATO détectés", v: 12, c: C.warning }, { l: "Dépassements", v: 34, c: C.teal }, { l: "Montant protégé", v: "89M XOF", c: C.success }].map(s => (
            <div key={s.l} style={{ flex: 1, background: C.bg, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: C.textL, marginTop: 3 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>📡 Anomalies antennes</div>
          <button onClick={() => navigate("cells")} style={{ background: "none", border: "none", color: C.sky, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Voir toutes →</button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {CELL_ANOMALIES.map(c => (
            <div key={c.id} onClick={() => navigate("cells")} style={{ flex: 1, background: c.status === "critical" ? C.dangerL : C.warningL, border: `1px solid ${c.status === "critical" ? C.danger : C.warning}33`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: c.status === "critical" ? C.danger : C.warning }}>{c.delta}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginTop: 2 }}>{c.name}</div>
              <div style={{ fontSize: 10, color: C.textL }}>{c.sims.length} SIMs suspectes</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Alertes récentes</div>
          <button onClick={() => navigate("alerts")} style={{ background: "none", border: "none", color: C.sky, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Voir toutes →</button>
        </div>
        {alerts.slice(0, 6).map(a => (
          <div key={a.id} onClick={() => setSimProfile({ msisdn: a.msisdn, score: a.score, fraudType: a.type })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.mutedL}`, cursor: "pointer" }}
            onMouseOver={e => e.currentTarget.style.background = C.bg} onMouseOut={e => e.currentTarget.style.background = "none"}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: sevColor(a.severity), flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: C.muted, width: 40 }}>{a.time}</div>
            <div style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{fraudCatIcon(a.type)} {a.type}</span><span style={{ fontSize: 11, color: C.textL }}> · {a.operator}</span></div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.navy }}>{a.msisdn}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: a.score >= 80 ? C.danger : C.warning }}>Score {a.score}</div>
            <Badge label={statusLabel(a.status)} color={statusColor(a.status)} small />
          </div>
        ))}
      </Card>
    </div>
  );
}