const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { ORDER_ITEMS_SELECT, toOrderItem, orderAction } = require('../utils/orders');

const STATUSES = ['Pending', 'Completed', 'Cancelled'];

const toClient = (o) => ({
  id: o.id,
  studentId: o.student_id,
  studentName: o.student?.full_name,
  studentEmail: o.student?.email,
  items: o.order_items.map(toOrderItem),
  total: o.total,
  status: o.status,
  purchasedAt: o.purchased_at,
  completedAt: o.completed_at,
  completedBy: o.completed_by,
  cancelledAt: o.cancelled_at,
});

// All shop orders of all students, newest first. Optional filter: ?status=Pending
const listOrders = async (req, res) => {
  const { status } = req.query;
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  let query = supabase
    .from('orders')
    .select(`id, student_id, total, status, purchased_at, completed_at, completed_by, cancelled_at, student:users!orders_student_id_fkey(full_name, email), ${ORDER_ITEMS_SELECT}`)
    .order('purchased_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return handleDbError(error, res);
  res.json({ orders: data.map(toClient) });
};

const deliverOrder = orderAction('deliver_order', 'p_admin_id');
const cancelOrder = orderAction('cancel_order', 'p_actor_id');

module.exports = { listOrders, deliverOrder, cancelOrder };
