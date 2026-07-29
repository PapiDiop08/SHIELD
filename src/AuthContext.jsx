import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "./supabase.js";
import { ROLE_PERMISSIONS } from "./theme.js";

const AuthContext = createContext(null);

// Comptes démo Telco (fallback si auth non configuré)
const DEMO_USERS = [
  { id:"t1", name:"Papa Assane Diop",  email:"admin@aar-momo.com",    pwd:"AarAdmin2026!", role:"superadmin",  operator:null,         avatar:"PA" },
  { id:"t2", name:"Ibrahima Sow",      email:"ibrahima@partner.sn",   pwd:"AarAdmin2026!", role:"admin",       operator:"Partner SN", avatar:"IS" },
  { id:"t3", name:"Aïssatou Fall",     email:"aissatou@aar-momo.com", pwd:"AarAdmin2026!", role:"aar_analyst", operator:null,         avatar:"AF" },
  { id:"t4", name:"Kofi Mensah",       email:"kofi@partner.gh",       pwd:"AarAdmin2026!", role:"analyst",     operator:"Partner GH", avatar:"KM" },
];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [logs, setLogs]               = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  // Restaurer session au démarrage
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) _loadProfile(session.user);
      else setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) _loadProfile(session.user);
      else { setCurrentUser(null); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function _loadProfile(authUser) {
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', authUser.id).single();
    if (profile) {
      setCurrentUser({
        id: profile.id, name: profile.name, email: profile.email,
        role: profile.role, operator: profile.operator,
        operatorId: profile.operator_id,
        avatar: profile.avatar || (profile.name || 'AA').slice(0,2).toUpperCase(),
        active: profile.active, lastLogin: new Date().toISOString().slice(0,16),
        createdAt: profile.created_at?.slice(0,10) || '',
      });
    } else {
      const meta   = authUser.user_metadata || {};
      const email  = authUser.email || '';
      const name   = meta.name || email.split('@')[0];
      const role   = meta.role || 'analyst';
      const avatar = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      const fallback = { id: authUser.id, name, email, role, operator: null, active: true, avatar };
      const { data: inserted } = await supabase.from('profiles').insert(fallback).select().single();
      setCurrentUser({ ...(inserted || fallback), lastLogin: new Date().toISOString().slice(0,16), createdAt: new Date().toISOString().slice(0,10), operatorId: null });
    }
    setAuthLoading(false);
  }

  const addLog = useCallback((action, entity, entityId, detail, page) => {
    const entry = {
      id: `l${Date.now()}${Math.random()}`,
      ts: new Date().toISOString().replace("T", " ").slice(0, 19),
      userId: currentUser?.id, userName: currentUser?.name, userRole: currentUser?.role,
      action, entity, entityId, detail, page, ip: "192.168.1.10",
    };
    setLogs(p => [entry, ...p]);
    return entry;
  }, [currentUser]);

  const login = useCallback(async (email, _ignored, password) => {
    if (!password) return { success: false, error: "Mot de passe requis" };

    // 1. Essayer auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.user) return { success: true, user: data.user };

    // 2. Fallback démo
    const demo = DEMO_USERS.find(u => u.email === email && u.pwd === password);
    if (demo) {
      const { pwd: _, ...user } = demo;
      setCurrentUser({ ...user, active: true, lastLogin: new Date().toISOString().slice(0,16), createdAt: "2025-08-01", operatorId: null });
      setAuthLoading(false);
      return { success: true, user };
    }

    return { success: false, error: "Email ou mot de passe incorrect" };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  }, []);

  const can = useCallback((permission) => {
    if (!currentUser) return false;
    return ROLE_PERMISSIONS[currentUser.role]?.[permission] === true;
  }, [currentUser]);

  const isGFM = useCallback(() => {
    return ["superadmin", "aar_analyst", "gfm_analyst"].includes(currentUser?.role);
  }, [currentUser]);

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) addLog("CHANGE_PASSWORD", "user", currentUser?.id, "Mot de passe modifié", "Profil");
    return { success: !error, error: error?.message };
  }, [currentUser, addLog]);

  return (
    <AuthContext.Provider value={{
      currentUser, setCurrentUser, login, logout, can, isGFM,
      logs, addLog, setLogs, updatePassword, authLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
