// controllers/alertController.js
// SOS alert lifecycle: create, list, accept, reject, complete

const Alert = require('../models/Alert');
const User = require('../models/User');

/**
 * POST /api/alerts
 * Civilian sends an SOS alert. Rate-limited to 1 per 2 minutes.
 */
const createAlert = async (req, res) => {
  try {
    const civilian = req.user;
    if (civilian.role !== 'civilian') {
      return res.status(403).json({ success: false, message: 'Only civilians can send SOS alerts.' });
    }

    // Rate limiting: max 1 alert per 2 minutes
    if (civilian.lastAlertSentAt) {
      const cooldown = 2 * 60 * 1000; // 2 minutes
      if (Date.now() - civilian.lastAlertSentAt.getTime() < cooldown) {
        const waitSec = Math.ceil(
          (cooldown - (Date.now() - civilian.lastAlertSentAt.getTime())) / 1000
        );
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSec} seconds before sending another alert.`,
        });
      }
    }

    const { longitude, latitude, address } = req.body;
    if (!longitude || !latitude) {
      return res.status(400).json({ success: false, message: 'Location coordinates are required.' });
    }

    const alert = new Alert({
      civilian: civilian._id,
      civilianName: civilian.name,
      civilianMobile: civilian.mobile,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address: address || '',
      },
    });
    await alert.save();

    // Update civilian rate-limit fields
    civilian.lastAlertSentAt = new Date();
    civilian.alertCount += 1;
    await civilian.save();

    // Emit via Socket.io (injected into req by server.js)
    if (req.io) {
      req.io.to('drivers').emit('new_sos_alert', {
        alertId: alert._id,
        civilianName: civilian.name,
        civilianMobile: civilian.mobile,
        location: alert.location,
        createdAt: alert.createdAt,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'SOS alert sent. Nearby drivers have been notified.',
      alert: {
        id: alert._id,
        status: alert.status,
        createdAt: alert.createdAt,
      },
    });
  } catch (error) {
    console.error('createAlert error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/alerts
 * Driver: see all pending alerts
 * Civilian: see own alert history
 */
const getAlerts = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'civilian') {
      query.civilian = req.user._id;
    } else if (req.user.role === 'driver') {
      query.status = 'pending';
    }
    const alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json({ success: true, alerts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PATCH /api/alerts/:id/accept
 * Driver accepts a pending alert.
 */
const acceptAlert = async (req, res) => {
  try {
    const driver = req.user;
    if (driver.role !== 'driver') {
      return res.status(403).json({ success: false, message: 'Only drivers can accept alerts.' });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
    if (alert.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Alert is already ${alert.status}.` });
    }

    alert.status = 'accepted';
    alert.driver = driver._id;
    alert.driverName = driver.name;
    alert.driverMobile = driver.mobile;
    alert.ambulanceNumber = driver.ambulanceNumber;
    alert.acceptedAt = new Date();
    await alert.save();

    // Update driver status
    driver.status = 'busy';
    await driver.save();

    // Notify the specific civilian in real-time
    if (req.io) {
      req.io.to(`civilian_${alert.civilian}`).emit('alert_accepted', {
        alertId: alert._id,
        driverName: driver.name,
        ambulanceNumber: driver.ambulanceNumber,
        message: '🚑 An ambulance is on the way! Please clear the path.',
      });
      // Broadcast updated driver status to civilians room
      req.io.to('civilians').emit('driver_status_updated', {
        driverId: driver._id,
        status: 'busy',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Alert accepted. Civilian has been notified.',
      alert,
    });
  } catch (error) {
    console.error('acceptAlert error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PATCH /api/alerts/:id/reject
 * Driver rejects an alert.
 */
const rejectAlert = async (req, res) => {
  try {
    const driver = req.user;
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
    if (alert.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Alert is already ${alert.status}.` });
    }

    alert.status = 'rejected';
    alert.rejectedAt = new Date();
    await alert.save();

    if (req.io) {
      req.io.to(`civilian_${alert.civilian}`).emit('alert_rejected', {
        alertId: alert._id,
        message: 'The driver was unable to respond. Notifying other drivers.',
      });
    }

    return res.status(200).json({ success: true, message: 'Alert rejected.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PATCH /api/alerts/:id/complete
 * Driver marks an alert as completed (arrived / case handled).
 */
const completeAlert = async (req, res) => {
  try {
    const driver = req.user;
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });

    alert.status = 'completed';
    alert.completedAt = new Date();
    await alert.save();

    driver.status = 'available';
    await driver.save();

    if (req.io) {
      req.io.to(`civilian_${alert.civilian}`).emit('alert_completed', {
        alertId: alert._id,
        message: 'Ambulance has arrived. Stay safe!',
      });
      req.io.to('civilians').emit('driver_status_updated', {
        driverId: driver._id,
        status: 'available',
      });
    }

    return res.status(200).json({ success: true, message: 'Alert marked as completed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { createAlert, getAlerts, acceptAlert, rejectAlert, completeAlert };
