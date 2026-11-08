const supabase = require('../config/supabase');
const { notify } = require('./notify');
const { logAction } = require('./audit');

const PAYMENT_STATUSES = ['active', 'debtor'];

// Marks a student as debtor, or active again after a payment, and tells the student.
// Returns { notFound }, { error } or { paymentStatus, changed }.
const changePaymentStatus = async (studentId, paymentStatus, actorId) => {
  const { data: current, error: readError } = await supabase
    .from('users').select('id, payment_status').eq('id', studentId).eq('role', 'Student').maybeSingle();
  if (readError) return { error: readError };
  if (!current) return { notFound: true };
  if (current.payment_status === paymentStatus) return { paymentStatus, changed: false };

  const { error } = await supabase.from('users').update({ payment_status: paymentStatus }).eq('id', studentId);
  if (error) return { error };

  await notify(studentId, paymentStatus === 'debtor' ? 'payment.debtor' : 'payment.cleared', {});
  await logAction(actorId, 'student.payment_status', 'user', studentId, { paymentStatus });
  return { paymentStatus, changed: true };
};

module.exports = { PAYMENT_STATUSES, changePaymentStatus };
