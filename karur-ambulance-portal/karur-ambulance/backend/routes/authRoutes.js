// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { sendOTPHandler, verifyOTPHandler, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Rate-limit OTP requests: max 5 per 15 min per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/send-otp', otpLimiter, sendOTPHandler);
router.post('/verify-otp', verifyOTPHandler);
router.get('/me', protect, getMe);

module.exports = router;
