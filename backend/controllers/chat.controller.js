const Chat = require('../models/chat.model');
const { GoogleGenAI } = require('@google/genai');
const Groq = require('groq-sdk');
const crypto = require('crypto');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const GEMINI_MODEL = 'gemini-3.6-flash';
const GROQ_MODEL = 'openai/gpt-oss-20b';

// Multer — memory storage, accept PDF/TXT/DOCX up to 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|txt|md|doc|docx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, MD, DOC, DOCX files are allowed'));
    }
  },
});
exports.upload = upload;

// Helper to generate a 6-character uppercase share code (e.g., X7K9P2)
function generateShareCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Extract text from uploaded file buffer
async function extractText(file) {
  if (file.mimetype === 'application/pdf' || file.originalname.match(/\.pdf$/i)) {
    const data = await pdfParse(file.buffer);
    return data.text;
  }
  // TXT / MD / plain
  return file.buffer.toString('utf-8');
}

/**
 * Fix: Mongoose stores participants as ObjectId objects.
 * req.user.id is a plain string. ObjectId === string is always FALSE.
 * Use .toString() comparison to correctly check membership.
 */
function isParticipant(chat, userId) {
  if (!userId) return false;
  return chat.participants.some(p => p.toString() === userId.toString());
}


exports.getChats = async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user.id })
      .sort({ updatedAt: -1 })
      .select('title shareCode updatedAt documents');
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createChat = async (req, res) => {
  try {
    const shareCode = generateShareCode();
    const newChat = new Chat({
      title: 'New Chat',
      shareCode,
      creator: req.user.id,
      participants: [req.user.id],
      messages: [],
      documents: [],
    });
    await newChat.save();
    res.status(201).json(newChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.joinChatByCode = async (req, res) => {
  const { shareCode } = req.body;
  if (!shareCode) {
    return res.status(400).json({ error: 'Share code is required' });
  }

  try {
    const chat = await Chat.findOne({ shareCode: shareCode.trim().toUpperCase() });
    if (!chat) {
      return res.status(404).json({ error: 'No chat found with this share code' });
    }

    if (!isParticipant(chat, req.user.id)) {
      chat.participants.push(req.user.id);
      await chat.save();
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getChatById = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (!isParticipant(chat, req.user.id) && !req.user.isGuest) {
      return res.status(403).json({ error: 'Access denied. You are not a participant in this chat.' });
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (chat.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Only the creator can delete this chat.' });
    }

    await Chat.findByIdAndDelete(req.params.id);
    res.json({ message: 'Chat deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/chats/:id/documents
 * Upload a document (PDF/TXT) into the chat for RAG context
 */
exports.uploadDocument = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (!isParticipant(chat, req.user.id) && !req.user.isGuest) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const extractedText = await extractText(req.file);

    if (!extractedText || extractedText.trim().length < 10) {
      return res.status(400).json({ error: 'Could not extract readable text from the file' });
    }

    // Limit to first 8000 chars to stay within context limits
    const trimmedText = extractedText.trim().substring(0, 8000);

    chat.documents.push({
      name: req.file.originalname,
      extractedText: trimmedText,
    });
    await chat.save();

    // Return just the document list (not full text to save bandwidth)
    const docs = chat.documents.map(d => ({ _id: d._id, name: d.name, uploadedAt: d.uploadedAt }));
    res.status(201).json({ message: 'Document uploaded', documents: docs });
  } catch (error) {
    console.error('[Chat] uploadDocument error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/chats/:id/documents/:docId
 * Remove a document from the chat's RAG context
 */
exports.deleteDocument = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (!isParticipant(chat, req.user.id) && !req.user.isGuest) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const docIndex = chat.documents.findIndex(d => d._id.toString() === req.params.docId);
    if (docIndex === -1) return res.status(404).json({ error: 'Document not found' });

    chat.documents.splice(docIndex, 1);
    await chat.save();

    const docs = chat.documents.map(d => ({ _id: d._id, name: d.name, uploadedAt: d.uploadedAt }));
    res.json({ message: 'Document removed', documents: docs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    const chat = await Chat.findById(id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (!isParticipant(chat, req.user.id) && !req.user.isGuest) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Update title if it's the first message
    if (chat.messages.length === 0) {
      chat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
    }

    // Add user message
    chat.messages.push({ role: 'user', content: message });
    await chat.save();

    // Broadcast user message
    if (req.io && chat.shareCode) {
      req.io.to(chat.shareCode).emit('chat-updated', chat);
    }

    // Build RAG context from uploaded documents
    let ragContext = '';
    if (chat.documents && chat.documents.length > 0) {
      ragContext = chat.documents.map(d =>
        `=== Document: ${d.name} ===\n${d.extractedText}`
      ).join('\n\n');
    }

    // Build final prompt (prepend document context if present)
    const systemPrompt = ragContext
      ? `You are a helpful AI assistant. The user has uploaded the following documents for reference. Use them to answer questions accurately.\n\n${ragContext}\n\n---\nNow answer the user's question based on the above documents and your general knowledge.`
      : null;

    const userHistory = chat.messages.slice(0, -1);
    let modelResponseContent = '';

    // 1. Try Groq API
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const groqMessages = [];
        if (systemPrompt) groqMessages.push({ role: 'system', content: systemPrompt });
        userHistory.forEach(msg => groqMessages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.content,
        }));
        groqMessages.push({ role: 'user', content: message });

        const chatCompletion = await groq.chat.completions.create({
          messages: groqMessages,
          model: GROQ_MODEL,
        });

        modelResponseContent = chatCompletion.choices[0]?.message?.content || 'No response generated.';
      } catch (groqError) {
        console.error('Groq Error:', groqError.message);
        modelResponseContent = `Groq API Error: ${groqError.message}`;
      }
    }
    // 2. Try Gemini API
    else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const contents = [];
        if (systemPrompt) {
          contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
          contents.push({ role: 'model', parts: [{ text: 'Understood. I will use the provided documents to answer questions.' }] });
        }
        userHistory.forEach(msg => contents.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));
        contents.push({ role: 'user', parts: [{ text: message }] });

        const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents });
        modelResponseContent = response.text;
      } catch (aiError) {
        console.error('Gemini AI Error:', aiError.message);
        modelResponseContent = `Gemini API Error: ${aiError.message}`;
      }
    }
    // 3. Fallback
    else {
      modelResponseContent = 'I am a mock response because no API key is configured. Please add GROQ_API_KEY or GEMINI_API_KEY to backend/.env';
    }

    // Add model message
    chat.messages.push({ role: 'model', content: modelResponseContent });
    await chat.save();

    // Broadcast
    if (req.io && chat.shareCode) {
      req.io.to(chat.shareCode).emit('chat-updated', chat);
    }

    res.json(chat);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
};
