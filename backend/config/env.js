require('dotenv').config();

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5005,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/coai-interview',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'syncgpt_secret_token_key_123',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Gemini
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Groq (existing chat feature)
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',

  // Cloudinary (for resume uploads — Phase 2)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  // Client
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000,

  // Helpers
  get isDev() {
    return this.NODE_ENV === 'development';
  },
  get isProd() {
    return this.NODE_ENV === 'production';
  },
};

// Validate critical vars
const requiredInProd = ['MONGODB_URI', 'JWT_SECRET', 'GEMINI_API_KEY'];
if (env.isProd) {
  for (const key of requiredInProd) {
    if (!env[key]) {
      console.error(`[ENV] Missing required env variable: ${key}`);
      process.exit(1);
    }
  }
}

module.exports = env;
