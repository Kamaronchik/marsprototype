const supabase = require('../config/supabase');

// Journal of important actions. A failed log must never break the action itself.
const logAction = async (actorId, action, entity, entityId, details = null) => {
  const { error } = await supabase
    .from('audit_log')
    .insert({ actor_id: actorId, action, entity, entity_id: entityId, details });
  if (error) console.error('Audit log error:', error.message);
};

module.exports = { logAction };
