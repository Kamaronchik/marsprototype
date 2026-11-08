const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { limiter } = require('../utils/rateLimit');
const { listProducts, initiatePurchase, confirmPurchase, listMyOrders, cancelMyOrder } = require('../controllers/shopController');

const initiateLimiter = limiter(10, 'Too many purchase requests. Try again in 15 minutes.');
const codeLimiter = limiter(10, 'Too many code attempts. Try again in 15 minutes.');

// Every route here: logged in + role Student.
router.use(authMiddleware, requireRole('Student'));

router.get('/products', listProducts);
router.post('/purchases', initiateLimiter, initiatePurchase);
router.post('/purchases/:id/confirm', codeLimiter, confirmPurchase);
router.get('/orders', listMyOrders);
router.post('/orders/:id/cancel', cancelMyOrder);

module.exports = router;
