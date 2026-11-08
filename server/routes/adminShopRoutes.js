const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { listProducts, createProduct, updateProduct, deleteProduct, uploadImage } = require('../controllers/productController');
const { listOrders, deliverOrder, cancelOrder } = require('../controllers/orderController');

// Every route here: logged in + role Admin.
router.use(authMiddleware, requireRole('Admin'));

router.get('/products', listProducts);
router.post('/products', createProduct);
router.patch('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/image', express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '2mb' }), uploadImage);

router.get('/orders', listOrders);
router.post('/orders/:id/deliver', deliverOrder);
router.post('/orders/:id/cancel', cancelOrder);

module.exports = router;
