const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`[DB] Connected to MongoDB: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('[DB] MongoDB connection closed (app termination)');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
