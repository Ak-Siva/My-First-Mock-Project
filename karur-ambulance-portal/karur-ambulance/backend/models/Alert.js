// models/Alert.js
// Schema for emergency SOS alerts sent by civilians

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  civilian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  civilianName: String,
  civilianMobile: String,

  // Location when alert was sent
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: String, // Reverse-geocoded address (optional)
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
    default: 'pending',
  },

  // Assigned driver
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  driverName: String,
  driverMobile: String,
  ambulanceNumber: String,

  // Timestamps for workflow tracking
  acceptedAt: Date,
  completedAt: Date,
  rejectedAt: Date,

  // Notes or additional info
  notes: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

alertSchema.index({ location: '2dsphere' });
alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ civilian: 1, createdAt: -1 });

alertSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Alert', alertSchema);
