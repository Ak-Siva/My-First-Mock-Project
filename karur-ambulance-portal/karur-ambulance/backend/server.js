// server.js
// Entry point: Express + Socket.io + MongoDB

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const { verifyToken } = require('./utils/jwtService');

// --- Route imports ---
const authRoutes = require('./routes/authRoutes');
const alertRoutes = require('./routes/alertRoutes');
const driverRoutes = require('./routes/driverRoutes');

// --- App setup ---
const app = express();
const server = http.createServer(app);

// --- Socket.io ---
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Inject io into every request so controllers can emit events
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// --- Middleware ---
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});
app.use('/api', globalLimiter);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/drivers', driverRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', service: 'Karur Ambulance API', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// --- Socket.io Logic ---
io.use((socket, next) => {
  // Authenticate socket connections via JWT query param
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication token missing.'));
  try {
    const decoded = verifyToken(token);
    socket.user = decoded;
    next();
  } catch {
    next(new Error('Invalid or expired token.'));
  }
});

io.on('connection', (socket) => {
  const { id: userId, role } = socket.user;
  console.log(`🔌 ${role} connected: ${userId} (socket: ${socket.id})`);

  // Join role-specific rooms for targeted broadcasts
  socket.join(role === 'driver' ? 'drivers' : 'civilians');
  // Join personal room for direct notifications
  socket.join(`${role}_${userId}`);

  // Driver: periodic location push (frontend emits this every ~5 s)
  socket.on('driver_location', (data) => {
    io.to('civilians').emit('driver_location_updated', {
      driverId: userId,
      ...data,
    });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 ${role} disconnected: ${userId}`);
  });
});

// --- Start ---
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚑 Karur Ambulance API running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🔧 OTP mode: ${process.env.OTP_MOCK === 'true' ? 'MOCK (dev)' : 'LIVE (Twilio)'}\n`);
  });
});

module.exports = { app, io };
