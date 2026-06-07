import { useState, useMemo } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SectionHeader, SearchInput, Select, Modal } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

const TYPE_COLORS = { number:C.sky, text:C.purple, boolean:C.teal, datetime:C.warning };

export default function UDFManager({ udfFields, setUdfFields, addLog }) {
  const { currentUser, can } = useAuth();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editField, setEditField] = useState(null);
  const [newField, setNewField] = useState({ key:"",label:"",cat:"Voice — Agrégats",type:"number",agg:false,unit:"",cdrField:"" });
  const [toast, setToast] = useState(null);

  function showToast(msg,c=C.success){ setToast({msg,c}); setTimeout(()=>setToast(null),3000); }

  const cats = ["all",...new Set(udfFields.map(f=>f.cat))];

  const filtered = useMemo(()=>{
    let list = [...udfFields];
    if (search) list = list.filter(f=>f.label.toLowerCase().includes(search.toLowerCase())||f.key.toLowerCase().includes(search.toLowerCase())||f.cat.toLowerCase().includes(search.toLowerCase()));
    if (filterCat!=="all") list = list.filter(f=>f.cat===filterCat);
    if (filterType!=="all") list = list.filter(f=>f.type===filterType);
    return list;
  },[udfFields,search,filterCat,filterType]);

  function saveField() {
    const f = editField ? { ...editField,...newField } : { ...newField,id:Date.now() };
    if (editField) {
      if (currentUser?.role !== "superadmin") { showToast("Seul le Super Admin peut modifier les champs CDR", C.danger); return; }
      setUdfFields(p=>p.map(x=>x.key===editField.key?f:x));
      addLog?.("EDIT_UDF","udf",f.key,`Modification champ UDF: ${f.label}`,"UDF Manager");
    } else {
      setUdfFields(p=>[...p,f]);
      addLog?.("ADD_UDF","udf",f.key,`Ajout champ UDF: ${f.label}`,"UDF Manager");
    }
    setShowAdd(false); setEditField(null);
    setNewField({key:"",label:"",cat:"Voice — Agrégats",type:"number",agg:false,unit:"",cdrField:""});
    showToast(editField?"Champ modifié":"Champ ajouté");
  }

  function openEdit(f) {
    if (currentUser?.role !== "superadmin") { showToast("Seul le Super Admin peut modifier les champs CDR", C.danger); return; }
    setEditField(f);
    setNewField({key:f.key,label:f.label,cat:f.cat,type:f.type,agg:f.agg||false,unit:f.unit||"",cdrField:f.cdrField||""});
    setShowAdd(true);
  }

  const catCounts = udfFields.reduce((acc,f)=>{ if(!acc[f.cat]) acc[f.cat]=0; acc[f.cat]++; return acc; },{});

  return (
    <div style={{padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {toast&&<div style={{position:"fixed",top:20,right:20,background:toast.c,color:C.white,borderRadius:10,padding:"12px 20px",fontWeight:700,fontSize:13,zIndex:9999}}>{toast.msg}</div>}

      <SectionHeader title="Champs CDR — UDF" sub={`${udfFields.length} champs définis · Modification : Super Admin uniquement`}
        action={<Btn onClick={()=>{setEditField(null);setNewField({key:"",label:"",cat:"Voice — Agrégats",type:"number",agg:false,unit:"",cdrField:""});setShowAdd(true);}}>+ Ajouter un champ</Btn>} />

      <div style={{background:C.skyL,border:`1px solid ${C.sky}33`,borderRadius:10,padding:"10px 16px",marginBottom:16,fontSize:12,color:C.navy}}>
        <strong>UDF (User Defined Fields)</strong> — Champs CDR utilisés dans les règles de détection. Chaque opérateur peut avoir des noms de colonnes différents. Ce mapping permet de faire correspondre les champs SHIELD aux champs réels de l'opérateur.
      </div>

      {/* Category quick stats */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {Object.entries(catCounts).slice(0,5).map(([cat,count])=>(
          <div key={cat} onClick={()=>setFilterCat(filterCat===cat?"all":cat)}
            style={{background:filterCat===cat?C.navy:C.white,border:`1px solid ${filterCat===cat?C.navy:C.mutedL}`,borderRadius:8,padding:"8px 12px",cursor:"pointer",textAlign:"center",minWidth:80}}>
            <div style={{fontSize:16,fontWeight:900,color:filterCat===cat?C.white:C.sky}}>{count}</div>
            <div style={{fontSize:9,color:filterCat===cat?C.muted:C.textL,marginTop:2}}>{cat.split(" — ")[0]}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un champ..." />
        <Select value={filterCat} onChange={setFilterCat} options={[{value:"all",label:"Toutes catégories"},...cats.filter(c=>c!=="all").map(c=>({value:c,label:c}))]} />
        <Select value={filterType} onChange={setFilterType} options={[{value:"all",label:"Tous types"},{value:"number",label:"Numérique"},{value:"text",label:"Texte"},{value:"boolean",label:"Booléen"},{value:"datetime",label:"Date"}]} />
        {(search||filterCat!=="all"||filterType!=="all")&&<button onClick={()=>{setSearch("");setFilterCat("all");setFilterType("all");}} style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer",fontWeight:600}}>✕</button>}
      </div>

      <div style={{fontSize:12,color:C.textL,marginBottom:8}}>{filtered.length} champ{filtered.length>1?"s":""}</div>

      <Card style={{overflow:"hidden"}}>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:620}}>
            <thead>
              <tr style={{background:C.bg,borderBottom:`2px solid ${C.mutedL}`}}>
                {["Clé SHIELD","Label","Catégorie","Type","Agrégat","Champ CDR","Unité",""].map(h=>(
                  <th key={h} style={{padding:"9px 12px",fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f,idx)=>(
                <tr key={f.key} style={{borderBottom:`1px solid ${C.mutedL}`,background:idx%2===0?C.white:"#FAFBFE"}}
                  onMouseOver={e=>e.currentTarget.style.background=C.bg} onMouseOut={e=>e.currentTarget.style.background=idx%2===0?C.white:"#FAFBFE"}>
                  <td style={{padding:"9px 12px",fontFamily:"monospace",fontSize:11,color:C.navy,fontWeight:600,whiteSpace:"nowrap"}}>{f.key}</td>
                  <td style={{padding:"9px 12px",fontSize:12,color:C.navy,maxWidth:220}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.label}</div></td>
                  <td style={{padding:"9px 12px"}}><Badge label={f.cat.split(" — ")[0]} color={C.sky} small /></td>
                  <td style={{padding:"9px 12px"}}><Badge label={f.type} color={TYPE_COLORS[f.type]||C.muted} small /></td>
                  <td style={{padding:"9px 12px",fontSize:12,color:f.agg?C.success:C.muted}}>{f.agg?`✓ ${f.aggFunc||""}`.trim():"—"}</td>
                  <td style={{padding:"9px 12px",fontFamily:"monospace",fontSize:10,color:C.textL,maxWidth:140}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.cdrField||"—"}</div></td>
                  <td style={{padding:"9px 12px",fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>{f.unit||"—"}</td>
                  <td style={{padding:"9px 12px"}}>
                    {currentUser?.role==="superadmin"&&<button onClick={()=>openEdit(f)} style={{background:"none",border:`1px solid ${C.mutedL}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:C.textL}}>✏</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      {showAdd && (
        <Modal title={editField?"Modifier le champ":"Nouveau champ UDF"} onClose={()=>{setShowAdd(false);setEditField(null);}} width={520}>
          <div style={{padding:"18px 20px"}}>
            {editField && (
              <div style={{background:C.warningL,border:`1px solid ${C.warning}44`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.warning,fontWeight:600}}>
                ⚠ Modification d'un champ existant — Les règles utilisant ce champ seront affectées
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              {[["Clé SHIELD","key","ex: new_field"],["Label affiché","label","Ex: Nouveau champ"],["Champ CDR opérateur","cdrField","Ex: col_cdr"],["Unité","unit","Ex: sec, MB, XOF"]].map(([l,k,p])=>(
                <div key={k}>
                  <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>{l}</label>
                  <input value={newField[k]||""} onChange={e=>setNewField(f=>({...f,[k]:e.target.value}))} placeholder={p} disabled={editField&&k==="key"}
                    style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:editField&&k==="key"?C.muted:C.navy,outline:"none",boxSizing:"border-box",fontFamily:k==="key"||k==="cdrField"?"monospace":"inherit",background:editField&&k==="key"?C.bg:C.white}} />
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
              <div>
                <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Type</label>
                <select value={newField.type} onChange={e=>setNewField(f=>({...f,type:e.target.value}))} style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:C.navy,background:C.white,outline:"none"}}>
                  {["number","text","boolean","datetime"].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:"block",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Agrégat</label>
                <div style={{display:"flex",gap:6}}>
                  {[{v:true,l:"Oui"},{v:false,l:"Non"}].map(o=>(
                    <button key={String(o.v)} onClick={()=>setNewField(f=>({...f,agg:o.v}))} style={{flex:1,padding:"7px",background:newField.agg===o.v?`${C.sky}18`:C.bg,border:`2px solid ${newField.agg===o.v?C.sky:C.mutedL}`,borderRadius:8,color:newField.agg===o.v?C.sky:C.textL,cursor:"pointer",fontSize:12,fontWeight:700}}>{o.l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" onClick={()=>{setShowAdd(false);setEditField(null);}} style={{flex:1,justifyContent:"center"}}>Annuler</Btn>
              <Btn onClick={saveField} disabled={!newField.key||!newField.label} style={{flex:2,justifyContent:"center"}}>{editField?"💾 Sauvegarder":"Ajouter le champ"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}