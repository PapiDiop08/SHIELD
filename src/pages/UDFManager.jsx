// ── SHIELD UDF Manager — FULL LINK ───────────────────────────────────────────
// Données depuis udf_fields Supabase — plus de UDF_FIELDS mock

import { useState, useMemo, useEffect, useCallback } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SectionHeader, SearchInput, Select, Modal } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../supabase.js";

const TYPE_COLORS = { number: C.sky, text: C.purple, boolean: C.teal, datetime: C.warning };

// Mapping cat Supabase → label lisible
const CAT_LABELS = {
  voice: "Voice — Agrégats", sms: "SMS — Agrégats", data: "Data — Agrégats",
  mm: "Mobile Money", computed: "Scores calculés", roaming: "Roaming", sim: "SIM — Profil",
};
const CAT_COLORS = {
  voice: C.sky, sms: C.teal, data: C.success,
  mm: C.warning, computed: C.purple, roaming: C.navy, sim: C.danger,
};

// ── Hook : udf_fields depuis Supabase ────────────────────────────────────
function useUDFFields() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("udf_fields")
        .select("*")
        .order("cat").order("label");
      if (error) throw error;
      // Normaliser vers le format attendu par le composant
      setFields((data || []).map(f => ({
        id: f.id,
        key: f.key,
        label: f.label,
        cat: CAT_LABELS[f.cat] || f.cat,
        catRaw: f.cat,
        type: "number", // udf_fields stocke unit, pas type — on déduit
        unit: f.unit || "",
        cdrField: f.source || "",
        description: f.description || "",
        enabled: f.enabled !== false,
        agg: ["count", "sum", "avg", "max", "min"].some(a => (f.key || "").includes(a) || (f.description || "").toLowerCase().includes("agrégat")),
      })));
    } catch (err) {
      console.error("useUDFFields error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createField = useCallback(async (fieldData) => {
    const { data, error } = await supabase.from("udf_fields").insert([{
      key: fieldData.key,
      label: fieldData.label,
      cat: fieldData.catRaw || "voice",
      unit: fieldData.unit || null,
      description: fieldData.description || null,
      source: fieldData.cdrField || fieldData.catRaw || "voice",
      enabled: true,
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const updateField = useCallback(async (id, fieldData) => {
    const { error } = await supabase.from("udf_fields").update({
      label: fieldData.label,
      unit: fieldData.unit || null,
      description: fieldData.description || null,
      source: fieldData.cdrField || null,
    }).eq("id", id);
    if (!error) await fetch();
    return { error };
  }, [fetch]);

  const toggleField = useCallback(async (id, enabled) => {
    await supabase.from("udf_fields").update({ enabled }).eq("id", id);
    setFields(p => p.map(f => f.id === id ? { ...f, enabled } : f));
  }, []);

  const deleteField = useCallback(async (id) => {
    await supabase.from("udf_fields").delete().eq("id", id);
    setFields(p => p.filter(f => f.id !== id));
  }, []);

  return { fields, loading, refetch: fetch, createField, updateField, toggleField, deleteField };
}

const EMPTY_FIELD = { key: "", label: "", catRaw: "voice", type: "number", agg: false, unit: "", cdrField: "", description: "" };

export default function UDFManager({ addLog }) {
  const { currentUser, can } = useAuth();
  const { fields, loading, refetch, createField, updateField, toggleField, deleteField } = useUDFFields();

  const [search, setSearch]         = useState("");
  const [filterCat, setFilterCat]   = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showAdd, setShowAdd]       = useState(false);
  const [editField, setEditField]   = useState(null);
  const [newField, setNewField]     = useState(EMPTY_FIELD);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null);

  function showToast(msg, c = C.success) {
    setToast({ msg, c });
    setTimeout(() => setToast(null), 3000);
  }

  const cats = ["all", ...new Set(fields.map(f => f.cat))];

  const filtered = useMemo(() => {
    let list = [...fields];
    if (search) list = list.filter(f =>
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.key.toLowerCase().includes(search.toLowerCase()) ||
      f.cat.toLowerCase().includes(search.toLowerCase())
    );
    if (filterCat !== "all") list = list.filter(f => f.cat === filterCat);
    if (filterType !== "all") list = list.filter(f => f.type === filterType);
    return list;
  }, [fields, search, filterCat, filterType]);

  async function saveField() {
    if (!newField.key || !newField.label) return;
    if (currentUser?.role !== "superadmin") {
      showToast("Seul le Super Admin peut modifier les champs CDR", C.danger);
      return;
    }
    setSaving(true);
    try {
      if (editField) {
        const { error } = await updateField(editField.id, newField);
        if (error) throw error;
        addLog?.("EDIT_UDF", "udf", newField.key, `Modification champ UDF: ${newField.label}`, "UDF Manager");
        showToast("Champ modifié avec succès");
      } else {
        const { error } = await createField(newField);
        if (error) {
          if (error.code === "23505") showToast("Cette clé existe déjà", C.danger);
          else throw error;
          return;
        }
        addLog?.("ADD_UDF", "udf", newField.key, `Ajout champ UDF: ${newField.label}`, "UDF Manager");
        showToast("Champ ajouté avec succès");
      }
      setShowAdd(false);
      setEditField(null);
      setNewField(EMPTY_FIELD);
    } catch (err) {
      showToast(`Erreur: ${err.message}`, C.danger);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(f) {
    if (currentUser?.role !== "superadmin") {
      showToast("Seul le Super Admin peut modifier les champs CDR", C.danger);
      return;
    }
    setEditField(f);
    setNewField({ key: f.key, label: f.label, catRaw: f.catRaw || "voice", type: f.type, agg: f.agg || false, unit: f.unit || "", cdrField: f.cdrField || "", description: f.description || "" });
    setShowAdd(true);
  }

  async function handleDelete(f) {
    if (currentUser?.role !== "superadmin") { showToast("Seul le Super Admin peut supprimer", C.danger); return; }
    if (!window.confirm(`Supprimer le champ "${f.label}" ?`)) return;
    await deleteField(f.id);
    addLog?.("DELETE_UDF", "udf", f.key, `Suppression champ UDF: ${f.label}`, "UDF Manager");
    showToast("Champ supprimé");
  }

  const catCounts = fields.reduce((acc, f) => { if (!acc[f.cat]) acc[f.cat] = 0; acc[f.cat]++; return acc; }, {});

  return (
    <div style={{ padding: "24px 20px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, background: toast.c, color: C.white, borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 13, zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}

      <SectionHeader
        title="Champs CDR — UDF"
        sub={loading ? "Chargement depuis Supabase…" : `${fields.length} champs définis · Supabase · Modification : Super Admin uniquement`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={refetch} style={{ background: "none", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "6px 14px", color: C.muted, cursor: "pointer", fontSize: 12 }}>🔄</button>
            <Btn onClick={() => { setEditField(null); setNewField(EMPTY_FIELD); setShowAdd(true); }}>+ Ajouter un champ</Btn>
          </div>
        }
      />

      {/* Info banner */}
      <div style={{ background: C.skyL, border: `1px solid ${C.sky}33`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: C.navy }}>
        <strong>UDF (User Defined Fields)</strong> — Champs CDR utilisés dans les règles de détection. Persistés dans Supabase. Chaque champ correspond à une colonne CDR ou à une valeur calculée.
      </div>

      {/* Stats par catégorie */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {Object.entries(catCounts).slice(0, 6).map(([cat, count]) => (
          <div key={cat}
            onClick={() => setFilterCat(filterCat === cat ? "all" : cat)}
            style={{
              background: filterCat === cat ? C.navy : C.white,
              border: `1px solid ${filterCat === cat ? C.navy : C.mutedL}`,
              borderRadius: 8, padding: "8px 12px", cursor: "pointer", textAlign: "center", minWidth: 80,
            }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: filterCat === cat ? C.white : C.sky }}>{count}</div>
            <div style={{ fontSize: 9, color: filterCat === cat ? C.muted : C.textL, marginTop: 2 }}>{cat.split(" — ")[0]}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un champ..." />
        <Select value={filterCat} onChange={setFilterCat}
          options={[{ value: "all", label: "Toutes catégories" }, ...cats.filter(c => c !== "all").map(c => ({ value: c, label: c }))]} />
        <Select value={filterType} onChange={setFilterType}
          options={[{ value: "all", label: "Tous types" }, { value: "number", label: "Numérique" }, { value: "text", label: "Texte" }, { value: "boolean", label: "Booléen" }]} />
        {(search || filterCat !== "all" || filterType !== "all") && (
          <button onClick={() => { setSearch(""); setFilterCat("all"); setFilterType("all"); }}
            style={{ background: "none", border: "none", color: C.danger, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>✕</button>
        )}
      </div>

      <div style={{ fontSize: 12, color: C.textL, marginBottom: 8 }}>{filtered.length} champ{filtered.length > 1 ? "s" : ""}</div>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.mutedL}` }}>
                {["Actif", "Clé SHIELD", "Label", "Catégorie", "Source CDR", "Unité", "Description", ""].map(h => (
                  <th key={h} style={{ padding: "9px 12px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ padding: "40px", textAlign: "center", color: C.muted }}>⏳ Chargement depuis Supabase…</td></tr>
              )}
              {!loading && filtered.map((f, idx) => (
                <tr key={f.id}
                  style={{ borderBottom: `1px solid ${C.mutedL}`, background: idx % 2 === 0 ? C.white : "#FAFBFE", opacity: f.enabled ? 1 : 0.5 }}
                  onMouseOver={e => e.currentTarget.style.background = C.bg}
                  onMouseOut={e  => e.currentTarget.style.background = idx % 2 === 0 ? C.white : "#FAFBFE"}
                >
                  <td style={{ padding: "9px 12px" }}>
                    <button
                      onClick={() => toggleField(f.id, !f.enabled)}
                      title={f.enabled ? "Désactiver" : "Activer"}
                      style={{
                        width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer",
                        background: f.enabled ? C.success : C.mutedL,
                        position: "relative", transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 2, left: f.enabled ? 14 : 2,
                        width: 14, height: 14, borderRadius: "50%", background: C.white,
                        transition: "left 0.2s",
                      }} />
                    </button>
                  </td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 11, color: C.navy, fontWeight: 600, whiteSpace: "nowrap" }}>{f.key}</td>
                  <td style={{ padding: "9px 12px", fontSize: 12, color: C.navy, maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</div>
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <Badge label={f.cat.split(" — ")[0]} color={CAT_COLORS[f.catRaw] || C.sky} small />
                  </td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 10, color: C.textL, maxWidth: 120 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.cdrField || "—"}</div>
                  </td>
                  <td style={{ padding: "9px 12px", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{f.unit || "—"}</td>
                  <td style={{ padding: "9px 12px", fontSize: 11, color: C.textL, maxWidth: 220 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.description || "—"}</div>
                  </td>
                  <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {currentUser?.role === "superadmin" && (
                        <>
                          <button onClick={() => openEdit(f)}
                            style={{ background: "none", border: `1px solid ${C.mutedL}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: C.textL }}>✏</button>
                          <button onClick={() => handleDelete(f)}
                            style={{ background: "none", border: `1px solid ${C.mutedL}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: C.danger }}>🗑</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: "40px", textAlign: "center", color: C.muted }}>Aucun champ trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal ajout/édition */}
      {showAdd && (
        <Modal title={editField ? "Modifier le champ" : "Nouveau champ UDF"} onClose={() => { setShowAdd(false); setEditField(null); }} width={520}>
          <div style={{ padding: "18px 20px" }}>
            {editField && (
              <div style={{ background: C.warningL, border: `1px solid ${C.warning}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.warning, fontWeight: 600 }}>
                ⚠ Modification d'un champ existant — Les règles utilisant ce champ seront affectées
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[["Clé SHIELD *", "key", "ex: call_count_out"], ["Label affiché *", "label", "Ex: Appels sortants"], ["Source CDR", "cdrField", "Ex: cdr_voice.msisdn_a"], ["Unité", "unit", "Ex: sec, MB, XOF"]].map(([l, k, p]) => (
                <div key={k}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>{l}</label>
                  <input
                    value={newField[k] || ""}
                    onChange={e => setNewField(f => ({ ...f, [k]: e.target.value }))}
                    placeholder={p}
                    disabled={editField && k === "key"}
                    style={{
                      width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 10px",
                      fontSize: 12, color: editField && k === "key" ? C.muted : C.navy, outline: "none",
                      boxSizing: "border-box", fontFamily: k === "key" || k === "cdrField" ? "monospace" : "inherit",
                      background: editField && k === "key" ? C.bg : C.white,
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>Catégorie</label>
                <select value={newField.catRaw} onChange={e => setNewField(f => ({ ...f, catRaw: e.target.value }))}
                  style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.navy, background: C.white, outline: "none" }}>
                  {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>Agrégat</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ v: true, l: "Oui" }, { v: false, l: "Non" }].map(o => (
                    <button key={String(o.v)} onClick={() => setNewField(f => ({ ...f, agg: o.v }))}
                      style={{ flex: 1, padding: "7px", background: newField.agg === o.v ? `${C.sky}18` : C.bg, border: `2px solid ${newField.agg === o.v ? C.sky : C.mutedL}`, borderRadius: 8, color: newField.agg === o.v ? C.sky : C.textL, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>Description</label>
              <textarea value={newField.description || ""} onChange={e => setNewField(f => ({ ...f, description: e.target.value }))} rows={2}
                style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.navy, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setShowAdd(false); setEditField(null); }} style={{ flex: 1, justifyContent: "center" }}>Annuler</Btn>
              <Btn onClick={saveField} disabled={!newField.key || !newField.label || saving} style={{ flex: 2, justifyContent: "center" }}>
                {saving ? "Sauvegarde…" : editField ? "💾 Sauvegarder" : "Ajouter le champ"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}