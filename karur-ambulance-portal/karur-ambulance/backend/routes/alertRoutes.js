// routes/alertRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createAlert, getAlerts, acceptAlert, rejectAlert, completeAlert,
} = require('../controllers/alertController');

router.use(protect); // All alert routes require authentication

router.post('/', createAlert);
router.get('/', getAlerts);
router.patch('/:id/accept', acceptAlert);
router.patch('/:id/reject', rejectAlert);
router.patch('/:id/complete', completeAlert);

module.exports = router;
