// ── SHIELD Rules Page — FULL LINK ────────────────────────────────────────────
// UDF_FIELDS remplacé par hook AAR DB — tout le reste identique

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { C, sevColor, sevLabel, fraudCatIcon, fraudCatColor, FRAUD_CATEGORIES, ALL_FRAUD_TYPES, ACTIONS, ACTION_LABELS, COMPARATORS } from "../theme.js";
import { Card, Badge, Btn, SearchInput, Select, SectionHeader } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../supabase.js";

// ── Hook : udf_fields depuis AAR DB ────────────────────────────────────
function useUDFFields() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("udf_fields").select("*").eq("enabled", true).order("cat").order("label")
      .then(({ data }) => {
        setFields((data || []).map(f => ({
          key: f.key,
          label: f.label,
          cat: ({ voice: "Voice — Agrégats", sms: "SMS — Agrégats", data: "Data — Agrégats", mm: "Mobile Money", computed: "Scores calculés", roaming: "Roaming", sim: "SIM — Profil" }[f.cat] || f.cat),
          unit: f.unit || "",
          description: f.description || "",
        })));
        setLoading(false);
      });
  }, []);

  return { fields, loading };
}

// ── FieldSelector — dropdown champs CDR depuis AAR DB ──────────────────
function FieldSelector({ value, onChange, udfFields }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const cats = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = udfFields.filter(f =>
      f.label.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    );
    const grouped = {};
    filtered.forEach(f => { if (!grouped[f.cat]) grouped[f.cat] = []; grouped[f.cat].push(f); });
    return grouped;
  }, [search, udfFields]);

  const current = udfFields.find(f => f.key === value);

  return (
    <div ref={ref} style={{ position: "relative", flex: 2 }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: current ? C.navy : C.muted, background: C.white, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current ? current.label : "Choisir un champ CDR..."}</span>
        <span style={{ color: C.muted, flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 999, maxHeight: 320, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.mutedL}` }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un champ..."
              style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, color: C.navy, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {Object.entries(cats).map(([cat, fields]) => (
              <div key={cat}>
                <div style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", background: C.bg, position: "sticky", top: 0 }}>{cat}</div>
                {fields.map(f => (
                  <div key={f.key} onClick={() => { onChange(f.key); setOpen(false); setSearch(""); }}
                    style={{ padding: "8px 12px", fontSize: 12, color: f.key === value ? C.danger : C.navy, fontWeight: f.key === value ? 700 : 400, cursor: "pointer", background: f.key === value ? C.dangerL : C.white, display: "flex", justifyContent: "space-between" }}
                    onMouseOver={e => e.currentTarget.style.background = f.key === value ? C.dangerL : C.bg}
                    onMouseOut={e => e.currentTarget.style.background = f.key === value ? C.dangerL : C.white}>
                    <span>{f.label}</span>
                    <span style={{ fontSize: 10, color: C.muted }}>{f.unit}</span>
                  </div>
                ))}
              </div>
            ))}
            {Object.keys(cats).length === 0 && <div style={{ padding: "20px", textAlign: "center", color: C.muted, fontSize: 12 }}>Aucun champ trouvé</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function FraudTypeDropdown({ value, onChange, rules }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = {};
    Object.entries(FRAUD_CATEGORIES).forEach(([cat, def]) => {
      const types = def.types.filter(t => t.toLowerCase().includes(q) || cat.toLowerCase().includes(q));
      if (types.length > 0) result[cat] = { ...def, types };
    });
    return result;
  }, [search]);
  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 16 }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 10, background: value ? fraudCatColor(value) + "18" : C.white, border: `1px solid ${value ? fraudCatColor(value) : C.mutedL}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: value ? 700 : 400, color: value ? fraudCatColor(value) : C.textL }}>
        <span>Rch {value ? `${fraudCatIcon(value)} ${value}` : `Tous les types${rules ? ` (${rules.length})` : ""}`}</span>
        {value && <span onClick={e => { e.stopPropagation(); onChange(null); }} style={{ marginLeft: 4, color: C.muted, fontSize: 14 }}>×</span>}
        <span style={{ marginLeft: "auto", color: C.muted }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 999, width: 320, maxHeight: 360, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.mutedL}` }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, color: C.navy, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ overflowY: "auto" }}>
            <div onClick={() => { onChange(null); setOpen(false); }} style={{ padding: "10px 14px", fontSize: 13, color: !value ? C.danger : C.navy, fontWeight: !value ? 700 : 400, cursor: "pointer", borderBottom: `1px solid ${C.mutedL}`, background: !value ? C.dangerL : C.white }}>Tous les types</div>
            {Object.entries(filtered).map(([cat, def]) => (
              <div key={cat}>
                <div style={{ padding: "8px 14px", fontSize: 10, fontWeight: 800, color: def.color, textTransform: "uppercase", background: C.bg }}>{def.icon} {cat}</div>
                {def.types.map(t => (
                  <div key={t} onClick={() => { onChange(t); setOpen(false); setSearch(""); }}
                    style={{ padding: "9px 14px 9px 26px", fontSize: 13, cursor: "pointer", display: "flex", justifyContent: "space-between", background: value === t ? def.color + "18" : C.white, color: value === t ? def.color : C.navy, fontWeight: value === t ? 700 : 400, borderBottom: `1px solid ${C.mutedL}` }}
                    onMouseOver={e => e.currentTarget.style.background = value === t ? def.color + "18" : C.bg}
                    onMouseOut={e => e.currentTarget.style.background = value === t ? def.color + "18" : C.white}>
                    <span>{t}</span>
                    {rules && <span style={{ fontSize: 11, color: C.muted }}>{(rules||[]).filter(r => r.type === t).length}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ListDropdown({ value, onChange }) {
  const LISTS = [
    { key: "blacklist_msisdn", label: "[X] Blacklist — MSISDN" },
    { key: "whitelist_msisdn", label: "OK Whitelist — MSISDN" },
    { key: "watchlist_msisdn", label: "WATCH Watchlist — MSISDN" },
    { key: "blacklist_imei", label: "[X] Blacklist — IMEI/Préfixes" },
    { key: "blacklist_cell", label: "[X] Blacklist — Cell ID" },
    { key: "blacklist_country", label: "[X] Blacklist — Pays" },
    { key: "risk_countries", label: "Pays à risque (prédéfini)" },
    { key: "premium_prefixes", label: "FIN Préfixes surtaxés" },
    { key: "known_simbox_imei", label: "MOB IMEI SIM Box connus" },
  ];
  return (
    <select value={value || ""} onChange={e => onChange(e.target.value)}
      style={{ flex: 1, border: `1px solid ${value ? C.sky : C.mutedL}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: value ? C.sky : C.muted, background: value ? C.skyL : C.white, outline: "none" }}>
      <option value="">Choisir une liste...</option>
      {LISTS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
    </select>
  );
}

