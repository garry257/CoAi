const { GoogleGenAI } = require('@google/genai');
const env = require('./env');

let geminiClient = null;

/**
 * Get or create the Gemini AI client (singleton).
 * Returns null if no API key is configured.
 */
const getGeminiClient = () => {
  if (geminiClient) return geminiClient;

  if (!env.GEMINI_API_KEY) {
    console.warn('[Gemini] No GEMINI_API_KEY configured — AI features will be unavailable');
    return null;
  }

  geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  console.log('[Gemini] Client initialized');
  return geminiClient;
};

// Default model for general tasks
const GEMINI_MODEL = 'gemini-3.6-flash';

// Model for embeddings (RAG — Phase 4)
const EMBEDDING_MODEL = 'text-embedding-004';

module.exports = {
  getGeminiClient,
  GEMINI_MODEL,
  EMBEDDING_MODEL,
};
