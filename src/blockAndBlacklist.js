// ── SHIELD — Fonction centralisée Bloquer + Blacklister ─────────────────────
// Bloque le MSISDN dans alerts + crée un blocking + blackliste MSISDN + IMEI
// Cell ID : blacklisté automatiquement seulement si >= 15 fraudes confirmées sur ce cell

import { supabase } from "./supabase.js";

export async function blockAndBlacklist({ msisdn, imei, imsi, cell_id, operatorId, reason, addLog, cellBlacklistThreshold = 15 }) {
  const results = { blocking: null, lists: [], alertsUpdated: 0, cellBlacklisted: false, errors: [] };

  try {
    // 1. Bloquer toutes les alertes actives du MSISDN
    if (msisdn) {
      await supabase.from("alerts")
        .update({ status: "blocked", updated_at: new Date().toISOString() })
        .eq("msisdn", msisdn)
        .in("status", ["alert", "investigating"]);
    }

    // 2. Créer le blocage dans blockings
    const { data: blocking, error: blockErr } = await supabase.from("blockings").insert([{
      operator: operatorId || 'AAR Telco',
      msisdn: msisdn || null,
      reason: reason || "Blocage manuel SHIELD",
      source: "analyst",
      active: true,
      created_at: new Date().toISOString(),
    }]).select().single();
    if (blockErr) results.errors.push(`Blocking: ${blockErr.message}`);
    else results.blocking = blocking;

    // 3. Blacklister MSISDN
    if (msisdn) {
      const { error: e1 } = await supabase.from("control_lists").insert([{
        operator_id: operatorId || null,
        list: "blacklist", type: "msisdn",
        value: msisdn,
        reason: reason || "Blocage — MSISDN blacklisté",
        active: true,
      }]);
      if (e1) results.errors.push(`BL MSISDN: ${e1.message}`);
      else results.lists.push("msisdn");
    }

    // 4. Blacklister IMEI si disponible
    if (imei) {
      const { error: e2 } = await supabase.from("control_lists").insert([{
        operator_id: operatorId || null,
        list: "blacklist", type: "imei",
        value: imei,
        reason: reason || "Blocage — IMEI blacklisté",
        active: true,
      }]);
      if (e2) results.errors.push(`BL IMEI: ${e2.message}`);
      else results.lists.push("imei");
    }

    // 5. Cell ID — blacklisté SEULEMENT si >= cellBlacklistThreshold fraudes confirmées sur ce cell
    if (cell_id) {
      const { count } = await supabase.from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("cell_id", cell_id)
        .in("status", ["blocked", "investigating"]);

      if (count >= cellBlacklistThreshold) {
        const { error: e3 } = await supabase.from("control_lists").insert([{
          operator_id: operatorId || null,
          list: "blacklist", type: "cell_id",
          value: cell_id,
          reason: `Auto-blacklist Cell — ${count} fraudes confirmées sur ${cell_id}`,
          active: true,
        }]);
        if (e3) results.errors.push(`BL Cell: ${e3.message}`);
        else { results.lists.push("cell_id"); results.cellBlacklisted = true; }
      }
    }

    // 6. Log
    const listsSummary = results.lists.join(", ");
    const cellInfo = results.cellBlacklisted ? ` + Cell ${cell_id} BL auto` : "";
    addLog?.("BLOCK_AND_BLACKLIST", "msisdn", msisdn,
      `Blocage + BL [${listsSummary}]${cellInfo} — ${reason}`,
      "SHIELD"
    );

    return results;

  } catch (err) {
    results.errors.push(err.message);
    return results;
  }
}