// ── RuleForm — reçoit udfFields en prop ──────────────────────────────────
function RuleForm({ initial, onSave, onCancel, cases, udfFields }) {
  const [form, setForm] = useState(initial || { name: "", type: ALL_FRAUD_TYPES[0], severity: "high", action: "block", scope: "telco", caseId: null, conditions: [] });
  function addCond() { setForm(f => ({ ...f, conditions: [...f.conditions, { field: "call_out_count", comparator: ">", value: "", logic: "ET" }] })); }
  function updCond(i, k, v) { setForm(f => { const c = [...f.conditions]; c[i] = { ...c[i], [k]: v }; return { ...f, conditions: c }; }); }
  function delCond(i) { setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) })); }

  return (
    <div style={{ padding: "0 24px 24px" }}>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Nom</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: SIM Box — Haute vélocité"
          style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, color: C.navy, outline: "none", boxSizing: "border-box" }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Type de fraude</label>
        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.navy, background: C.white, outline: "none" }}>
          {Object.entries(FRAUD_CATEGORIES).map(([cat, def]) => (
            <optgroup key={cat} label={`${def.icon} ${cat}`}>{def.types.map(t => <option key={t} value={t}>{t}</option>)}</optgroup>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Sévérité</label>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ k: "critical", l: "Critique", c: C.danger }, { k: "high", l: "Élevé", c: C.warning }, { k: "medium", l: "Moyen", c: C.sky }].map(s => (
              <button key={s.k} onClick={() => setForm(f => ({ ...f, severity: s.k }))}
                style={{ flex: 1, padding: "7px", background: form.severity === s.k ? `${s.c}18` : C.bg, border: `2px solid ${form.severity === s.k ? s.c : C.mutedL}`, borderRadius: 8, color: form.severity === s.k ? s.c : C.textL, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                {s.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Action</label>
          <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
            style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.navy, background: C.white, outline: "none" }}>
            {ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
          </select>
        </div>
      </div>
      {cases && cases.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Associer à un case (optionnel)</label>
          <select value={form.caseId || ""} onChange={e => setForm(f => ({ ...f, caseId: e.target.value || null }))}
            style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.navy, background: C.white, outline: "none" }}>
            <option value="">Aucun case</option>
            {(cases||[]).filter(c => c.status !== "closed").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>Conditions ({form.conditions.length})</label>
          <Btn variant="secondary" small onClick={addCond}>+ Condition</Btn>
        </div>
        {form.conditions.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px", color: C.muted, border: `2px dashed ${C.mutedL}`, borderRadius: 10, fontSize: 13 }}>
            Ajoutez des conditions — {udfFields.length} champs CDR disponibles 
          </div>
        )}
        {form.conditions.map((cond, i) => (
          <div key={i} style={{ background: C.bg, borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${C.mutedL}` }}>
            {i > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {["ET", "OU", "SAUF"].map(op => (
                  <button key={op} onClick={() => updCond(i, "logic", op)}
                    style={{ padding: "3px 12px", background: cond.logic === op ? C.navy : C.white, border: `1px solid ${cond.logic === op ? C.navy : C.mutedL}`, borderRadius: 6, color: cond.logic === op ? C.white : C.textL, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    {op}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <FieldSelector value={cond.field} onChange={v => updCond(i, "field", v)} udfFields={udfFields} />
              <select value={cond.comparator} onChange={e => updCond(i, "comparator", e.target.value)}
                style={{ flex: 1, border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.navy, background: C.white, outline: "none" }}>
                {COMPARATORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {cond.comparator === "est dans la liste"
                ? <ListDropdown value={cond.value} onChange={v => updCond(i, "value", v)} />
                : <input value={cond.value} onChange={e => updCond(i, "value", e.target.value)} placeholder="Valeur..."
                    style={{ flex: 1, border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.navy, outline: "none" }} />
              }
              <button onClick={() => delCond(i)} style={{ background: C.dangerL, border: "none", color: C.danger, borderRadius: 6, padding: "8px 10px", cursor: "pointer", fontSize: 14 }}>Del</button>
            </div>
            {cond.field && (
              <div style={{ marginTop: 6, fontSize: 10, color: C.muted }}>
                {udfFields.find(f => f.key === cond.field)?.label} · Unité : {udfFields.find(f => f.key === cond.field)?.unit || "—"}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="ghost" onClick={onCancel} style={{ flex: 1, justifyContent: "center" }}>Annuler</Btn>
        <Btn onClick={() => onSave(form)} disabled={!form.name} style={{ flex: 2, justifyContent: "center" }}>
          {initial ? "Sauvegarder" : "Déployer la règle"}
        </Btn>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────
export default function Rules({ rules, setRules, cases, addLog, createRule, updateRule, toggleRule }) {
  const { can, currentUser } = useAuth();
  const { fields: udfFields, loading: udfLoading } = useUDFFields();

  const [view, setView]               = useState("list");
  const [search, setSearch]           = useState("");
  const [filterType, setFilterType]   = useState(null);
  const [filterSev, setFilterSev]     = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [sortBy, setSortBy]           = useState("triggered");
  const [showBuilder, setShowBuilder] = useState(false);
  const [editRule, setEditRule]       = useState(null);

  const filtered = useMemo(() => {
    let list = [...rules];
    if (search) list = list.filter(r => r.name?.toLowerCase().includes(search.toLowerCase()) || r.type?.toLowerCase().includes(search.toLowerCase()));
    if (filterType) list = list.filter(r => r.type === filterType);
    if (filterSev !== "all") list = list.filter(r => r.severity === filterSev);
    if (filterActive === "active") list = list.filter(r => r.active);
    if (filterActive === "inactive") list = list.filter(r => !r.active);
    if (filterAction !== "all") list = list.filter(r => r.action === filterAction);
    list.sort((a, b) => sortBy === "triggered" ? (b.triggered||0) - (a.triggered||0) : sortBy === "name" ? (a.name||"").localeCompare(b.name||"") : (b.date||"").localeCompare(a.date||""));
    return list;
  }, [rules, search, filterType, filterSev, filterActive, filterAction, sortBy]);

  async function saveRule(form) {
    if (editRule) {
      if (updateRule) { await updateRule(editRule.id, form); }
      else { setRules(p => p.map(r => r.id === editRule.id ? { ...r, ...form } : r)); }
      addLog("EDIT_RULE", "rule", editRule.id, `Modification '${form.name}'`, "Règles");
      setEditRule(null);
    } else {
      if (createRule) {
        const { data, error } = await createRule({ ...form, scope: form.scope || 'telco' });
        if (error) { alert("Erreur création règle : " + error.message); return; }
        if (!error) { addLog("CREATE_RULE", "rule", data?.[0]?.id, `Création '${form.name}'`, "Règles"); setShowBuilder(false); }
      } else {
        const r = { id: Date.now(), ...form, triggered: 0, blocked: 0, date: new Date().toISOString().slice(0, 10), active: true };
        setRules(p => [r, ...p]);
        addLog("CREATE_RULE", "rule", r.id, `Création '${form.name}'`, "Règles");
        setShowBuilder(false);
      }
    }
  }

  const totalTriggered = (rules || []).reduce((a, r) => a + r.triggered, 0);
  const totalBlocked   = (rules || []).reduce((a, r) => a + r.blocked, 0);

  // ── Vue Builder ──────────────────────────────────────────────────────
  if (showBuilder) return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <Btn variant="ghost" onClick={() => setShowBuilder(false)}>← Retour</Btn>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: C.navy }}>Nouvelle règle de détection</h1>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ flex: 2 }}>
          <Card style={{ padding: "24px" }}>
            <RuleForm onSave={saveRule} onCancel={() => setShowBuilder(false)} cases={cases} udfFields={udfFields} />
          </Card>
        </div>
        <div style={{ flex: 1 }}>
          <Card style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
              Champs disponibles {udfLoading ? "(chargement…)" : ``}
            </div>
            {Object.entries(udfFields.reduce((acc, f) => { if (!acc[f.cat]) acc[f.cat] = 0; acc[f.cat]++; return acc; }, {})).map(([cat, count]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.mutedL}` }}>
                <span style={{ fontSize: 12, color: C.textL }}>{cat}</span>
                <Badge label={`${count}`} color={C.sky} small />
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
              Total : <strong style={{ color: C.navy }}>{udfFields.length} champs</strong>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  // ── Vue Edit ─────────────────────────────────────────────────────────
  if (editRule) return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <Btn variant="ghost" onClick={() => setEditRule(null)}>← Retour</Btn>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: C.navy, flex: 1 }}>Modifier — {editRule.name}</h1>
        <div style={{ display: "flex", gap: 12, fontSize: 13, color: C.textL }}>
          <span>[*] {editRule.triggered} déclenchements</span>
          <span>[X] {editRule.blocked} bloqués</span>
        </div>
      </div>
      <Card style={{ padding: "24px" }}>
        <RuleForm initial={editRule} onSave={saveRule} onCancel={() => setEditRule(null)} cases={cases} udfFields={udfFields} />
      </Card>
    </div>
  );

  // ── Vue liste ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader
        title="Règles de détection"
        sub={`${(rules||[]).filter(r => r.active).length} actives · ${rules.length} total · ${udfLoading ? "…" : udfFields.length} champs CDR `}
        action={can("createRules") && <Btn onClick={() => setShowBuilder(true)}>+ Créer une règle</Btn>}
      />

      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        {[
          ["Règles totales", rules.length, C.navy],
          ["Actives", (rules||[]).filter(r => r.active).length, C.success],
          ["Déclenchements", totalTriggered.toLocaleString(), C.sky],
          ["Bloqués", totalBlocked.toLocaleString(), C.danger],
          [`${Math.round(totalBlocked / Math.max(totalTriggered, 1) * 100)}%`, "Taux blocage", C.warning],
        ].map(([v, l, c], i) => (
          <Card key={i} style={{ flex: 1, padding: "14px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{v}</div>
            <div style={{ fontSize: 12, color: C.textL }}>{l}</div>
          </Card>
        ))}
      </div>

      <FraudTypeDropdown value={filterType} onChange={setFilterType} rules={rules} />

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une règle..." />
        <Select value={filterSev} onChange={setFilterSev} options={[{ value: "all", label: "Toutes sévérités" }, { value: "critical", label: "Critique" }, { value: "high", label: "Élevé" }, { value: "medium", label: "Moyen" }]} />
        <Select value={filterAction} onChange={setFilterAction} options={[{ value: "all", label: "Toutes actions" }, ...ACTIONS.map(a => ({ value: a, label: ACTION_LABELS[a] }))]} />
        <Select value={filterActive} onChange={setFilterActive} options={[{ value: "all", label: "Tous statuts" }, { value: "active", label: "Actives" }, { value: "inactive", label: "Inactives" }]} />
        <Select value={sortBy} onChange={setSortBy} options={[{ value: "triggered", label: "+ de déclenchements" }, { value: "date", label: "Plus récentes" }, { value: "name", label: "Nom A→Z" }]} />
      </div>

      <div style={{ fontSize: 12, color: C.textL, marginBottom: 12 }}>
        {filtered.length} règle{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(rule => {
          const sc = sevColor(rule.severity);
          const fc = fraudCatColor(rule.type);
          const linkedCase = cases?.find(c => c.id === rule.caseId);
          return (
            <Card key={rule.id}
              onClick={() => can("editRules") && setEditRule(rule)}
              style={{ padding: "14px 20px", borderLeft: `4px solid ${rule.active ? sc : C.mutedL}`, opacity: rule.active ? 1 : 0.6, display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
              <div style={{ fontSize: 18, flexShrink: 0 }}>{fraudCatIcon(rule.type)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{rule.name}</span>
                  <Badge label={sevLabel(rule.severity)} color={sc} small />
                  <Badge label={rule.type} color={fc} small />
                  <Badge label={ACTION_LABELS[rule.action]?.replace(/^[^ ]+ /, "") || rule.action} color={rule.action.includes("block") ? C.danger : C.warning} small />
                  {linkedCase && <Badge label={`Doc ${linkedCase.name.slice(0, 20)}`} color={C.purple} small />}
                </div>
                <div style={{ fontSize: 11, color: C.textL }}>{rule.conditions?.length || 0} conditions · {rule.date}</div>
              </div>
              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 800, color: C.sky }}>{rule.triggered}</div><div style={{ fontSize: 9, color: C.muted }}>déclench.</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 800, color: C.danger }}>{rule.blocked}</div><div style={{ fontSize: 9, color: C.muted }}>bloqués</div></div>
                <Btn variant={rule.active ? "success" : "ghost"} small onClick={e => {
                  e.stopPropagation();
                  if (toggleRule) { toggleRule(rule.id, !rule.active); }
                  else { setRules(p => p.map(r => r.id === rule.id ? { ...r, active: !r.active } : r)); }
                  addLog("TOGGLE_RULE", "rule", rule.id, `Règle ${rule.active ? "désactivée" : "activée"} : ${rule.name}`, "Règles");
                }}>
                  {rule.active ? "Actif" : "Inactif"}
                </Btn>
                {can("editRules") && <span style={{ color: C.sky, fontSize: 12, fontWeight: 600 }}>Modifier →</span>}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>CFG</div>
            <p style={{ margin: 0 }}>Aucune règle ne correspond</p>
          </Card>
        )}
      </div>
    </div>
  );
}