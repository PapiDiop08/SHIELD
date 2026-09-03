import { useState } from "react";
import { C, ROLES, ROLE_PERMISSIONS } from "../theme.js";
import { Card, Badge, Btn, SectionHeader, Modal, Avatar, ConfirmModal } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

const PERM_LABELS = {
  viewAll: "Voir toutes les données",
  manageUsers: "Gérer les utilisateurs",
  manageRoles: "Gérer les rôles",
  editEmail: "Modifier les emails",
  resetPassword: "Réinitialiser les mots de passe",
  createRules: "Créer des règles",
  editRules: "Modifier des règles",
  deleteRules: "Supprimer des règles",
  blockSIM: "Bloquer des SIMs",
  manageLists: "Gérer les listes (BL/WL/WA)",
  createCases: "Créer des cases",
  assignCases: "Assigner des cases",
  viewLogs: "Voir l'audit log",
  manageUDF: "Gérer les champs CDR",
  manageSettings: "Gérer les paramètres",
  exportData: "Exporter les données",
  manageOperators: "Gérer les opérateurs",
  viewAllOperators: "Voir tous les opérateurs",
  managePermissions: "Modifier les permissions",
  accessAI: "Accès IA Analyse",
  viewBilling: "Voir la facturation",
  editOperator: "Modifier les opérateurs",
  onboardOperator: "Onboarder un opérateur",
  viewBlockings: "Voir les blocages",
  unblockSIM: "Débloquer des SIMs",
  editCDRFields: "Modifier les champs CDR",
  watchlistOnly: "Watchlist uniquement",
};

const PERM_CATEGORIES = {
  "Accès & Visibilité": ["viewAll","viewAllOperators","viewLogs","viewBlockings","viewBilling"],
  "Utilisateurs & Rôles": ["manageUsers","manageRoles","managePermissions","editEmail","resetPassword"],
  "Règles de détection": ["createRules","editRules","deleteRules"],
  "Listes & Blocages": ["blockSIM","unblockSIM","manageLists","watchlistOnly"],
  "Cases & Alertes": ["createCases","assignCases"],
  "Opérateurs": ["manageOperators","editOperator","onboardOperator"],
  "Données & Export": ["exportData","manageUDF","editCDRFields","manageSettings"],
  "IA & Facturation": ["accessAI","viewBilling"],
};

