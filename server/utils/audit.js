const supabase = require('../config/supabase');
const { currentContext } = require('./requestContext');

// The database says "no such column" until migration 018_audit_system.sql is applied.
const isMissingColumn = (error) => error?.code === '42703' || error?.code === 'PGRST204';

// Journal of important actions. A failed log must never break the action itself.
// extra (all optional): oldValue, newValue (what it was and what it became), reasonCode, reasonComment.
// The IP and the browser come from the current request, the time and the actor's role from the database.
const logAction = async (actorId, action, entity, entityId, details = null, extra = {}) => {
  const { ip, userAgent } = currentContext();
  const row = { actor_id: actorId, action, entity, entity_id: entityId, details };

  const { error } = await supabase.from('audit_log').insert({
    ...row,
    old_value: extra.oldValue ?? null,
    new_value: extra.newValue ?? null,
    reason_code: extra.reasonCode ?? null,
    reason_comment: extra.reasonComment ?? null,
    ip_address: ip ?? null,
    user_agent: userAgent ?? null,
  });
  if (!error) return;

  // The new columns are not there yet: keep the entry in the old shape instead of losing it.
  if (isMissingColumn(error)) {
    const { error: retryError } = await supabase.from('audit_log').insert(row);
    if (!retryError) return;
    console.error('Audit log error:', retryError.message);
    return;
  }
  console.error('Audit log error:', error.message);
};

module.exports = { logAction };
