const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/deviceMiddleware');
const { listNotifications, markRead, markAllRead } = require('../controllers/notificationController');

// Every role has its own bell.
router.use(authMiddleware);

router.get('/', listNotifications);
router.post('/read-all', markAllRead);
router.post('/:id/read', markRead);

module.exports = router;
