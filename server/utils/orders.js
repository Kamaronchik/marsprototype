const supabase = require('../config/supabase');
const { handleDbError, sendRpcError } = require('./apiErrors');
const { isUuid } = require('./validate');
const { notify, notifyAdmins } = require('./notify');

// Select this inside an orders query to get the products of each order.
const ORDER_ITEMS_SELECT = 'order_items(product_name, product_image_url, unit_price, quantity)';

const toOrderItem = (i) => ({
  productName: i.product_name,
  productImageUrl: i.product_image_url,
  unitPrice: i.unit_price,
  quantity: i.quantity,
});

// Builds a handler for an order action done in a SQL function (deliver, cancel).
// actorParam is the name of the "who does it" argument of that function.
// afterSuccess({ order, actor }) runs once the action worked: it sends the notifications.
const orderAction = (rpcName, actorParam, afterSuccess) => async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid order id' });

  const { data, error } = await supabase.rpc(rpcName, { p_order_id: id, [actorParam]: req.user.id });
  if (error) return handleDbError(error, res);
  if (!data.success) return sendRpcError(res, data);

  if (afterSuccess) {
    const { data: order } = await supabase
      .from('orders')
      .select('id, student_id, total, student:users!orders_student_id_fkey(full_name)')
      .eq('id', id)
      .single();
    if (order) await afterSuccess({ order, actor: req.user });
  }
  res.json({ message: 'Done' });
};

// Who hears about a delivered or cancelled order.
const tellStudentDelivered = ({ order }) =>
  notify(order.student_id, 'order.delivered', { total: order.total }, { link: '/student/purchases' });

const tellAboutCancel = async ({ order, actor }) => {
  if (actor.role === 'Admin') {
    return notify(order.student_id, 'order.cancelled', { total: order.total }, { link: '/student/purchases' });
  }
  return notifyAdmins('order.cancelled_by_student', { studentName: order.student.full_name, total: order.total }, { link: '/admin/orders' });
};

module.exports = { ORDER_ITEMS_SELECT, toOrderItem, orderAction, tellStudentDelivered, tellAboutCancel };
