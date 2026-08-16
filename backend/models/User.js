const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  // COAI Interview Copilot fields (optional for backward compatibility)
  email: {
    type: String,
    unique: true,
    sparse: true, // allows null/undefined — existing users without email still work
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student',
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
