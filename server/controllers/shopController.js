const supabase = require('../config/supabase');
const db = require('../databaseService');
const emailService = require('../services/emailService');
const { hashCode, generateCode } = require('../utils/codes');
const { handleDbError, sendRpcError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { ORDER_ITEMS_SELECT, toOrderItem, orderAction } = require('../utils/orders');

const toProduct = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  imageUrl: p.image_url,
  price: p.price,
  isAvailable: p.is_available,
});

const toOrder = (o) => ({
  id: o.id,
  items: o.order_items.map(toOrderItem),
  total: o.total,
  status: o.status,
  purchasedAt: o.purchased_at,
  completedAt: o.completed_at,
  cancelledAt: o.cancelled_at,
});

// The cart sent by the browser: [{ productId, quantity }]. Prices are never sent, the server reads them.
const parseCart = (items) => {
  if (!Array.isArray(items) || !items.length || items.length > 20) return null;
  const valid = items.every((i) => isUuid(i?.productId) && Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= 10);
  if (!valid) return null;
  return items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
};

// Archived products are hidden; unavailable ones are shown but cannot be bought.
const listProducts = async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, image_url, price, is_available')
    .eq('is_archived', false)
    .order('price', { ascending: true });
  if (error) return handleDbError(error, res);
  res.json({ products: data.map(toProduct) });
};

// Step 1: check the cart and the balance, then email a one-time code.
const initiatePurchase = async (req, res) => {
  const cart = parseCart(req.body.items);
  if (!cart) return res.status(400).json({ message: 'Cart is empty or invalid' });

  const student = await db.findUserById(req.user.id);
  if (!student?.email) return res.status(400).json({ message: 'Your account has no email address' });

  const code = generateCode();
  const { data, error } = await supabase.rpc('create_purchase_verification', {
    p_student_id: student.id,
    p_items: cart,
    p_code_hash: hashCode(code),
  });
  if (error) return handleDbError(error, res);
  if (!data.success) return sendRpcError(res, data);

  try {
    await emailService.sendPurchaseCodeEmail(student.email, code, data.summary);
  } catch (emailError) {
    console.error('Failed to send purchase code to:', student.email, emailError.message);
    // Without the email the attempt is useless, and must not block the next one.
    await supabase.from('purchase_verifications').delete().eq('id', data.verification_id);
    return res.status(500).json({ message: 'Failed to send the confirmation email. Try again later.' });
  }

  res.status(201).json({
    verificationId: data.verification_id,
    expiresAt: data.expires_at,
    total: data.total,
  });
};

// Step 2: check the code; the SQL function then takes the coins and creates the order.
const confirmPurchase = async (req, res) => {
  const { id } = req.params;
  const { code } = req.body;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid purchase request' });
  if (!/^\d{6}$/.test(String(code || ''))) return res.status(400).json({ message: 'Enter the 6-digit code' });

  const { data, error } = await supabase.rpc('confirm_purchase', {
    p_verification_id: id,
    p_student_id: req.user.id,
    p_code_hash: hashCode(String(code)),
  });
  if (error) return handleDbError(error, res);
  if (!data.success) return sendRpcError(res, data);

  res.status(data.already_done ? 200 : 201).json({ orderId: data.order_id, balance: data.balance });
};

// "My Purchases": a student sees only their own orders.
const listMyOrders = async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select(`id, total, status, purchased_at, completed_at, cancelled_at, ${ORDER_ITEMS_SELECT}`)
    .eq('student_id', req.user.id)
    .order('purchased_at', { ascending: false });
  if (error) return handleDbError(error, res);
  res.json({ orders: data.map(toOrder) });
};

// A student can cancel their own order until the admin has handed it over; the coins come back.
const cancelMyOrder = orderAction('cancel_order', 'p_actor_id');

module.exports = { listProducts, initiatePurchase, confirmPurchase, listMyOrders, cancelMyOrder };
