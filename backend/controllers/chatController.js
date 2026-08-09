const Chat = require('../models/Chat');
const { GoogleGenAI } = require('@google/genai');
const Groq = require('groq-sdk');
const crypto = require('crypto');

const GEMINI_MODEL = 'gemini-2.0-flash';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Helper to generate a 6-character uppercase share code (e.g., X7K9P2)
function generateShareCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

exports.getChats = async (req, res) => {
  try {
    // Only return chats where the logged-in user is a participant
    const chats = await Chat.find({ participants: req.user.id })
      .sort({ updatedAt: -1 })
      .select('title shareCode updatedAt');
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
      messages: []
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

    // Add current user to participants list if they aren't already in it
    if (!chat.participants.includes(req.user.id)) {
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
    
    // Safety check: ensure user is a participant
    if (!chat.participants.includes(req.user.id)) {
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
    
    // Safety check: only creator can delete the chat
    if (chat.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Only the creator can delete this chat.' });
    }

    await Chat.findByIdAndDelete(req.params.id);
    res.json({ message: 'Chat deleted' });
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

    // Safety check: ensure user is a participant
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Update title if it's the first message
    if (chat.messages.length === 0) {
      chat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
    }

    // Add user message
    chat.messages.push({ role: 'user', content: message });
    await chat.save();

    // Broadcast user message to room in real-time
    if (req.io && chat.shareCode) {
      req.io.to(chat.shareCode).emit('chat-updated', chat);
    }

    let modelResponseContent = "";

    // 1. Try Groq API
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const history = chat.messages.map(msg => ({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.content
        }));

        const chatCompletion = await groq.chat.completions.create({
          messages: history,
          model: GROQ_MODEL,
        });

        modelResponseContent = chatCompletion.choices[0]?.message?.content || "No response generated.";
      } catch (groqError) {
        console.error("Groq Error:", groqError.message);
        modelResponseContent = `Groq API Error: ${groqError.message}`;
      }
    } 
    // 2. Try Gemini API
    else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const history = chat.messages.slice(0, -1).map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                ...history,
                { role: 'user', parts: [{ text: message }] }
            ]
        });
        
        modelResponseContent = response.text;
      } catch (aiError) {
        console.error("Gemini AI Error:", aiError.message);
        modelResponseContent = `Gemini API Error: ${aiError.message}`;
      }
    } 
    // 3. Fallback Mock response
    else {
       modelResponseContent = "I am a mock response because no API key is configured. Please add GROQ_API_KEY or GEMINI_API_KEY to backend/.env";
    }

    // Add model message
    chat.messages.push({ role: 'model', content: modelResponseContent });
    await chat.save();

    // Broadcast updated chat with AI response in real-time
    if (req.io && chat.shareCode) {
      req.io.to(chat.shareCode).emit('chat-updated', chat);
    }

    res.json(chat);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message });
  }
};
