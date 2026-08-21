const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'model', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { _id: false });

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  extractedText: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'New Chat'
  },
  shareCode: {
    type: String,
    unique: true,
    index: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  messages: [messageSchema],
  documents: [documentSchema],
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
