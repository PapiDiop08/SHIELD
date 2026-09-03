import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "./supabase.js";
import { ROLE_PERMISSIONS } from "./theme.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [logs, setLogs]               = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  // Restaurer session au démarrage
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        _loadProfile(session.user);
      } else {
        setAuthLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) _loadProfile(session.user);
      else {
        setCurrentUser(null);
        setAuthLoading(false);
      }
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

  const login = useCallback(async (email, password) => {
    if (!password) return { success: false, error: "Mot de passe requis" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.user) return { success: true, user: data.user };
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
