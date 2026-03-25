// controllers/authController.js
// Handles registration, OTP sending, and OTP verification

const User = require('../models/User');
const { sendOTP } = require('../utils/smsService');
const { generateToken } = require('../utils/jwtService');

/**
 * POST /api/auth/send-otp
 * Create or fetch the user and send an OTP to their mobile.
 */
const sendOTPHandler = async (req, res) => {
  try {
    const { name, mobile, role, ambulanceNumber, licenseNumber } = req.body;

    // Basic validation
    if (!name || !mobile || !role) {
      return res.status(400).json({ success: false, message: 'Name, mobile, and role are required.' });
    }
    if (!['civilian', 'driver'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be civilian or driver.' });
    }
    if (role === 'driver' && !ambulanceNumber) {
      return res.status(400).json({ success: false, message: 'Ambulance number is required for drivers.' });
    }

    // Upsert user (find by mobile + role, create if absent)
    let user = await User.findOne({ mobile, role });
    if (!user) {
      user = new User({ name, mobile, role, ambulanceNumber, licenseNumber });
    } else {
      // Update mutable fields on re-login
      user.name = name;
      if (ambulanceNumber) user.ambulanceNumber = ambulanceNumber;
    }

    // Generate OTP and persist
    const otp = user.generateOTP();
    await user.save();

    // Send SMS (or mock)
    const smsResult = await sendOTP(mobile, otp);
    if (!smsResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
    }

    const response = {
      success: true,
      message: `OTP sent to +91${mobile}`,
      userId: user._id,
    };

    // In dev/mock mode, include OTP in response for easy testing
    if (process.env.OTP_MOCK === 'true') {
      response.devOtp = otp;
      response.note = 'Mock mode: OTP included in response for testing';
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('sendOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify the submitted OTP and return a JWT if valid.
 */
const verifyOTPHandler = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: 'userId and otp are required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const result = user.verifyOTP(otp.toString().trim());
    if (!result.valid) {
      await user.save(); // Persist incremented attempt count
      return res.status(400).json({ success: false, message: result.reason });
    }

    // Mark driver as available on first login
    if (user.role === 'driver') {
      user.status = 'available';
    }
    await user.save();

    const token = generateToken({ id: user._id, role: user.role, mobile: user.mobile });

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        ambulanceNumber: user.ambulanceNumber,
        status: user.status,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('verifyOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/auth/me
 * Return the current authenticated user profile.
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      mobile: req.user.mobile,
      role: req.user.role,
      ambulanceNumber: req.user.ambulanceNumber,
      status: req.user.status,
      isVerified: req.user.isVerified,
      location: req.user.location,
    },
  });
};

module.exports = { sendOTPHandler, verifyOTPHandler, getMe };
