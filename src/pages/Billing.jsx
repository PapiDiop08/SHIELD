import { C } from "../theme.js";
import { Card, Btn, SectionHeader, Badge } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function Billing({ operators, alerts, blockings }) {
  const { currentUser } = useAuth();
  const currentMonth = new Date().toISOString().slice(0,7);

  const opBills = operators.map(op => {
    const opAlerts = alerts.filter(a=>a.operator===op.name).length;
    const opBlocked = blockings.filter(b=>b.operator===op.name&&b.active).length;
    const base = op.monthlyFee||250000;
    const alertCost = opAlerts*(op.perAlertFee||5);
    const blockCost = opBlocked*(op.perBlockFee||10);
    const mmCost = op.packs?.mm?50000:0;
    const aiCost = op.packs?.ai?100000:0;
    const total = base+alertCost+blockCost+mmCost+aiCost;
    return { ...op, opAlerts, opBlocked, alertCost, blockCost, mmCost, aiCost, total };
  });

  const grandTotal = opBills.reduce((a,b)=>a+b.total,0);

  return (
    <div style={{ padding:"28px 30px",fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader title="Facturation" sub={`${currentMonth} · Visible Super Admin uniquement`}
        action={<div style={{ display:"flex",gap:8 }}><Btn variant="secondary">📥 Exporter Excel</Btn><Btn>📄 Générer factures PDF</Btn></div>} />

      <div style={{ display:"flex",gap:14,marginBottom:24 }}>
        <Card style={{ flex:1,padding:"16px 20px",borderTop:`3px solid ${C.success}` }}>
          <div style={{ fontSize:22,fontWeight:900,color:C.success }}>{grandTotal.toLocaleString()} XOF</div>
          <div style={{ fontSize:12,color:C.textL,marginTop:4 }}>Total facturable ce mois</div>
        </Card>
        <Card style={{ flex:1,padding:"16px 20px",borderTop:`3px solid ${C.sky}` }}>
          <div style={{ fontSize:22,fontWeight:900,color:C.sky }}>{operators.filter(o=>o.active).length}</div>
          <div style={{ fontSize:12,color:C.textL,marginTop:4 }}>Opérateurs actifs</div>
        </Card>
        <Card style={{ flex:1,padding:"16px 20px",borderTop:`3px solid ${C.warning}` }}>
          <div style={{ fontSize:22,fontWeight:900,color:C.warning }}>{alerts.length}</div>
          <div style={{ fontSize:12,color:C.textL,marginTop:4 }}>Alertes totales</div>
        </Card>
        <Card style={{ flex:1,padding:"16px 20px",borderTop:`3px solid ${C.danger}` }}>
          <div style={{ fontSize:22,fontWeight:900,color:C.danger }}>{blockings.filter(b=>b.active).length}</div>
          <div style={{ fontSize:12,color:C.textL,marginTop:4 }}>Blocages actifs</div>
        </Card>
      </div>

      {opBills.map(op=>(
        <Card key={op.id} style={{ padding:"20px 24px",marginBottom:16 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
            <div>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:4 }}>
                <span style={{ fontSize:16,fontWeight:900,color:C.navy }}>{op.name}</span>
                <Badge label={op.active?"Actif":"Inactif"} color={op.active?C.success:C.muted} small />
              </div>
              <div style={{ fontSize:12,color:C.muted }}>{op.contact}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:24,fontWeight:900,color:C.success }}>{op.total.toLocaleString()} XOF</div>
              <div style={{ fontSize:11,color:C.muted }}>Total {currentMonth}</div>
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,padding:"14px",background:C.bg,borderRadius:10 }}>
            {[["Forfait mensuel",op.monthlyFee||0],[`${op.opAlerts} alertes`,op.alertCost],[`${op.opBlocked} blocages`,op.blockCost],op.packs?.mm?["Pack Mobile Money",op.mmCost]:null,op.packs?.ai?["Pack IA",op.aiCost]:null].filter(Boolean).map(([l,v])=>(
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontSize:14,fontWeight:700,color:C.navy }}>{v.toLocaleString()} XOF</div>
                <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",gap:8,marginTop:14 }}>
            <Btn variant="secondary" small>Voir détails</Btn>
            <Btn variant="ghost" small>📄 Générer facture PDF</Btn>
            <Btn variant="ghost" small>📧 Envoyer par email</Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}