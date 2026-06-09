import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from "recharts";
import { C, fraudCatColor, fraudCatIcon, FRAUD_CATEGORIES, ALL_FRAUD_TYPES } from "../theme.js";
import { Card, Stat, Badge, Btn, Select, SectionHeader, SearchInput } from "../components.jsx";
import { WEEKLY_DATA, PIE_DATA, TREND_DATA } from "../mockData.js";
import { useAuth } from "../AuthContext.jsx";

const PERIODS = [
  { value:"today", label:"Aujourd'hui" },
  { value:"week", label:"7 derniers jours" },
  { value:"month", label:"Ce mois" },
  { value:"quarter", label:"Ce trimestre" },
  { value:"all", label:"Toute période" },
];

const FRAUD_VALUE = {
  "SIM Box":45000, "IRSF":180000, "Wangiri":12000, "Bypass GSM":90000,
  "ATO":250000, "Velocity Fraud":120000, "Dépassement comportemental":85000,
  "Arnaque Marabout":35000, "Phishing opérateur":28000,
};
function getFraudValue(type) { return FRAUD_VALUE[type] || 25000; }

const COLORS = [C.red, C.sky, C.teal, C.warning, C.purple, C.success, C.navy, "#F97316", "#EC4899"];

function inPeriod(dateStr, period) {
  if (period==="all"||!dateStr) return true;
  const d = new Date(dateStr), now = new Date();
  if (period==="today") return d.toDateString()===now.toDateString();
  if (period==="week") return (now-d)<=7*864e5;
  if (period==="month") return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  if (period==="quarter") return Math.floor(d.getMonth()/3)===Math.floor(now.getMonth()/3)&&d.getFullYear()===now.getFullYear();
  return true;
}

