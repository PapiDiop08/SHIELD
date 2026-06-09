import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase.js';

// ── Operators ─────────────────────────────────────────────────────────────
export function useOperators() {
  const [operators, setOperatorsState] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from('operators').select('*').order('name');
    if (!error && data) {
      setOperatorsState(data.map(o => ({
        id: o.id, name: o.name, code: o.code, country: o.country,
        active: o.active, contact: o.contact_email, contractStart: o.created_at?.slice(0,10),
        monthlyFee: o.monthly_fee, perAlertFee: o.per_alert_fee,
        perBlockFee: o.per_block_fee, perAIFee: o.per_ai_fee,
        packs: { mm: o.pack_mm, ai: o.pack_ai, deepai: o.pack_deepai, api: o.pack_api },
        slaEnabled: o.sla_enabled,
        slaConfig: { critical: o.sla_critical, high: o.sla_high, medium: o.sla_medium },
        rules: 0, detections: 0, blocked: 0,
      })));
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
      sla_medium: op.slaConfig?.medium || 24, active: true,
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const updateOperator = useCallback(async (id, updates) => {
    const { error } = await supabase.from('operators').update({
      name: updates.name, code: updates.code, active: updates.active,
      contact_email: updates.contact, monthly_fee: updates.monthlyFee,
      pack_mm: updates.packs?.mm, pack_ai: updates.packs?.ai,
      sla_enabled: updates.slaEnabled, sla_critical: updates.slaConfig?.critical,
      sla_high: updates.slaConfig?.high, sla_medium: updates.slaConfig?.medium,
    }).eq('id', id);
    if (!error) await fetch();
    return { error };
  }, [fetch]);

  return { operators, setOperators, loading, createOperator, updateOperator, refetch: fetch };
}

// ── Users ─────────────────────────────────────────────────────────────────
export function useUsers() {
  const [users, setUsersState] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from('users').select('*').order('name');
    if (!error && data) {
      setUsersState(data.map(u => ({
        id: u.id, name: u.name, email: u.email, role: u.role,
        operator: u.operator_id, operatorId: u.operator_id,
        active: u.active, lastLogin: u.last_login || '—',
        avatar: u.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase(),
        createdAt: u.created_at?.slice(0,10),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  const setUsers = useCallback((u) => setUsersState(u), []);

  const createUser = useCallback(async (user, operatorId) => {
    const { data, error } = await supabase.from('users').insert([{
      name: user.name, email: user.email, role: user.role,
      operator_id: operatorId || null, active: true,
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const updateUser = useCallback(async (id, updates) => {
    const { error } = await supabase.from('users').update({
      role: updates.role, active: updates.active,
    }).eq('id', id);
    if (!error) await fetch();
    return { error };
  }, [fetch]);

  return { users, setUsers, loading, createUser, updateUser, refetch: fetch };
}

// ── Alerts ────────────────────────────────────────────────────────────────
export function useAlerts(operatorFilter) {
  const [alerts, setAlertsState] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    let query = supabase
      .from('alerts')
      .select('*, operators(name)')
      .order('detected_at', { ascending: false })
      .limit(200);
    if (operatorFilter) query = query.eq('operator_id', operatorFilter);
    const { data, error } = await query;
    if (!error && data) {
      setAlertsState(data.map(a => ({
        id: a.id,
        time: new Date(a.detected_at).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}),
        createdAt: a.detected_at,
        msisdn: a.msisdn, imei: a.imei || '', imsi: a.imsi || '',
        cellId: a.cell_id || '', type: a.fraud_type, severity: a.severity,
        score: a.score, status: a.status, assignedTo: a.assigned_to,
        caseId: a.case_id, operatorId: a.operator_id,
        operator: a.operators?.name || '—',
        rule: a.rule_id || '', notes: a.notes || [],
      })));
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
      .order('triggered', { ascending: false });
    if (!error && data) {
      setRulesState(data.map(r => ({
        id: r.id, name: r.name, type: r.fraud_type,
        severity: r.severity, action: r.action, scope: r.scope || 'global',
        active: r.active, triggered: r.triggered || 0, blocked: r.blocked || 0,
        conditions: r.conditions || [], createdBy: r.created_by,
        creatorName: 'GFM',
        date: r.created_at?.slice(0,10), operator: r.operator_id, caseId: r.case_id,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  const setRules = useCallback((u) => setRulesState(u), []);

  const createRule = useCallback(async (rule) => {
    const { data, error } = await supabase.from('rules').insert([{
      name: rule.name,
      fraud_type: rule.type,
      severity: rule.severity,
      action: rule.action,
      scope: rule.scope || 'global',
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
      name: rule.name, fraud_type: rule.type, severity: rule.severity,
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
      .select('*, operators(name)')
      .order('blocked_at', { ascending: false });
    if (operatorFilter) query = query.eq('operator_id', operatorFilter);
    const { data, error } = await query;
    if (!error && data) {
      setBlockingsState(data.map(b => ({
        id: b.id, msisdn: b.msisdn, imei: b.imei || '', imsi: b.imsi || '',
        cellId: b.cell_id || '', operator: b.operators?.name || '—',
        operatorId: b.operator_id, blockedBy: b.blocked_by,
        blockerName: 'GFM', reason: b.reason,
        source: b.source, interOpSource: b.inter_op_source,
        notes: b.notes, active: b.active, date: b.blocked_at,
        autoFlagged: b.auto_flagged || [],
      })));
    }
    setLoading(false);
  }, [operatorFilter]);

  useEffect(() => { fetch(); }, [fetch]);
  const setBlockings = useCallback((u) => setBlockingsState(u), []);

  const createBlocking = useCallback(async (blocking, operatorId) => {
    const { data, error } = await supabase.from('blockings').insert([{
      operator_id: operatorId, msisdn: blocking.msisdn,
      imei: blocking.imei || null, reason: blocking.reason,
      source: blocking.source || 'analyst',
      inter_op_source: blocking.interOpSource || null,
      notes: blocking.notes || null, active: true, auto_flagged: [],
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const unblock = useCallback(async (id) => {
    await supabase.from('blockings').update({
      active: false, unblocked_at: new Date().toISOString()
    }).eq('id', id);
    setBlockingsState(p => p.map(b => b.id === id ? { ...b, active: false } : b));
  }, []);

  const reblock = useCallback(async (id) => {
    await supabase.from('blockings').update({ active: true, unblocked_at: null }).eq('id', id);
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
    if (!error && data) {
      setBlacklistState(data.map(e => ({
        id: e.id, list: e.list_type, type: e.entry_type, value: e.value,
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
      operator_id: operatorId, list_type: entry.list,
      entry_type: entry.type, value: entry.value,
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
    await supabase.from('control_lists').update({ list_type: listType }).eq('id', id);
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