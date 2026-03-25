// models/User.js
// Mongoose schema for both civilians and ambulance drivers

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'],
  },
  role: {
    type: String,
    enum: ['civilian', 'driver'],
    required: true,
  },

  // Driver-specific fields
  ambulanceNumber: {
    type: String,
    trim: true,
    uppercase: true,
    // Required only for drivers — validated in controller
  },
  licenseNumber: {
    type: String,
    trim: true,
  },

  // OTP fields
  otp: {
    code: String,
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
  },

  // Auth state
  isVerified: { type: Boolean, default: false },

  // Driver status
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'offline',
  },

  // Real-time location (drivers only)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [78.0766, 10.9601], // Default: Karur center
    },
  },

  // Alert rate limiting
  lastAlertSentAt: Date,
  alertCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Geospatial index for location-based queries
userSchema.index({ location: '2dsphere' });
userSchema.index({ role: 1, status: 1 });

// Update `updatedAt` on save
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method: generate OTP
userSchema.methods.generateOTP = function () {
  // In mock mode, always use 123456
  const code = process.env.OTP_MOCK === 'true'
    ? '123456'
    : Math.floor(100000 + Math.random() * 900000).toString();

  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
  this.otp = {
    code,
    expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
    attempts: 0,
  };
  return code;
};

// Instance method: verify OTP
userSchema.methods.verifyOTP = function (inputCode) {
  if (!this.otp || !this.otp.code) return { valid: false, reason: 'No OTP generated' };
  if (this.otp.expiresAt < Date.now()) return { valid: false, reason: 'OTP expired' };
  if (this.otp.attempts >= 5) return { valid: false, reason: 'Too many attempts' };
  if (this.otp.code !== inputCode) {
    this.otp.attempts += 1;
    return { valid: false, reason: 'Invalid OTP' };
  }
  // Clear OTP after successful verification
  this.otp = undefined;
  this.isVerified = true;
  return { valid: true };
};

module.exports = mongoose.model('User', userSchema);
