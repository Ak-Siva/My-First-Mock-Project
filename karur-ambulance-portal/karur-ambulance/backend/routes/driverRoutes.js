// routes/driverRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { updateLocation, updateStatus, getAllDrivers } = require('../controllers/driverController');

router.get('/', protect, getAllDrivers);
router.patch('/location', protect, authorize('driver'), updateLocation);
router.patch('/status', protect, authorize('driver'), updateStatus);

module.exports = router;