export default function Reports({ alerts, rules, blacklist, cases, blockings }) {
  const [period, setPeriod] = useState("month");
  const [selectedType, setSelectedType] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  const filtered = useMemo(() => {
    let list = [...alerts];
    if (selectedType!=="all") list = list.filter(a=>a.type===selectedType);
    list = list.filter(a=>inPeriod(a.createdAt, period));
    return list;
  }, [alerts, selectedType, period]);

  const blocked = filtered.filter(a=>a.status==="blocked");
  const fp = filtered.filter(a=>a.status==="false_positive");
  const totalSaved = blocked.reduce((acc,a)=>acc+getFraudValue(a.type),0);
  const fpRate = filtered.length>0 ? Math.round(fp.length/filtered.length*100) : 0;
  const detRate = filtered.length>0 ? Math.round(blocked.length/filtered.length*100) : 0;

  const byType = useMemo(() => {
    const map = {};
    filtered.forEach(a => {
      if (!map[a.type]) map[a.type]={type:a.type,total:0,blocked:0,fp:0,cleared:0,saved:0};
      map[a.type].total++;
      if (a.status==="blocked"){map[a.type].blocked++;map[a.type].saved+=getFraudValue(a.type);}
      if (a.status==="false_positive") map[a.type].fp++;
      if (a.status==="cleared") map[a.type].cleared++;
    });
    return Object.values(map).sort((a,b)=>b.total-a.total);
  }, [filtered]);

  const byCategory = useMemo(() => {
    return Object.entries(FRAUD_CATEGORIES).map(([cat,def])=>{
      const ca = filtered.filter(a=>def.types.includes(a.type));
      return { cat, icon:def.icon, color:def.color, total:ca.length, blocked:ca.filter(a=>a.status==="blocked").length, saved:ca.filter(a=>a.status==="blocked").reduce((acc,a)=>acc+getFraudValue(a.type),0) };
    }).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);
  }, [filtered]);

  const pieData = byType.slice(0,6).map((t,i)=>({name:t.type,value:t.total,color:COLORS[i]}));

  const trendData = [
    {d:"J-6",detections:42,blocked:38,saved:1240000},
    {d:"J-5",detections:67,blocked:61,saved:1890000},
    {d:"J-4",detections:38,blocked:35,saved:980000},
    {d:"J-3",detections:89,blocked:82,saved:2340000},
    {d:"J-2",detections:54,blocked:49,saved:1560000},
    {d:"J-1",detections:71,blocked:65,saved:1980000},
    {d:"Auj",detections:filtered.length,blocked:blocked.length,saved:totalSaved},
  ];

  const tabs = [
    {k:"overview",l:"Vue globale"},
    {k:"bytype",l:"Par type"},
    {k:"trend",l:"Tendances"},
    {k:"fp",l:"Faux positifs"},
  ];

  return (
    <div style={{padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <SectionHeader title="Rapports & Financial Reporting"
        sub="Statistiques détaillées par type de fraude, tendances et analyse financière"
        action={<Btn variant="ghost">📥 Exporter PDF</Btn>} />

      {/* Filters */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <Select value={period} onChange={setPeriod} options={PERIODS} />
        <Select value={selectedType} onChange={setSelectedType} options={[{value:"all",label:"Tous les types"},...ALL_FRAUD_TYPES.map(t=>({value:t,label:`${fraudCatIcon(t)} ${t}`}))]} />
        {selectedType!=="all"&&<button onClick={()=>setSelectedType("all")} style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer",fontWeight:600}}>✕ Effacer</button>}
      </div>

      {/* KPIs */}
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <Stat value={filtered.length} label="Détections" color={C.sky} icon="🎯" sub={PERIODS.find(p=>p.value===period)?.label} />
        <Stat value={blocked.length} label="Fraudes bloquées" color={C.danger} icon="🚫" sub={`${detRate}% taux`} />
        <Stat value={`${(totalSaved/1000000).toFixed(1)}M XOF`} label="Revenus sauvés (est.)" color={C.success} icon="💰" />
        <Stat value={`${fpRate}%`} label="Taux faux positifs" color={fpRate>10?C.danger:fpRate>5?C.warning:C.success} icon="⚠" />
        <Stat value={rules.filter(r=>r.active).length} label="Règles actives" color={C.warning} icon="⚙" />
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:C.white,border:`1px solid ${C.mutedL}`,borderRadius:12,padding:5}}>
        {tabs.map(t=>(
          <button key={t.k} onClick={()=>setActiveTab(t.k)}
            style={{flex:1,padding:"9px 12px",background:activeTab===t.k?C.navy:"none",border:"none",borderRadius:8,cursor:"pointer",color:activeTab===t.k?C.white:C.textL,fontWeight:700,fontSize:12}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab==="overview"&&(
        <div>
          <div style={{display:"flex",gap:14,marginBottom:16}}>
            <Card style={{flex:1,padding:"18px 20px"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:14}}>Répartition par type</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:C.white,border:`1px solid ${C.mutedL}`,borderRadius:8,fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                {pieData.map(d=><div key={d.name} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:d.color}}/><span style={{fontSize:10,color:C.textL}}>{d.name} ({d.value})</span></div>)}
              </div>
            </Card>

            <Card style={{flex:2,padding:"18px 20px"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:14}}>Revenus sauvés par catégorie</div>
              {byCategory.map(cat=>(
                <div key={cat.cat} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.navy}}>{cat.icon} {cat.cat}</span>
                    <div style={{display:"flex",gap:14}}>
                      <span style={{fontSize:11,color:C.muted}}>{cat.total} détections</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.success}}>{cat.saved.toLocaleString()} XOF</span>
                    </div>
                  </div>
                  <div style={{height:7,background:C.mutedL,borderRadius:4}}>
                    <div style={{height:"100%",width:`${byCategory.length>0?Math.min(cat.total/Math.max(...byCategory.map(c=>c.total))*100,100):0}%`,background:cat.color,borderRadius:4}}/>
                  </div>
                </div>
              ))}
              {byCategory.length===0&&<p style={{color:C.muted,fontSize:13}}>Aucune détection sur la période</p>}
            </Card>
          </div>

          {/* Summary table */}
          <Card style={{overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                <thead>
                  <tr style={{background:C.bg,borderBottom:`2px solid ${C.mutedL}`}}>
                    {["Type de fraude","Détections","Bloquées","FP","Taux blocage","Revenus sauvés (est.)"].map(h=>(
                      <th key={h} style={{padding:"10px 14px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byType.map((t,idx)=>(
                    <tr key={t.type} style={{borderBottom:`1px solid ${C.mutedL}`,background:idx%2===0?C.white:"#FAFBFE"}}
                      onMouseOver={e=>e.currentTarget.style.background=C.bg} onMouseOut={e=>e.currentTarget.style.background=idx%2===0?C.white:"#FAFBFE"}>
                      <td style={{padding:"10px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:fraudCatColor(t.type),flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:600,color:C.navy}}>{fraudCatIcon(t.type)} {t.type}</span>
                        </div>
                      </td>
                      <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:C.sky}}>{t.total}</td>
                      <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:C.danger}}>{t.blocked}</td>
                      <td style={{padding:"10px 14px",fontSize:13,color:t.fp>2?C.warning:C.muted}}>{t.fp}</td>
                      <td style={{padding:"10px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:6,background:C.mutedL,borderRadius:3}}>
                            <div style={{height:"100%",width:`${t.total>0?Math.round(t.blocked/t.total*100):0}%`,background:C.success,borderRadius:3}}/>
                          </div>
                          <span style={{fontSize:11,color:C.textL,width:32}}>{t.total>0?Math.round(t.blocked/t.total*100):0}%</span>
                        </div>
                      </td>
                      <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:C.success}}>{t.saved.toLocaleString()} XOF</td>
                    </tr>
                  ))}
                  {byType.length===0&&<tr><td colSpan={6} style={{padding:"32px",textAlign:"center",color:C.muted}}>Aucune donnée sur la période</td></tr>}
                </tbody>
                {byType.length>0&&(
                  <tfoot>
                    <tr style={{background:C.navyL,borderTop:`2px solid ${C.navy}`}}>
                      <td style={{padding:"10px 14px",fontSize:12,fontWeight:700,color:C.white}}>TOTAL</td>
                      <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:C.sky}}>{filtered.length}</td>
                      <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:C.danger}}>{blocked.length}</td>
                      <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:C.warning}}>{fp.length}</td>
                      <td style={{padding:"10px 14px",fontSize:12,fontWeight:700,color:C.success}}>{detRate}%</td>
                      <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:C.success}}>{totalSaved.toLocaleString()} XOF</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── BY TYPE ── */}
      {activeTab==="bytype"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
          {byType.map(t=>{
            const color=fraudCatColor(t.type);
            const rate=t.total>0?Math.round(t.blocked/t.total*100):0;
            return (
              <Card key={t.type} style={{padding:"16px 18px",borderTop:`3px solid ${color}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{width:36,height:36,borderRadius:10,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{fraudCatIcon(t.type)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.navy}}>{t.type}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  {[["Détections",t.total,C.sky],["Bloquées",t.blocked,C.danger],["Faux positifs",t.fp,C.warning],["Résolues",t.cleared,C.success]].map(([l,v,c])=>(
                    <div key={l} style={{background:C.bg,borderRadius:8,padding:"8px 10px"}}>
                      <div style={{fontSize:18,fontWeight:900,color:c}}>{v}</div>
                      <div style={{fontSize:9,color:C.muted}}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:10,color:C.muted}}>Taux de blocage</span>
                    <span style={{fontSize:10,fontWeight:700,color:rate>=80?C.success:rate>=50?C.warning:C.danger}}>{rate}%</span>
                  </div>
                  <div style={{height:6,background:C.mutedL,borderRadius:3}}>
                    <div style={{height:"100%",width:`${rate}%`,background:rate>=80?C.success:rate>=50?C.warning:C.danger,borderRadius:3}}/>
                  </div>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:C.success}}>{t.saved.toLocaleString()} XOF sauvés</div>
              </Card>
            );
          })}
          {byType.length===0&&<div style={{gridColumn:"span 3",padding:"40px",textAlign:"center",color:C.muted}}>Aucune détection sur la période</div>}
        </div>
      )}

      {/* ── TREND ── */}
      {activeTab==="trend"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card style={{padding:"18px 20px"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:14}}>Détections vs Blocages — 7 jours</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} barGap={4}>
                <XAxis dataKey="d" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:C.white,border:`1px solid ${C.mutedL}`,borderRadius:8,fontSize:12}}/>
                <Bar dataKey="detections" name="Détections" fill={C.sky} radius={[4,4,0,0]} barSize={20}/>
                <Bar dataKey="blocked" name="Bloquées" fill={C.danger} radius={[4,4,0,0]} barSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card style={{padding:"18px 20px"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:14}}>Revenus sauvegardés (XOF) — 7 jours</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.success} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={C.success} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000000).toFixed(1)}M`}/>
                <Tooltip contentStyle={{background:C.white,border:`1px solid ${C.mutedL}`,borderRadius:8,fontSize:12}} formatter={v=>[`${v.toLocaleString()} XOF`,"Sauvés"]}/>
                <Area type="monotone" dataKey="saved" stroke={C.success} strokeWidth={2.5} fill="url(#sg)" dot={{fill:C.success,r:4}}/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card style={{padding:"18px 20px"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:14}}>Fraudes par type — 7 jours</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={WEEKLY_DATA} barSize={12}>
                <XAxis dataKey="d" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:C.white,border:`1px solid ${C.mutedL}`,borderRadius:8,fontSize:12}}/>
                <Bar dataKey="simbox" name="SIM Box" stackId="a" fill={C.danger}/>
                <Bar dataKey="irsf" name="IRSF" stackId="a" fill={C.warning}/>
                <Bar dataKey="wangiri" name="Wangiri" stackId="a" fill={C.sky}/>
                <Bar dataKey="mm" name="Mobile Money" stackId="a" fill={C.teal}/>
                <Bar dataKey="other" name="Autres" stackId="a" fill={C.mutedL} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ── FALSE POSITIVES ── */}
      {activeTab==="fp"&&(
        <div>
          <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            <Card style={{flex:1,minWidth:120,padding:"14px 18px",borderTop:`3px solid ${C.warning}`}}>
              <div style={{fontSize:22,fontWeight:900,color:C.warning}}>{fp.length}</div>
              <div style={{fontSize:11,color:C.textL}}>Faux positifs</div>
            </Card>
            <Card style={{flex:1,minWidth:120,padding:"14px 18px",borderTop:`3px solid ${C.danger}`}}>
              <div style={{fontSize:22,fontWeight:900,color:C.danger}}>{fpRate}%</div>
              <div style={{fontSize:11,color:C.textL}}>Taux global</div>
            </Card>
            <Card style={{flex:1,minWidth:120,padding:"14px 18px",borderTop:`3px solid ${C.success}`}}>
              <div style={{fontSize:22,fontWeight:900,color:C.success}}>{fpRate<=5?"✓ Bon":fpRate<=10?"⚠ Moyen":"✗ Élevé"}</div>
              <div style={{fontSize:11,color:C.textL}}>Qualité</div>
            </Card>
            <Card style={{flex:2,minWidth:200,padding:"14px 18px"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.navy,marginBottom:6}}>Référence industrie</div>
              <div style={{fontSize:11,color:C.textL}}>Excellent : &lt;3% · Bon : 3-5% · Acceptable : 5-10% · À améliorer : &gt;10%</div>
            </Card>
          </div>
          <Card style={{overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
                <thead>
                  <tr style={{background:C.bg}}>
                    {["Type","Total","Faux positifs","Taux FP","Recommandation"].map(h=>(
                      <th key={h} style={{padding:"10px 14px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"left"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byType.filter(t=>t.fp>0).sort((a,b)=>b.fp-a.fp).map((t,idx)=>{
                    const fpR=Math.round(t.fp/t.total*100);
                    return (
                      <tr key={t.type} style={{borderBottom:`1px solid ${C.mutedL}`,background:idx%2===0?C.white:"#FAFBFE"}}>
                        <td style={{padding:"10px 14px",fontSize:13,fontWeight:600,color:C.navy}}>{fraudCatIcon(t.type)} {t.type}</td>
                        <td style={{padding:"10px 14px",fontSize:13,color:C.textL}}>{t.total}</td>
                        <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:C.warning}}>{t.fp}</td>
                        <td style={{padding:"10px 14px"}}><Badge label={`${fpR}%`} color={fpR>10?C.danger:fpR>5?C.warning:C.success} small/></td>
                        <td style={{padding:"10px 14px",fontSize:11,color:C.muted}}>{fpR>10?"⚠ Revoir le seuil de la règle":fpR>5?"Surveiller":"✓ Normal"}</td>
                      </tr>
                    );
                  })}
                  {byType.filter(t=>t.fp>0).length===0&&<tr><td colSpan={5} style={{padding:"32px",textAlign:"center",color:C.muted}}>Aucun faux positif 🎉</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}