export default function Admin({ users, setUsers, operators, addLog, createUser }) {
  const { currentUser, can } = useAuth();
  const [tab, setTab] = useState("users");
  const [showCreate, setShowCreate] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterOp, setFilterOp] = useState("all");
  const [newUser, setNewUser] = useState({ name:"",email:"",role:"analyst",operator:"" });
  const [customPerms, setCustomPerms] = useState(() => {
    const p = {};
    Object.keys(ROLES).forEach(r => { p[r] = {...(ROLE_PERMISSIONS[r]||{})}; });
    return p;
  });
  const [permsSaved, setPermsSaved] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg,color=C.success){ setToast({msg,color}); setTimeout(()=>setToast(null),3000); }

  const visibleUsers = users.filter(u => {
    if (currentUser?.role==="superadmin") return true;
    return !["superadmin","gfm_analyst"].includes(u.role);
  });

  const filtered = visibleUsers.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q);
    const matchRole = filterRole==="all"||u.role===filterRole;
    const matchOp = filterOp==="all"||(filterOp==="gfm"&&!u.operator)||(filterOp==="aar"&&!u.operator)||(u.operator===filterOp);
    return matchSearch&&matchRole&&matchOp;
  });

  function handleCreateUser() {
    const u = { id:`u${Date.now()}`,...newUser,active:true,lastLogin:"—",avatar:newUser.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(),createdAt:new Date().toISOString().slice(0,10) };
    setUsers(p=>[...p,u]);
    if (createUser) createUser(u, null);
    addLog("CREATE_USER","user",u.id,`Création ${u.name} — ${u.role}`,"Admin");
    setShowCreate(false);
    setNewUser({name:"",email:"",role:"analyst",operator:""});
    showToast(`${u.name} créé — Email d'invitation envoyé`);
  }

  function toggleUser(id) {
    const u = users.find(x=>x.id===id);
    if (!u) return;
    setUsers(p=>p.map(x=>x.id===id?{...x,active:!x.active}:x));
    addLog("TOGGLE_USER","user",id,`${u.name} ${u.active?"désactivé":"activé"}`,"Admin");
    showToast(`${u.name} ${u.active?"désactivé":"activé"}`);
  }

  function updateRole(id,role) {
    const u = users.find(x=>x.id===id);
    setUsers(p=>p.map(x=>x.id===id?{...x,role}:x));
    addLog("CHANGE_ROLE","user",id,`Rôle ${u?.name} : ${u?.role} → ${role}`,"Admin");
    showToast("Rôle mis à jour",C.sky);
  }

  function togglePerm(role,perm) {
    if (role==="superadmin") return; // superadmin locked
    setCustomPerms(p=>({ ...p,[role]:{ ...p[role],[perm]:!p[role]?.[perm] } }));
  }

  function savePerms() {
    addLog("EDIT_PERMISSIONS","permissions",null,`Permissions modifiées pour ${Object.keys(ROLES).join(", ")}`,"Admin");
    setPermsSaved(true);
    setTimeout(()=>setPermsSaved(false),2000);
    showToast("Permissions sauvegardées",C.success);
  }

  function sendReset(user) {
    addLog("RESET_PASSWORD","user",user.id,`Reset password → ${user.email}`,"Admin");
    setResetUser(null);
    showToast(`Email envoyé à ${user.email}`);
  }

  const roleKeys = Object.keys(ROLES);

  return (
    <div style={{padding:"24px 20px",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {toast&&<div style={{position:"fixed",top:20,right:20,background:toast.color,color:C.white,borderRadius:10,padding:"12px 20px",fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>{toast.msg}</div>}

      <SectionHeader title="Administration" />

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:C.white,border:`1px solid ${C.mutedL}`,borderRadius:12,padding:5}}>
        {[{k:"users",l:"Utilisateurs"},{k:"permissions",l:"Permissions"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,padding:"9px 14px",background:tab===t.k?C.navy:"none",border:"none",borderRadius:8,cursor:"pointer",color:tab===t.k?C.white:C.textL,fontWeight:700,fontSize:13}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {tab==="users"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <p style={{margin:0,fontSize:12,color:C.textL}}>{users.filter(u=>u.active).length} actifs · {users.length} total</p>
            {can("manageUsers")&&<Btn onClick={()=>setShowCreate(true)}>+ Nouvel utilisateur</Btn>}
          </div>

          {/* Role stats */}
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            {Object.entries(ROLES).filter(([k])=>currentUser?.role==="superadmin"||!["superadmin","gfm_analyst"].includes(k)).map(([key,role])=>(
              <div key={key} onClick={()=>setFilterRole(filterRole===key?"all":key)}
                style={{flex:1,minWidth:90,background:C.white,border:`2px solid ${filterRole===key?role.color:C.mutedL}`,borderTop:`3px solid ${role.color}`,borderRadius:12,padding:"10px 12px",cursor:"pointer",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:900,color:role.color}}>{users.filter(u=>u.role===key&&u.active).length}</div>
                <div style={{fontSize:10,color:C.textL,marginTop:3}}>{role.icon} {role.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <div style={{position:"relative",flex:1,minWidth:160}}>
              
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, email..."
                style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"8px 10px 8px 30px",fontSize:12,color:C.navy,outline:"none",boxSizing:"border-box",background:C.white}}/>
            </div>
            <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} style={{border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:C.navy,background:C.white,outline:"none"}}>
              <option value="all">Tous les rôles</option>
              {Object.entries(ROLES).map(([k,r])=><option key={k} value={k}>{r.icon} {r.label}</option>)}
            </select>
            {currentUser?.role==="superadmin"&&(
              <select value={filterOp} onChange={e=>setFilterOp(e.target.value)} style={{border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:C.navy,background:C.white,outline:"none"}}>
                <option value="all">Tous</option>
                <option value="aar">AAR (interne)</option>
                {operators.map(o=><option key={o.id} value={o.name}>{o.name}</option>)}
              </select>
            )}
          </div>

          {/* Users table */}
          <Card style={{overflow:"hidden"}}>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
                <thead>
                  <tr style={{background:C.bg,borderBottom:`2px solid ${C.mutedL}`}}>
                    {["Utilisateur","Rôle","Opérateur","Statut","Actions"].map(h=>(
                      <th key={h} style={{padding:"10px 14px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0&&<tr><td colSpan={5} style={{padding:"32px",textAlign:"center",color:C.muted}}>Aucun utilisateur trouvé</td></tr>}
                  {filtered.map((u,idx)=>{
                    const role=ROLES[u.role];
                    const isMe=u.id===currentUser?.id;
                    return (
                      <tr key={u.id} style={{borderBottom:`1px solid ${C.mutedL}`,background:idx%2===0?C.white:"#FAFBFE",opacity:u.active?1:0.55}}
                        onMouseOver={e=>e.currentTarget.style.background=C.bg} onMouseOut={e=>e.currentTarget.style.background=idx%2===0?C.white:"#FAFBFE"}>
                        <td style={{padding:"12px 14px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <Avatar user={u} size={34}/>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:C.navy}}>{u.name} {isMe&&<Badge label="Vous" color={C.sky} small/>}</div>
                              <div style={{fontSize:11,color:C.muted}}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:"12px 14px"}}>
                          {can("manageRoles")&&!isMe&&currentUser?.role==="superadmin"?(
                            <select value={u.role} onChange={e=>updateRole(u.id,e.target.value)}
                              style={{border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"5px 8px",fontSize:12,color:role?.color,background:(role?.color||C.muted)+"18",outline:"none",fontWeight:700,cursor:"pointer"}}>
                              {Object.entries(ROLES).map(([k,r])=><option key={k} value={k}>{r.icon} {r.label}</option>)}
                            </select>
                          ):<Badge label={`${role?.icon} ${role?.label}`} color={role?.color||C.muted} small/>}
                        </td>
                        <td style={{padding:"12px 14px",fontSize:12,color:C.textL}}>{u.operator||"AAR"}</td>
                        <td style={{padding:"12px 14px"}}>
                          <button onClick={()=>!isMe&&setConfirm({action:"toggle",u,msg:`${u.active?"Désactiver":"Activer"} ${u.name} ?`})}
                            disabled={isMe} style={{background:u.active?C.successL:C.mutedL,border:`1px solid ${u.active?C.success:C.muted}44`,color:u.active?C.success:C.muted,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:isMe?"not-allowed":"pointer"}}>
                            {u.active?"● Actif":"○ Inactif"}
                          </button>
                        </td>
                        <td style={{padding:"8px 14px"}}>
                          <div style={{display:"flex",gap:4}}>
                            {can("resetPassword")&&!isMe&&<Btn variant="warning" small onClick={()=>setResetUser(u)}>Reset MDP</Btn>}
                            {can("editEmail")&&!isMe&&<Btn variant="sky" small>Email</Btn>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── PERMISSIONS TAB ── */}
      {tab==="permissions"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <p style={{margin:0,fontSize:12,color:C.textL}}>Définissez les permissions par rôle. Cliquez sur une case pour la modifier.</p>
            {currentUser?.role==="superadmin"&&(
              <Btn onClick={savePerms} style={{background:permsSaved?C.success:C.red}}>
                {permsSaved?"v Sauvegardé":"Sauvegarder les permissions"}
              </Btn>
            )}
          </div>

          {currentUser?.role!=="superadmin"&&(
            <div style={{background:C.warningL,border:`1px solid ${C.warning}44`,borderRadius:10,padding:"10px 16px",marginBottom:16,fontSize:12,color:C.warning,fontWeight:600}}>
              ! Seul le Super Admin peut modifier les permissions
            </div>
          )}

          {Object.entries(PERM_CATEGORIES).map(([catName,perms])=>(
            <Card key={catName} style={{marginBottom:12,overflow:"hidden"}}>
              {/* Category header */}
              <div style={{background:C.navyL,padding:"10px 16px",display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:13,fontWeight:700,color:C.white}}>{catName}</span>
                <div style={{flex:1}}/>
                {/* Role columns header */}
                <div style={{display:"flex",gap:0}}>
                  {roleKeys.map(rk=>{
                    const r=ROLES[rk];
                    return (
                      <div key={rk} style={{width:100,textAlign:"center"}}>
                        <div style={{fontSize:10,fontWeight:700,color:r.color,whiteSpace:"nowrap"}}>{r.icon} {r.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Permissions rows */}
              {perms.map((perm,i)=>(
                <div key={perm} style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.mutedL}`,background:i%2===0?C.white:"#FAFBFE"}}>
                  {/* Permission name */}
                  <div style={{flex:1,padding:"10px 16px"}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.navy}}>{PERM_LABELS[perm]||perm}</div>
                    <div style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>{perm}</div>
                  </div>
                  {/* Checkboxes per role */}
                  {roleKeys.map(rk=>{
                    const isLocked = rk==="superadmin";
                    const hasPerm = customPerms[rk]?.[perm]===true;
                    return (
                      <div key={rk} style={{width:100,textAlign:"center",padding:"10px 0"}}>
                        <button
                          onClick={()=>!isLocked&&currentUser?.role==="superadmin"&&togglePerm(rk,perm)}
                          style={{
                            width:28,height:28,borderRadius:6,
                            background:hasPerm?(isLocked?C.muted:ROLES[rk].color)+"22":C.bg,
                            border:`2px solid ${hasPerm?(isLocked?C.muted:ROLES[rk].color):C.mutedL}`,
                            cursor:isLocked||currentUser?.role!=="superadmin"?"default":"pointer",
                            display:"inline-flex",alignItems:"center",justifyContent:"center",
                            fontSize:14,fontWeight:700,
                            color:hasPerm?(isLocked?C.muted:ROLES[rk].color):C.mutedL,
                            transition:"all 0.15s",
                          }}>
                          {hasPerm?"v":"—"}
                        </button>
                        {isLocked&&<div style={{fontSize:8,color:C.muted,marginTop:2}}>verrouillé</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </Card>
          ))}

          {currentUser?.role==="superadmin"&&(
            <div style={{textAlign:"right",marginTop:16}}>
              <Btn onClick={savePerms} style={{background:permsSaved?C.success:C.red,fontSize:15,padding:"12px 28px"}}>
                {permsSaved?"v Permissions sauvegardées":"Sauvegarder les permissions"}
              </Btn>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreate&&(
        <Modal title="Nouvel utilisateur" onClose={()=>setShowCreate(false)} width={460}>
          <div style={{padding:"18px 20px"}}>
            {[["Nom complet","name","text","Ex: Moussa Diallo"],["Email","email","email","Ex: moussa@orange.sn"]].map(([l,k,t,p])=>(
              <div key={k} style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>{l}</label>
                <input type={t} value={newUser[k]} onChange={e=>setNewUser(f=>({...f,[k]:e.target.value}))} placeholder={p}
                  style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>Rôle</label>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {Object.entries(ROLES).filter(([k])=>currentUser?.role==="superadmin"||!["superadmin","gfm_analyst"].includes(k)).map(([k,r])=>(
                  <button key={k} onClick={()=>setNewUser(f=>({...f,role:k}))} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:newUser.role===k?r.color+"18":C.bg,border:`2px solid ${newUser.role===k?r.color:C.mutedL}`,borderRadius:8,cursor:"pointer",textAlign:"left"}}>
                    <span style={{fontSize:16}}>{r.icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:newUser.role===k?r.color:C.navy}}>{r.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>Opérateur</label>
              <select value={newUser.operator} onChange={e=>setNewUser(f=>({...f,operator:e.target.value}))}
                style={{width:"100%",border:`1px solid ${C.mutedL}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:C.navy,background:C.white,outline:"none"}}>
                <option value="">AAR (interne)</option>
                {operators.map(o=><option key={o.id} value={o.name}>{o.name}</option>)}
              </select>
            </div>
            <div style={{background:C.warningL||"#FFF6E5",border:`1px solid ${C.warning}55`,borderRadius:8,padding:"10px 14px",marginBottom:18,fontSize:12,color:C.textL}}>
              Attention : ceci crée uniquement la fiche profil de <strong>{newUser.email||"l'utilisateur"}</strong> dans SHIELD. Aucun email n'est envoyé et aucun compte de connexion n'est créé — pour que cette personne puisse se connecter, invitez-la séparément depuis Supabase Auth (Authentication → Invite user) avec le même email, puis reliez son compte ici si besoin.
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" onClick={()=>setShowCreate(false)} style={{flex:1,justifyContent:"center"}}>Annuler</Btn>
              <Btn onClick={handleCreateUser} disabled={!newUser.name||!newUser.email} style={{flex:2,justifyContent:"center"}}>Créer le profil</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Modal */}
      {resetUser&&(
        <Modal title="Réinitialiser le mot de passe" onClose={()=>setResetUser(null)} width={420}>
          <div style={{padding:"18px 20px"}}>
            <div style={{background:C.warningL,border:`1px solid ${C.warning}44`,borderRadius:10,padding:"14px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:12}}>
              <Avatar user={resetUser} size={36}/>
              <div><div style={{fontSize:14,fontWeight:700,color:C.navy}}>{resetUser.name}</div><div style={{fontSize:12,color:C.muted}}>{resetUser.email}</div></div>
            </div>
            <p style={{margin:"0 0 18px",fontSize:13,color:C.textL,lineHeight:1.6}}>Un email avec un lien valable 24h sera envoyé à <strong>{resetUser.email}</strong>.</p>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" onClick={()=>setResetUser(null)} style={{flex:1,justifyContent:"center"}}>Annuler</Btn>
              <Btn variant="warning" onClick={()=>sendReset(resetUser)} style={{flex:2,justifyContent:"center"}}>Email Envoyer le reset</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm */}
      {confirm&&(
        <ConfirmModal title="Confirmation" message={confirm.msg}
          confirmLabel="Confirmer"
          confirmColor={confirm.u?.active?C.warning:C.success}
          onConfirm={()=>{if(confirm.action==="toggle")toggleUser(confirm.u.id);setConfirm(null);}}
          onCancel={()=>setConfirm(null)}/>
      )}
    </div>
  );
}