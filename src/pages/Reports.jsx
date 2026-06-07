// ── SHIELD Reports Page ───────────────────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from "recharts";
import { C } from "../theme.js";
import { Card, Stat, Btn, SectionHeader } from "../components.jsx";
import { WEEKLY_DATA, PIE_DATA } from "../mockData.js";

export default function Reports({ alerts, rules, blacklist }) {
  const blocked = alerts.filter(a => a.status === "blocked");
  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader title="Rapports" sub="Juin 2026"
        action={<div style={{ display: "flex", gap: 8 }}><Btn variant="secondary">📥 Excel</Btn><Btn>📄 PDF</Btn></div>} />
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <Stat value={alerts.length} label="Détections" color={C.sky} />
        <Stat value={blocked.length} label="Bloquées" color={C.danger} sub={`${Math.round(blocked.length/Math.max(alerts.length,1)*100)}%`} />
        <Stat value="284M XOF" label="Économies estimées" color={C.success} />
        <Stat value={alerts.filter(a=>a.status==="false_positive").length} label="Faux positifs" color={C.warning} />
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <Card style={{ flex: 2, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14 }}>Fraudes par type — 7 jours</div>
          <ResponsiveContainer width="100%" height={200}>
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
        <Card style={{ flex: 1, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Répartition</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart><Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>{PIE_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 8, fontSize: 12 }} /></PieChart>
          </ResponsiveContainer>
          {PIE_DATA.map(d => <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} /><span style={{ fontSize: 12, color: C.textL, flex: 1 }}>{d.name}</span><span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{d.value}%</span></div>)}
        </Card>
      </div>
      <Card style={{ padding: "18px 20px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14 }}>Top fraudes du mois</div>
        {[{ type: "SIM Box", n: 648, p: 38, c: C.danger }, { type: "Mobile Money", n: 534, p: 32, c: C.teal }, { type: "Wangiri", n: 298, p: 18, c: C.sky }, { type: "IRSF", n: 187, p: 11, c: C.warning }, { type: "Autres", n: 4, p: 1, c: C.muted }].map(f => (
          <div key={f.type} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{f.type}</span><span style={{ fontSize: 12, color: C.textL }}>{f.n} détections · {f.p}%</span></div>
            <div style={{ height: 6, background: C.mutedL, borderRadius: 3 }}><div style={{ height: "100%", width: `${f.p}%`, background: f.c, borderRadius: 3 }} /></div>
          </div>
        ))}
      </Card>
    </div>
  );
}