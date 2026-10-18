import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase.js';



// ── Operators ─────────────────────────────────────────────────────────────
export function useOperators() {
  const [operators, setOperatorsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from('operators').select('*').order('name');
    if (!err && data) {
      // Charger les compteurs réels pour chaque opérateur
      const enriched = await Promise.all(data.map(async (o) => {
        const [alertsRes, blockedRes, rulesRes] = await Promise.all([
          supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('operator_id', o.id),
          supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('operator_id', o.id).eq('status', 'blocked'),
          supabase.from('rules').select('*', { count: 'exact', head: true }).eq('active', true).eq('scope', 'telco'),
        ]);
        return {
          id: o.id, name: o.name, code: o.code, country: o.country,
          active: o.status === 'active', status: o.status, contact: o.contact_email, contractStart: o.created_at?.slice(0,10),
          monthlyFee: o.monthly_fee || 250000,
          perAlertFee: o.per_alert_fee || 5,
          perBlockFee: o.per_block_fee || 10,
          perAIFee: o.per_ai_fee || 500,
          packs: { mm: o.pack_mm, ai: o.pack_ai, deepai: o.pack_deepai, api: o.pack_api },
          slaEnabled: o.sla_enabled,
          slaConfig: { critical: o.sla_critical, high: o.sla_high, medium: o.sla_medium },
          rules: rulesRes.count || 0,
          detections: alertsRes.count || 0,
          blocked: blockedRes.count || 0,
        };
      }));
      setOperatorsState(enriched);
      if (enriched.length === 0) {
        setError("Aucun opérateur trouvé dans la base — vérifiez que la table operators est peuplée et accessible (policies RLS).");
      }
    } else {
      setOperatorsState([]);
      setError(err?.message || "Impossible de charger les opérateurs depuis Supabase.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  const setOperators = useCallback((u) => setOperatorsState(u), []);

  const createOperator = useCallback(async (op) => {
    const { data, error } = await supabase.from('operators').insert([{
      name: op.name, code: op.code, country: op.country || 'SN',
      contact_email: op.contact, monthly_fee: op.monthlyFee || 250000,
      per_alert_fee: op.perAlertFee || 5, per_block_fee: op.perBlockFee || 10,
      per_ai_fee: op.perAIFee || 500, pack_mm: op.packs?.mm || false,
      pack_ai: op.packs?.ai || false, pack_deepai: op.packs?.deepai || false,
      pack_api: op.packs?.api || false, sla_enabled: op.slaEnabled || false,
      sla_critical: op.slaConfig?.critical || 2, sla_high: op.slaConfig?.high || 8,
      sla_medium: op.slaConfig?.medium || 24, status: 'active',
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const updateOperator = useCallback(async (id, updates) => {
    const { error } = await supabase.from('operators').update({
      name: updates.name, code: updates.code, status: updates.active ? 'active' : 'inactive',
      contact_email: updates.contact, monthly_fee: updates.monthlyFee,
      pack_mm: updates.packs?.mm, pack_ai: updates.packs?.ai,
      sla_enabled: updates.slaEnabled, sla_critical: updates.slaConfig?.critical,
      sla_high: updates.slaConfig?.high, sla_medium: updates.slaConfig?.medium,
    }).eq('id', id);
    if (!error) await fetch();
    return { error };
  }, [fetch]);

  return { operators, setOperators, loading, error, createOperator, updateOperator, refetch: fetch };
}

// ── Users ─────────────────────────────────────────────────────────────────
export function useUsers() {
  const [users, setUsersState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    // NOTE : le compte utilisateur réel vit dans `profiles` (lié à supabase.auth),
    // pas dans une table `users` séparée qui n'existe pas dans ce projet Supabase.
    const { data, error: err } = await supabase.from('profiles').select('*').order('name');
    if (!err && data) {
      setUsersState(data.map(u => ({
        id: u.id, name: u.name, email: u.email, role: u.role,
        operator: u.operator, operatorId: u.operator_id,
        active: u.active, lastLogin: u.last_login || '—',
        avatar: u.avatar || (u.name || 'AA').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase(),
        createdAt: u.created_at?.slice(0,10),
      })));
      if (data.length === 0) {
        setError("Aucun utilisateur trouvé dans la base — vérifiez que la table profiles est peuplée et accessible (policies RLS).");
      }
    } else {
      setUsersState([]);
      setError(err?.message || "Impossible de charger les utilisateurs depuis Supabase.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  const setUsers = useCallback((u) => setUsersState(u), []);

  const createUser = useCallback(async (user, operatorId) => {
    // Un compte utilisateur réel doit être créé via supabase.auth (invite/sign-up) —
    // ceci crée seulement la ligne de profil associée, pour un id déjà existant côté auth.
    const { data, error } = await supabase.from('profiles').insert([{
      name: user.name, email: user.email, role: user.role,
      operator_id: operatorId || null, operator: user.operator || null, active: true,
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const updateUser = useCallback(async (id, updates) => {
    const { error } = await supabase.from('profiles').update({
      role: updates.role, active: updates.active,
    }).eq('id', id);
    if (!error) await fetch();
    return { error };
  }, [fetch]);

  return { users, setUsers, loading, error, createUser, updateUser, refetch: fetch };
}

// ── Alerts ────────────────────────────────────────────────────────────────
export function useAlerts(operatorFilter) {
  const [alerts, setAlertsState] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    let query = supabase
      .from('alerts')
      .select('*')
      .eq('scope', 'telco')
      .order('created_at', { ascending: false })
      .limit(500);
    if (operatorFilter) query = query.eq('operator_id', operatorFilter);
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      setAlertsState(data.map(a => ({
        id: a.id,
        time: new Date(a.created_at || a.detected_at || Date.now()).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}),
        createdAt: a.created_at || a.detected_at,
        msisdn: a.msisdn, imei: a.imei || '', imsi: a.imsi || '',
        cellId: a.cell_id || '', type: a.fraud_type || a.type, severity: a.severity,
        score: a.score || 0, status: a.status, assignedTo: a.assigned_to,
        caseId: a.case_id, operatorId: a.operator_id,
        operator: a.operator || a.operator_id || '—',
        rule: a.rule_id || a.reason || '', notes: a.notes || [],
        triggeredRules: a.triggered_rules || (a.reason ? [a.reason] : []),
      })));
    } else {
      setAlertsState([]);
    }
    setLoading(false);
  }, [operatorFilter]);

  useEffect(() => {
    fetch();
    const sub = supabase.channel('alerts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, fetch)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [fetch]);

  const setAlerts = useCallback((u) => setAlertsState(u), []);

  const updateAlertStatus = useCallback(async (id, status) => {
    await supabase.from('alerts').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setAlertsState(p => p.map(a => a.id === id ? { ...a, status } : a));
  }, []);

  const assignAlert = useCallback(async (id, userId) => {
    await supabase.from('alerts').update({ assigned_to: userId }).eq('id', id);
    setAlertsState(p => p.map(a => a.id === id ? { ...a, assignedTo: userId } : a));
  }, []);

  return { alerts, setAlerts, loading, updateAlertStatus, assignAlert, refetch: fetch };
}

// ── Rules ─────────────────────────────────────────────────────────────────
export function useRules() {
  const [rules, setRulesState] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .eq('scope', 'telco')
      .order('triggered', { ascending: false });
    // Dérive le type fraude depuis le préfixe du nom de la règle
    const PREFIX_TYPE = {
      'SIM Box': 'SIM Box', 'Concentration cellule': 'SIM Box',
      'Wangiri': 'Wangiri',
      'IRSF': 'IRSF',
      'ATO': 'SIM Swap', 'IMSI': 'SIM Swap',
      'Bypass GSM': 'Bypass GSM', 'Bypass confirmé': 'Bypass GSM', 'Bypass': 'Bypass GSM',
      'PBX Hack': 'PBX Hacking', 'PBX': 'PBX Hacking',
      'Grey Route': 'Grey Routes',
      'CLI Spoofing': 'Spoofing CLI', 'Bypass GSM — CLI': 'Spoofing CLI',
      'Interconnexion': 'Grey Routes', 'Fraude terminaison': 'Grey Routes',
      'Arnaque': 'Subscription Fraud', 'Spam': 'Subscription Fraud',
      'Roaming': 'Roaming Fraud',
      'Flash': 'Flash Calls',
    };
    function deriveRuleType(name) {
      for (const [pfx, t] of Object.entries(PREFIX_TYPE)) {
        if (name?.startsWith(pfx)) return t;
      }
      return null;
    }
    if (!error && data) {
      setRulesState(data.map(r => ({
        id: r.id, name: r.name, type: deriveRuleType(r.name) || r.description || r.name,
        severity: r.severity, action: r.action, scope: r.scope || 'telco',
        active: r.active, triggered: r.triggered || 0, blocked: r.blocked || 0,
        conditions: r.conditions || [], createdBy: r.creator_name,
        creatorName: r.creator_name || "AAR",
        date: r.date || r.created_at?.slice(0,10), operator: r.operator_id, caseId: null,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime: re-fetch quand triggered/blocked sont mis à jour par le simulateur
  useEffect(() => {
    const sub = supabase.channel('rules-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rules' }, () => {
        fetch();
      })
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [fetch]);

  const setRules = useCallback((u) => setRulesState(u), []);

  const createRule = useCallback(async (rule) => {
    const { data, error } = await supabase.from('rules').insert([{
      name: rule.name,
      description: rule.type || rule.name,
      severity: rule.severity,
      action: rule.action,
      scope: 'telco',
      active: true,
      conditions: rule.conditions || [],
      triggered: 0,
      blocked: 0,
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const updateRule = useCallback(async (id, rule) => {
    const { error } = await supabase.from('rules').update({
      name: rule.name, description: rule.type || rule.name, severity: rule.severity,
      action: rule.action, active: rule.active, conditions: rule.conditions || [],
    }).eq('id', id);
    if (!error) await fetch();
    return { error };
  }, [fetch]);

  const toggleRule = useCallback(async (id, active) => {
    await supabase.from('rules').update({ active }).eq('id', id);
    setRulesState(p => p.map(r => r.id === id ? { ...r, active } : r));
  }, []);

  const deleteRule = useCallback(async (id) => {
    await supabase.from('rules').delete().eq('id', id);
    setRulesState(p => p.filter(r => r.id !== id));
  }, []);

  return { rules, setRules, loading, createRule, updateRule, toggleRule, deleteRule, refetch: fetch };
}

// ── Blockings ─────────────────────────────────────────────────────────────
export function useBlockings(operatorFilter) {
  const [blockings, setBlockingsState] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    let query = supabase.from('blockings')
      .select('*')
      .order('created_at', { ascending: false });
    if (operatorFilter) query = query.eq('operator_id', operatorFilter);
    const { data, error } = await query;
    if (!error && data) {
      setBlockingsState(data.map(b => ({
        id: b.id, msisdn: b.msisdn, imei: b.imei || '', imsi: b.imsi || '',
        cellId: b.cell_id || '', operator: b.operator || b.operator_id || '—',
        operatorId: b.operator_id, blockedBy: b.blocked_by || null,
        blockerName: "AAR", reason: b.reason,
        source: b.source, interOpSource: null,
        notes: b.notes, active: b.active, date: b.date || b.created_at?.slice(0,10),
        created_at: b.created_at,
        autoFlagged: b.auto_flagged || [],
      })));
    }
    setLoading(false);
  }, [operatorFilter]);

  const toBlocking = useCallback((b) => ({
    id: b.id, msisdn: b.msisdn, imei: b.imei || '', imsi: b.imsi || '',
    cellId: b.cell_id || '', operator: b.operator || b.operator_id || '—',
    operatorId: b.operator_id, blockedBy: b.blocked_by || null,
    blockerName: "AAR", reason: b.reason,
    source: b.source, interOpSource: null,
    notes: b.notes, active: b.active, date: b.date || b.created_at?.slice(0,10),
    created_at: b.created_at,
    autoFlagged: b.auto_flagged || [],
  }), []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const ch = supabase.channel('blockings-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blockings' }, payload => {
        const b = payload.new;
        setBlockingsState(p => [toBlocking(b), ...p.filter(x => x.id !== b.id)]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'blockings' }, payload => {
        const b = payload.new;
        setBlockingsState(p => p.map(x => x.id === b.id ? toBlocking(b) : x));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [toBlocking]);

  const setBlockings = useCallback((u) => setBlockingsState(u), []);

  const createBlocking = useCallback(async (blocking, operatorId) => {
    const { data, error } = await supabase.from('blockings').insert([{
      operator: blocking.operator || 'AAR Telco',
      operator_id: blocking.operator_id || operatorId || null,
      msisdn: blocking.msisdn,
      reason: blocking.reason,
      source: blocking.source || 'analyst',
      notes: blocking.notes || null, active: true, auto_flagged: [],
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const unblock = useCallback(async (id) => {
    await supabase.from('blockings').update({
      active: false
    }).eq('id', id);
    setBlockingsState(p => p.map(b => b.id === id ? { ...b, active: false } : b));
  }, []);

  const reblock = useCallback(async (id) => {
    await supabase.from('blockings').update({ active: true }).eq('id', id);
    setBlockingsState(p => p.map(b => b.id === id ? { ...b, active: true } : b));
  }, []);

  return { blockings, setBlockings, loading, createBlocking, unblock, reblock, refetch: fetch };
}

// ── Control Lists ─────────────────────────────────────────────────────────
export function useControlLists(operatorFilter) {
  const [blacklist, setBlacklistState] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    let query = supabase.from('control_lists')
      .select('*')
      .order('created_at', { ascending: false });
    if (operatorFilter) query = query.eq('operator_id', operatorFilter);
    const { data, error } = await query;
    const ENTRY_TYPE_NORM = { msisdn:"MSISDN", imsi:"IMSI", imei:"IMEI", imei_prefix:"IMEI Préfixe", prefix:"Préfixe numéro", cell_id:"Cell ID / BTS", pays:"Pays", cdr_field:"Champ CDR" };
    if (!error && data) {
      setBlacklistState(data.map(e => ({
        id: e.id, list: e.list, type: ENTRY_TYPE_NORM[e.type] || e.type, value: e.value,
        reason: e.reason, addedBy: e.added_by,
        date: e.created_at?.slice(0,10), active: e.active,
        matches: e.matches || 0, lastMatch: e.last_match,
        daysLeft: e.days_left, operatorId: e.operator_id,
      })));
    }
    setLoading(false);
  }, [operatorFilter]);

  useEffect(() => { fetch(); }, [fetch]);
  const setBlacklist = useCallback((u) => setBlacklistState(u), []);

  const addEntry = useCallback(async (entry, operatorId) => {
    const { data, error } = await supabase.from('control_lists').insert([{
      operator_id: operatorId, list: entry.list,
      type: entry.type, value: entry.value,
      reason: entry.reason, active: true, matches: 0,
      days_left: entry.daysLeft || null,
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const toggleEntry = useCallback(async (id, active) => {
    await supabase.from('control_lists').update({ active }).eq('id', id);
    setBlacklistState(p => p.map(e => e.id === id ? { ...e, active } : e));
  }, []);

  const deleteEntry = useCallback(async (id) => {
    await supabase.from('control_lists').delete().eq('id', id);
    setBlacklistState(p => p.filter(e => e.id !== id));
  }, []);

  const moveEntry = useCallback(async (id, listType) => {
    await supabase.from('control_lists').update({ list: listType }).eq('id', id);
    setBlacklistState(p => p.map(e => e.id === id ? { ...e, list: listType } : e));
  }, []);

  return { blacklist, setBlacklist, loading, addEntry, toggleEntry, deleteEntry, moveEntry, refetch: fetch };
}

// ── Complaints ────────────────────────────────────────────────────────────
export function useComplaints(operatorFilter) {
  const [complaints, setComplaintsState] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    let query = supabase.from('complaints').select('*').order('created_at', { ascending: false });
    if (operatorFilter) query = query.eq('operator_id', operatorFilter);
    const { data, error } = await query;
    if (!error && data) {
      setComplaintsState(data.map(c => ({
        id: c.id, msisdn: c.msisdn_reported,
        tag: c.ai_tag || c.fraud_type || 'Fraude',
        summary: c.ai_summary, raw: c.raw_text,
        date_raw: c.created_at?.slice(0,16).replace('T',' '),
        confidence: c.confidence || 0, status: c.status,
        operatorId: c.operator_id,
      })));
    }
    setLoading(false);
  }, [operatorFilter]);

  useEffect(() => { fetch(); }, [fetch]);
  const setComplaints = useCallback((u) => setComplaintsState(u), []);

  return { complaints, setComplaints, loading, refetch: fetch };
}

// ── Save audit log ────────────────────────────────────────────────────────
export async function saveLogToSupabase(log) {
  try {
    await supabase.from('audit_logs').insert([{
      user_id: log.userId || log.user_id || null,
      user_name: log.userName || 'System',
      user_role: log.userRole || 'system',
      action: log.action,
      entity: log.entity,
      entity_id: log.entityId ? String(log.entityId) : null,
      detail: log.detail,
      page: log.page,
    }]);
  } catch(e) {
    // Silently fail
  }
}

// ══════════════════════════════════════════════════════════════
// FULL LINK — Nouveaux hooks
// ══════════════════════════════════════════════════════════════

// ============================================================
// SHIELD — FULL LINK — Hooks manquants à ajouter dans useSupabase.js
// Coller à la suite des hooks existants
// ============================================================


// ─────────────────────────────────────────────────────────────
// useDashboardStats — stats calculées depuis alerts, rules, cases
// ─────────────────────────────────────────────────────────────
export function useDashboardStats(operatorId = null) {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [byType, setByType] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filtre opérateur optionnel
      const opFilter = (q) => operatorId ? q.eq('operator_id', operatorId) : q;

      // Détections aujourd'hui
      const { count: detectionsToday } = await opFilter(
        supabase.from('alerts').select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString())
      );

      // Fraudes bloquées (total)
      const { count: fraudsBlocked } = await opFilter(
        supabase.from('alerts').select('*', { count: 'exact', head: true })
          .eq('status', 'blocked')
      );

      // Règles actives
      const { count: activeRules } = await supabase
        .from('rules').select('*', { count: 'exact', head: true })
        .eq('active', true).eq('scope', 'telco');

      // Cases ouverts
      const { count: openCases } = await opFilter(
        supabase.from('cases').select('*', { count: 'exact', head: true })
          .neq('status', 'closed')
      );

      // Blocages actifs
      const { count: activeBlockings } = await opFilter(
        supabase.from('blockings').select('*', { count: 'exact', head: true })
          .eq('active', true)
      );

      setStats({
        detectionsToday: detectionsToday || 0,
        fraudsBlocked: fraudsBlocked || 0,
        activeRules: activeRules || 0,
        openCases: openCases || 0,
        activeBlockings: activeBlockings || 0,
        revenueSaved: (fraudsBlocked || 0) * 4200, // ~4200 XOF valeur moy par fraude bloquée
      });

      // Tendance 7 jours — alertes par jour
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: trendRaw } = await opFilter(
        supabase.from('alerts').select('created_at, status')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: true })
      );

      if (trendRaw) {
        const grouped = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          grouped[key] = { date: key, total: 0, blocked: 0 };
        }
        trendRaw.forEach(a => {
          const key = a.created_at.slice(0, 10);
          if (grouped[key]) {
            grouped[key].total++;
            if (a.status === 'blocked') grouped[key].blocked++;
          }
        });
        setTrend(Object.values(grouped));
      }

      // Par type de fraude
      const { data: alertsAll } = await opFilter(
        supabase.from('alerts').select('fraud_type')
      );
      if (alertsAll) {
        const typeCount = {};
        alertsAll.forEach(a => {
          typeCount[a.fraud_type] = (typeCount[a.fraud_type] || 0) + 1;
        });
        setByType(Object.entries(typeCount).map(([name, value]) => ({ name, value })));
      }

      // Alertes récentes
      const { data: recent } = await opFilter(
        supabase.from('alerts').select(`
          id, msisdn, fraud_type, status, risk_score, created_at,
          triggered_rule_name
        `).order('created_at', { ascending: false }).limit(5)
      );
      setRecentAlerts(recent || []);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { stats, trend, byType, recentAlerts, loading, error, refetch: fetch };
}


// ─────────────────────────────────────────────────────────────
// useSimProfile — profil complet SIM depuis AAR DB
// ─────────────────────────────────────────────────────────────
export function useSimProfile(msisdn) {
  const [profile, setProfile] = useState(null);
  const [cdrHistory, setCdrHistory] = useState([]);
  const [simSwaps, setSimSwaps] = useState([]);
  const [relatedAlerts, setRelatedAlerts] = useState([]);
  const [cellMovements, setCellMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (targetMsisdn) => {
    const target = targetMsisdn || msisdn;
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      // Profil complet depuis v_sim_profile
      const { data: simData } = await supabase
        .from('v_sim_profile')
        .select('*')
        .eq('msisdn', target)
        .single();

      // CDR Voice récent (10 derniers)
      const { data: cdrVoice } = await supabase
        .from('cdr_voice')
        .select('*')
        .eq('msisdn', target)
        .order('start_time', { ascending: false })
        .limit(10);

      // Historique SIM Swaps
      const { data: swaps } = await supabase
        .from('sim_swap_history')
        .select('*')
        .eq('msisdn', target)
        .order('swap_date', { ascending: false });

      // Alertes liées à ce MSISDN
      const { data: alerts } = await supabase
        .from('alerts')
        .select('id, fraud_type, status, risk_score, detected_at, triggered_rule_name')
        .eq('msisdn', target)
        .order('detected_at', { ascending: false })
        .limit(10);

      // Déplacements Cell IDs
      const { data: cellsRaw } = await supabase
        .from('cdr_voice')
        .select('cell_id, start_time')
        .eq('msisdn', target)
        .order('start_time', { ascending: false })
        .limit(100);

      // Grouper par cell_id
      const cellCount = {};
      (cellsRaw || []).forEach(r => {
        cellCount[r.cell_id] = (cellCount[r.cell_id] || 0) + 1;
      });
      const cellMovementsData = Object.entries(cellCount).map(([cellId, count]) => ({
        cellId,
        count,
      })).sort((a, b) => b.count - a.count);

      setProfile(simData || null);
      setCdrHistory(cdrVoice || []);
      setSimSwaps(swaps || []);
      setRelatedAlerts(alerts || []);
      setCellMovements(cellMovementsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [msisdn]);

  useEffect(() => { if (msisdn) fetch(msisdn); }, [msisdn, fetch]);

  return { profile, cdrHistory, simSwaps, relatedAlerts, cellMovements, loading, error, fetchProfile: fetch };
}


// ─────────────────────────────────────────────────────────────
// useSimProfiles — liste des SIM réelles d'un distributeur (sim_profiles)
// ─────────────────────────────────────────────────────────────
export function useSimProfiles(distributorId) {
  const [sims, setSims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);

  const fetch = useCallback(async () => {
    if (!distributorId) { setSims([]); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('sim_profiles')
        .select('id, msisdn, imsi, imei, status, risk_score, swap_count, activated_at, calls_24h, distributor_id')
        .eq('distributor_id', distributorId)
        .order('risk_score', { ascending: false })
        .limit(2000);
      if (err) throw err;
      setSims(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [distributorId]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateStatus = useCallback(async (simId, status) => {
    setUpdating(simId);
    try {
      const { error: err } = await supabase
        .from('sim_profiles')
        .update({ status })
        .eq('id', simId);
      if (err) throw err;
      setSims(prev => prev.map(s => s.id === simId ? { ...s, status } : s));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setUpdating(null);
    }
  }, []);

  const updateAllStatus = useCallback(async (status) => {
    if (!distributorId) return false;
    try {
      const { error: err } = await supabase
        .from('sim_profiles')
        .update({ status })
        .eq('distributor_id', distributorId);
      if (err) throw err;
      setSims(prev => prev.map(s => ({ ...s, status })));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [distributorId]);

  return { sims, loading, error, updating, updateStatus, updateAllStatus, refetch: fetch };
}


// ─────────────────────────────────────────────────────────────
// useSimProfilesSearch — recherche globale sim_profiles (toutes SIM, tous distributeurs)
// ─────────────────────────────────────────────────────────────
export function useSimProfilesSearch({ search = "", status = "all", operatorId = null, page = 0, pageSize = 50 } = {}) {
  const [sims, setSims] = useState([]);
  const [distributorNames, setDistributorNames] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from('sim_profiles').select('*', { count: 'exact' });
      if (search) {
        const s = search.replace(/\s/g, '');
        q = q.or(`msisdn.ilike.%${s}%,id.ilike.%${search}%,imsi.ilike.%${search}%,imei.ilike.%${search}%`);
      }
      if (status !== 'all') q = q.eq('status', status);
      if (operatorId) q = q.eq('operator_id', operatorId);
      q = q.order('risk_score', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error: err, count } = await q;
      if (err) throw err;
      setSims(data || []);
      setTotal(count || 0);

      // Résoudre les noms de distributeurs pour affichage
      const distIds = [...new Set((data || []).map(s => s.distributor_id).filter(Boolean))];
      if (distIds.length > 0) {
        const { data: dists } = await supabase.from('distributors').select('id, name').in('id', distIds);
        const map = {};
        (dists || []).forEach(d => { map[d.id] = d.name; });
        setDistributorNames(map);
      } else {
        setDistributorNames({});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, status, operatorId, page, pageSize]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateStatus = useCallback(async (simId, newStatus) => {
    setUpdating(simId);
    try {
      const { error: err } = await supabase.from('sim_profiles').update({ status: newStatus }).eq('id', simId);
      if (err) throw err;
      setSims(prev => prev.map(s => s.id === simId ? { ...s, status: newStatus } : s));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setUpdating(null);
    }
  }, []);

  const bulkUpdateStatus = useCallback(async (simIds, newStatus) => {
    if (!simIds.length) return false;
    try {
      const { error: err } = await supabase.from('sim_profiles').update({ status: newStatus }).in('id', simIds);
      if (err) throw err;
      setSims(prev => prev.map(s => simIds.includes(s.id) ? { ...s, status: newStatus } : s));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  return { sims, distributorNames, total, loading, error, updating, updateStatus, bulkUpdateStatus, refetch: fetch };
}


// ─────────────────────────────────────────────────────────────
// useCases — CRUD complet cases
// ─────────────────────────────────────────────────────────────
export function useCases(operatorId = null) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });
      if (operatorId) q = q.eq('operator_id', operatorId);
      const { data, error: err } = await q;
      if (err) throw err;
      setCases(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    const sub = supabase.channel('cases-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, fetch)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [fetch]);

  const createCase = async (caseData) => {
    const { data, error: err } = await supabase
      .from('cases').insert([caseData]).select().single();
    if (err) throw err;
    await fetch();
    return data;
  };

  const updateCase = async (id, updates) => {
    const { data, error: err } = await supabase
      .from('cases').update(updates).eq('id', id).select().single();
    if (err) throw err;
    await fetch();
    return data;
  };

  const deleteCase = async (id) => {
    const { error: err } = await supabase.from('cases').delete().eq('id', id);
    if (err) throw err;
    await fetch();
  };

  const closeCase = (id) => updateCase(id, { status: 'closed' });
  const escalateCase = (id) => updateCase(id, { status: 'escalated', priority: 'critical' });

  return { cases, loading, error, refetch: fetch, createCase, updateCase, deleteCase, closeCase, escalateCase };
}


// ─────────────────────────────────────────────────────────────
// useCellAnomalies — lecture + actions depuis cell_anomalies
// ─────────────────────────────────────────────────────────────
export function useCellAnomalies(operatorId = null) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('cell_anomalies')
        .select('*')
        .order('detected_at', { ascending: false });
      if (operatorId) q = q.eq('operator_id', operatorId);
      const { data, error: err } = await q;
      if (err) throw err;
      setAnomalies(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Stats par cell_id depuis cdr_voice
  const fetchCellStats = async (cellId) => {
    const { data } = await supabase
      .from('cdr_voice')
      .select('msisdn, duration, fraud_flag, tx_status, duration_sec')
      .eq('cell_id', cellId)
      .limit(500);
    if (!data) return null;
    const uniqueSims = new Set(data.map(r => r.msisdn)).size;
    const suspiciousSims = data.filter(r => r.tx_status === "failed" || r.fraud_flag === true).length;
    const avgDuration = data.reduce((s, r) => s + (r.duration_sec || r.duration || 0), 0) / (data.length || 1);
    return { uniqueSims, suspiciousSims, avgDuration: Math.round(avgDuration), callCount: data.length };
  };

  return { anomalies, loading, error, refetch: fetch, fetchCellStats };
}


// ─────────────────────────────────────────────────────────────
// useReportsStats — statistiques pour la page Rapports
// ─────────────────────────────────────────────────────────────
export function useReportsStats(operatorId = null, period = 30) {
  const [stats, setStats] = useState(null);
  const [byType, setByType] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - period);

      const opFilter = (q) => operatorId ? q.eq('operator_id', operatorId) : q;

      // Totaux
      const { count: totalAlerts } = await opFilter(
        supabase.from('alerts').select('*', { count: 'exact', head: true })
          .gte('created_at', since.toISOString())
      );
      const { count: blocked } = await opFilter(
        supabase.from('alerts').select('*', { count: 'exact', head: true })
          .eq('status', 'blocked').gte('created_at', since.toISOString())
      );
      const { count: falsePositives } = await opFilter(
        supabase.from('alerts').select('*', { count: 'exact', head: true })
          .eq('status', 'false_positive').gte('created_at', since.toISOString())
      );

      setStats({
        totalAlerts: totalAlerts || 0,
        blocked: blocked || 0,
        falsePositives: falsePositives || 0,
        detectionRate: totalAlerts ? Math.round((blocked / totalAlerts) * 100) : 0,
        revenueSaved: (blocked || 0) * 4200,
        avgRiskScore: 0, // calculé ci-dessous
      });

      // Par type
      const { data: alertsRaw } = await opFilter(
        supabase.from('alerts').select('fraud_type, status, risk_score')
          .gte('created_at', since.toISOString())
      );
      if (alertsRaw) {
        const typeMap = {};
        alertsRaw.forEach(a => {
          if (!typeMap[a.fraud_type]) typeMap[a.fraud_type] = { name: a.fraud_type, total: 0, blocked: 0, fp: 0, scoreSum: 0 };
          typeMap[a.fraud_type].total++;
          if (a.status === 'blocked') typeMap[a.fraud_type].blocked++;
          if (a.status === 'false_positive') typeMap[a.fraud_type].fp++;
          typeMap[a.fraud_type].scoreSum += a.risk_score || 0;
        });
        setByType(Object.values(typeMap).map(t => ({
          ...t,
          avgScore: t.total ? Math.round(t.scoreSum / t.total) : 0,
        })));
      }

      // Tendance par semaine
      const { data: trendRaw } = await opFilter(
        supabase.from('alerts').select('created_at, status')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: true })
      );
      if (trendRaw) {
        const weekMap = {};
        trendRaw.forEach(a => {
          const d = new Date(a.created_at);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const key = weekStart.toISOString().slice(0, 10);
          if (!weekMap[key]) weekMap[key] = { week: key, total: 0, blocked: 0 };
          weekMap[key].total++;
          if (a.status === 'blocked') weekMap[key].blocked++;
        });
        setTrend(Object.values(weekMap));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [operatorId, period]);

  useEffect(() => { fetch(); }, [fetch]);
  return { stats, byType, trend, loading, error, refetch: fetch };
}


// ─────────────────────────────────────────────────────────────
// useBillingStats — facturation calculée par opérateur
// ─────────────────────────────────────────────────────────────
export function useBillingStats() {
  const [billing, setBilling] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const firstDay = new Date();
      firstDay.setDate(1);
      firstDay.setHours(0, 0, 0, 0);

      // Opérateurs
      const { data: operators } = await supabase.from('operators').select('*');

      // Alertes, blocages, IA usage par opérateur ce mois
      const results = await Promise.all((operators || []).map(async (op) => {
        const { count: alerts } = await supabase
          .from('alerts').select('*', { count: 'exact', head: true })
          .eq('operator_id', op.id)
          .gte('created_at', firstDay.toISOString());

        const { count: blockings } = await supabase
          .from('blockings').select('*', { count: 'exact', head: true })
          .eq('operator_id', op.id)
          .eq('active', true);

        const { data: aiData } = await supabase
          .from('ai_usage').select('tokens_used, cost_usd')
          .eq('operator_id', op.id)
          .gte('used_at', firstDay.toISOString());

        const aiTokens = (aiData || []).reduce((s, r) => s + r.tokens_used, 0);
        const aiCost = (aiData || []).reduce((s, r) => s + parseFloat(r.cost_usd), 0);

        const baseFee = op.plan === 'enterprise' ? 2500 : op.plan === 'pro' ? 1200 : 500; // USD
        const alertsFee = Math.round((alerts || 0) * 0.5);
        const total = baseFee + alertsFee + Math.round(aiCost);

        return {
          operator: op,
          alerts: alerts || 0,
          blockings: blockings || 0,
          aiTokens,
          aiCost: aiCost.toFixed(2),
          baseFee,
          alertsFee,
          total,
          status: 'pending',
        };
      }));

      setBilling(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { billing, loading, error, refetch: fetch };
}


// ─────────────────────────────────────────────────────────────
// useAuditLogs — depuis table audit_logs AAR DB
// ─────────────────────────────────────────────────────────────
export function useAuditLogs(filters = {}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filtersStr = useMemo(() => JSON.stringify(filters), [filters]);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters.limit || 100);

      if (filters.operatorId) q = q.eq('operator_id', filters.operatorId);
      if (filters.userId) q = q.eq('user_id', filters.userId);
      if (filters.action) q = q.eq('action', filters.action);
      if (filters.since) q = q.gte('created_at', filters.since);

      const { data, error: err } = await q;
      if (err) throw err;
      setLogs(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtersStr]);

  useEffect(() => { fetch(); }, [fetch]);
  return { logs, loading, error, refetch: fetch };
}


// ─────────────────────────────────────────────────────────────
// useUDFFields — lecture + gestion depuis udf_fields
// ─────────────────────────────────────────────────────────────
export function useUDFFields() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('udf_fields')
        .select('*')
        .order('cat').order('label');
      if (err) throw err;
      setFields(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createField = async (fieldData) => {
    const { data, error: err } = await supabase
      .from('udf_fields').insert([fieldData]).select().single();
    if (err) throw err;
    await fetch();
    return data;
  };

  const updateField = async (id, updates) => {
    const { data, error: err } = await supabase
      .from('udf_fields').update(updates).eq('id', id).select().single();
    if (err) throw err;
    await fetch();
    return data;
  };

  const toggleField = async (id, enabled) => updateField(id, { enabled });

  const deleteField = async (id) => {
    const { error: err } = await supabase.from('udf_fields').delete().eq('id', id);
    if (err) throw err;
    await fetch();
  };

  return { fields, loading, error, refetch: fetch, createField, updateField, toggleField, deleteField };
}