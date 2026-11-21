// Errors returned by the SQL functions in supabase/migrations/005_rpc_shop.sql: code -> [HTTP status, message].
const RPC_ERRORS = {
  INVALID_AMOUNT: [400, 'Amount must be a positive whole number'],
  FORBIDDEN: [403, 'Forbidden'],
  STUDENT_NOT_FOUND: [404, 'Student not found'],
  TEACHER_NOT_FOUND: [404, 'Teacher not found'],
  INSUFFICIENT_POOL: [400, 'Not enough coins in your pool. Ask an administrator for more.'],
  NOT_YOUR_STUDENT: [403, 'This student is not in your group'],
  ALREADY_DONE: [409, 'This month\'s top-up was already run'],
  INVALID_ITEMS: [400, 'Cart is empty or invalid'],
  PRODUCT_UNAVAILABLE: [409, 'A product in your cart is not available'],
  INSUFFICIENT_COINS: [400, 'Not enough coins'],
  TOO_SOON: [429, 'Please wait before requesting a new code'],
  VERIFICATION_NOT_FOUND: [404, 'Purchase request not found'],
  CODE_USED: [409, 'This code was already used. Start the purchase again.'],
  CODE_EXPIRED: [400, 'Verification code has expired. Request a new one.'],
  TOO_MANY_ATTEMPTS: [429, 'Too many failed attempts. Request a new code.'],
  INVALID_CODE: [400, 'Invalid verification code'],
  NOT_ENOUGH_QUESTIONS: [409, 'Not enough questions for this course and level yet'],
  ALREADY_OPEN: [409, 'You already have an open challenge'],
  CHALLENGE_TAKEN: [409, 'This challenge is no longer open'],
  BATTLE_NOT_FOUND: [404, 'Battle not found'],
  BATTLE_NOT_ACTIVE: [409, 'This battle is not running'],
  NOT_STARTED: [409, 'This question was not opened yet'],
  ALREADY_ANSWERED: [409, 'This question was already answered'],
  WRONG_ROUND: [409, 'Answer the current question first'],
  ORDER_NOT_FOUND: [404, 'Order not found'],
  ORDER_NOT_PENDING: [409, 'Only a pending order can be changed'],
};

// Answer for {success: false, error} from a SQL function. "code" lets the frontend pick a translation.
const sendRpcError = (res, result) => {
  const [status, message] = RPC_ERRORS[result.error] || [500, 'Unexpected error'];
  res.status(status).json({
    message,
    code: result.error,
    remaining: result.remaining,
    poolBalance: result.pool_balance,
    waitSeconds: result.wait_seconds,
    orderStatus: result.status,
  });
};

const handleDbError = (error, res) => {
  console.error('Shop API error:', error);
  return res.status(500).json({ message: 'Database error' });
};

module.exports = { sendRpcError, handleDbError };
