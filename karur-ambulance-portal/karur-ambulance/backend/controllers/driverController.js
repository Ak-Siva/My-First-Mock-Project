// controllers/driverController.js
// Driver-specific actions: location update, status change, list all drivers

const User = require('../models/User');

/**
 * PATCH /api/drivers/location
 * Driver updates their real-time GPS coordinates.
 * Called periodically by the frontend (every ~5 s).
 */
const updateLocation = async (req, res) => {
  try {
    const { longitude, latitude } = req.body;
    if (!longitude || !latitude) {
      return res.status(400).json({ success: false, message: 'longitude and latitude are required.' });
    }

    const driver = req.user;
    driver.location = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };
    await driver.save();

    // Broadcast location to all connected civilians
    if (req.io) {
      req.io.to('civilians').emit('driver_location_updated', {
        driverId: driver._id,
        ambulanceNumber: driver.ambulanceNumber,
        name: driver.name,
        status: driver.status,
        location: driver.location,
      });
    }

    return res.status(200).json({ success: true, message: 'Location updated.' });
  } catch (error) {
    console.error('updateLocation error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PATCH /api/drivers/status
 * Driver manually changes their availability status.
 */
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['available', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    req.user.status = status;
    await req.user.save();

    if (req.io) {
      req.io.to('civilians').emit('driver_status_updated', {
        driverId: req.user._id,
        status,
      });
    }

    return res.status(200).json({ success: true, message: `Status updated to ${status}.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/drivers
 * Public-ish: return all active (non-offline) drivers for the map.
 * Only visible to verified civilians and drivers.
 */
const getAllDrivers = async (req, res) => {
  try {
    const drivers = await User.find(
      { role: 'driver', status: { $in: ['available', 'busy'] } },
      'name ambulanceNumber status location updatedAt'
    );
    return res.status(200).json({ success: true, drivers });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { updateLocation, updateStatus, getAllDrivers };
