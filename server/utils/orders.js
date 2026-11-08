const supabase = require('../config/supabase');
const { handleDbError, sendRpcError } = require('./apiErrors');
const { isUuid } = require('./validate');

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
const orderAction = (rpcName, actorParam) => async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid order id' });

  const { data, error } = await supabase.rpc(rpcName, { p_order_id: id, [actorParam]: req.user.id });
  if (error) return handleDbError(error, res);
  if (!data.success) return sendRpcError(res, data);

  res.json({ message: 'Done' });
};

module.exports = { ORDER_ITEMS_SELECT, toOrderItem, orderAction };
