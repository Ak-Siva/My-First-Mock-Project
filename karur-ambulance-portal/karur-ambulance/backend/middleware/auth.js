// middleware/auth.js
// JWT authentication & role-based access control middleware

const { verifyToken } = require('../utils/jwtService');
const User = require('../models/User');

/**
 * Protect route — requires valid JWT in Authorization header.
 * Attaches the full user document to req.user.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id).select('-otp');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Token valid but user not found.' });
    }
    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Account not verified. Please complete OTP verification.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

/**
 * Role guard — use after `protect`.
 * Example: authorize('driver')  or  authorize('civilian', 'driver')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. This route is restricted to: ${roles.join(', ')}.`,
    });
  }
  next();
};

module.exports = { protect, authorize };
