const express = require('express');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

// Config
const connectDB = require('./config/db');
const env = require('./config/env');

// Routes
const chatRoutes = require('./routes/chatRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboard.routes');
const resumeRoutes = require('./routes/resume.routes');
const candidateProfileRoutes = require('./routes/candidateProfile.routes');
const interviewRoutes = require('./routes/interview.routes');
const ragRoutes = require('./routes/rag.routes');
const researchRoutes = require('./routes/research.routes');

// Middleware
const rateLimiter = require('./middleware/rateLimit.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware to attach Socket.io instance to request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Security & parsing middleware
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for SPA compatibility
app.use(cors());
app.use(express.json());
app.use(rateLimiter);

// Routes — existing
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);

// Routes — COAI Interview Copilot (Phase 1)
app.use('/api/dashboard', dashboardRoutes);

// Routes — Phase 2: Resume & Candidate Profile
app.use('/api/resumes', resumeRoutes);
app.use('/api/candidate-profile', candidateProfileRoutes);

// Routes — Phase 3: Interview Configuration & Engine
app.use('/api/interviews', interviewRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/research', researchRoutes);

// Serve Frontend static build files in production
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback for SPA routing in production
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && req.method === 'GET') {
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  }
  next();
});

// Socket.io Connection Handlers
io.on('connection', (socket) => {
  socket.on('join-room', ({ shareCode, username }) => {
    if (shareCode) {
      socket.join(shareCode);
      if (username) {
        socket.to(shareCode).emit('user-joined', username);
      }
    }
  });

  socket.on('leave-room', (shareCode) => {
    if (shareCode) {
      socket.leave(shareCode);
    }
  });
});

// Handle multer file size errors before global handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File size must be under 5 MB' });
  }
  if (err.statusCode === 400 && err.message.includes('PDF')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

// Global error handler — must be AFTER all routes
app.use(errorHandler);

// Connect to MongoDB & Start Server
const PORT = env.PORT;

connectDB().then(() => {
  const { setupVoiceSockets } = require('./controllers/voiceController');
  setupVoiceSockets(server);

  server.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT} (${env.NODE_ENV})`);
    console.log(`[Server] COAI Dashboard API: http://localhost:${PORT}/api/dashboard/summary`);
  });
});
