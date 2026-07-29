import { useState } from "react";
import { C, ROLES } from "../theme.js";
import { Card, Btn, Badge, Avatar } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function UserProfile({ onBack }) {
  const { currentUser, updatePassword, addLog } = useAuth();
  const [tab, setTab] = useState("info");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState(null);
  const role = ROLES[currentUser?.role];

  function handleChangePwd(e) {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setPwdMsg({ text: "Les mots de passe ne correspondent pas", error: true }); return; }
    if (newPwd.length < 8) { setPwdMsg({ text: "Minimum 8 caractères", error: true }); return; }
    const result = updatePassword(newPwd);
    if (result.success) {
      setPwdMsg({ text: "Mot de passe modifié avec succès", error: false });
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
    }
  }

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif",background:C.bg,minHeight:"100vh",padding:"24px 32px" }}>
      <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:24 }}>
        <Btn variant="ghost" onClick={onBack}>← Retour</Btn>
        <h1 style={{ margin:0,fontSize:19,fontWeight:900,color:C.navy }}>Mon profil</h1>
      </div>

      <div style={{ display:"flex",gap:20,maxWidth:800 }}>
        {/* Left sidebar */}
        <div style={{ width:220,flexShrink:0 }}>
          <Card style={{ padding:"24px",textAlign:"center",marginBottom:14 }}>
            <Avatar user={currentUser} size={72} />
            <div style={{ fontSize:16,fontWeight:900,color:C.navy,marginTop:12 }}>{currentUser?.name}</div>
            <div style={{ fontSize:12,color:C.textL,marginTop:4 }}>{currentUser?.email}</div>
            <div style={{ marginTop:10 }}><Badge label={`${role?.icon} ${role?.label}`} color={role?.color||C.muted} /></div>
            {currentUser?.operator && <div style={{ fontSize:11,color:C.muted,marginTop:8 }}>{currentUser.operator}</div>}
          </Card>
          <Card style={{ overflow:"hidden" }}>
            {[{ k:"info",l:"Informations",i:"USR" },{ k:"password",l:"Mot de passe",i:"KEY" },{ k:"activity",l:"Mon activité",i:"LOG" }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{ display:"flex",alignItems:"center",gap:10,width:"100%",background:tab===t.k?C.navyL:"none",border:"none",padding:"11px 16px",cursor:"pointer",color:tab===t.k?C.white:C.textL,fontWeight:tab===t.k?700:400,fontSize:13,textAlign:"left",borderBottom:`1px solid ${C.mutedL}` }}>
                <span>{t.i}</span>{t.l}
              </button>
            ))}
          </Card>
        </div>

        {/* Right content */}
        <div style={{ flex:1 }}>
          {tab === "info" && (
            <Card style={{ padding:"24px" }}>
              <div style={{ fontSize:14,fontWeight:700,color:C.navy,marginBottom:18 }}>Informations personnelles</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                {[["Nom complet",currentUser?.name],["Email",currentUser?.email],["Rôle",`${role?.icon} ${role?.label}`],["Opérateur",currentUser?.operator||"Global Fraud Management"],["Membre depuis",currentUser?.createdAt||"—"],["Dernière connexion",currentUser?.lastLogin||"—"]].map(([k,v]) => (
                  <div key={k} style={{ background:C.bg,borderRadius:8,padding:"12px 14px" }}>
                    <div style={{ fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4 }}>{k}</div>
                    <div style={{ fontSize:13,fontWeight:600,color:C.navy }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:20,paddingTop:16,borderTop:`1px solid ${C.mutedL}` }}>
                <div style={{ fontSize:11,color:C.muted,fontStyle:"italic" }}>
                  Pour modifier votre email, contactez un Super Admin. Pour modifier votre nom, contactez votre administrateur.
                </div>
              </div>
            </Card>
          )}

          {tab === "password" && (
            <Card style={{ padding:"24px" }}>
              <div style={{ fontSize:14,fontWeight:700,color:C.navy,marginBottom:18 }}>Modifier le mot de passe</div>
              <form onSubmit={handleChangePwd}>
                {[["Mot de passe actuel",oldPwd,setOldPwd],["Nouveau mot de passe",newPwd,setNewPwd],["Confirmer le nouveau mot de passe",confirmPwd,setConfirmPwd]].map(([label,val,setter]) => (
                  <div key={label} style={{ marginBottom:16 }}>
                    <label style={{ display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6 }}>{label}</label>
                    <input type="password" value={val} onChange={e => setter(e.target.value)} required
                      style={{ width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"10px 14px",fontSize:14,color:C.navy,outline:"none",boxSizing:"border-box" }} />
                  </div>
                ))}
                {pwdMsg && (
                  <div style={{ background:pwdMsg.error?C.dangerL:C.successL,border:`1px solid ${pwdMsg.error?C.danger:C.success}44`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:pwdMsg.error?C.danger:C.success,fontWeight:600 }}>
                    {pwdMsg.error?"!":"v"} {pwdMsg.text}
                  </div>
                )}
                <div style={{ padding:"12px 14px",background:C.bg,borderRadius:8,marginBottom:18 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:C.navy,marginBottom:6 }}>Le mot de passe doit :</div>
                  {["Contenir au moins 8 caractères","Contenir au moins une majuscule","Contenir au moins un chiffre"].map(r => <div key={r} style={{ fontSize:11,color:C.textL,marginBottom:3 }}>• {r}</div>)}
                </div>
                <Btn type="submit" style={{ width:"100%",justifyContent:"center" }}>Modifier le mot de passe</Btn>
              </form>
            </Card>
          )}

          {tab === "activity" && (
            <Card style={{ padding:"24px" }}>
              <div style={{ fontSize:14,fontWeight:700,color:C.navy,marginBottom:18 }}>Mon activité récente</div>
              <div style={{ display:"flex",gap:12,marginBottom:18 }}>
                {[{ l:"Alertes traitées",v:12,c:C.sky },{ l:"Blocages",v:5,c:C.danger },{ l:"Règles créées",v:2,c:C.warning },{ l:"Notes ajoutées",v:8,c:C.purple }].map(s => (
                  <div key={s.l} style={{ flex:1,background:C.bg,borderRadius:8,padding:"10px 14px",textAlign:"center" }}>
                    <div style={{ fontSize:22,fontWeight:900,color:s.c }}>{s.v}</div>
                    <div style={{ fontSize:10,color:C.textL,marginTop:4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12,color:C.muted,fontStyle:"italic",textAlign:"center",padding:"20px" }}>
                Voir l'audit log complet pour l'historique détaillé de toutes vos actions.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}