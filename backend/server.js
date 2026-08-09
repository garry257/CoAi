const express = require('express');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const chatRoutes = require('./routes/chatRoutes');

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

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/chats', chatRoutes);

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

// Connect to MongoDB & Start Server
const PORT = process.env.PORT || 5005;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatgpt-clone';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => console.log(`Server & WebSockets running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
