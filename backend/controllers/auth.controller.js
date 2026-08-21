const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'syncgpt_secret_token_key_123';

exports.register = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username: username.toLowerCase(),
      password: hashedPassword
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: newUser.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile (no password).
 */
exports.getMe = async (req, res) => {
  try {
    // Guest users: return profile from JWT payload directly (no DB user)
    if (req.user.isGuest) {
      return res.json({
        success: true,
        data: {
          _id: req.user.id,
          username: req.user.username,
          name: req.user.username,
          email: '',
          role: 'guest',
          isGuest: true,
          guestChatId: req.user.guestChatId,
          shareCode: req.user.shareCode,
        },
      });
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        name: user.name || user.username,
        email: user.email || '',
        role: user.role || 'student',
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
/**
 * POST /api/auth/guest-join
 * Issues a short-lived guest token tied to a specific share code.
 * The guest can only access that shared chat — not any other part of the app.
 */
exports.guestJoin = async (req, res) => {
  const Chat = require('../models/chat.model');
  const { shareCode, displayName } = req.body;

  if (!shareCode) {
    return res.status(400).json({ error: 'Share code is required' });
  }

  try {
    const chat = await Chat.findOne({ shareCode: shareCode.trim().toUpperCase() });
    if (!chat) {
      return res.status(404).json({ error: 'No chat found with this share code. Please check and try again.' });
    }

    // Create a temporary guest identity (no DB user — just a signed JWT)
    const guestName = (displayName || 'Guest').trim().substring(0, 30);
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const token = jwt.sign(
      { id: guestId, username: guestName, isGuest: true, guestChatId: chat._id.toString(), shareCode: chat.shareCode },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      username: guestName,
      isGuest: true,
      guestChatId: chat._id.toString(),
      chatTitle: chat.title || 'Shared Chat',
      shareCode: chat.shareCode,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
