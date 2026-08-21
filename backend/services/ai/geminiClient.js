const { getGeminiClient, GEMINI_MODEL } = require('../../config/gemini');
const Groq = require('groq-sdk');
const env = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Thin wrapper around Gemini SDK with Groq fallback.
 * Provides a single, consistent API for generating content.
 */
class GeminiService {
  constructor() {
    this.client = null;
    this.model = GEMINI_MODEL;
    this.groqClient = null;
  }

  _getGroqClient() {
    if (!this.groqClient && env.GROQ_API_KEY) {
      this.groqClient = new Groq({ apiKey: env.GROQ_API_KEY });
    }
    return this.groqClient;
  }

  /**
   * Initialize the client lazily.
   */
  _ensureClient() {
    if (!this.client) {
      this.client = getGeminiClient();
    }
    if (!this.client) {
      throw new Error('Gemini API is not configured. Set GEMINI_API_KEY in .env');
    }
    return this.client;
  }

  /**
   * Generate content from a text prompt.
   * @param {string} prompt - The prompt text
   * @param {object} [options] - Optional config (model, temperature, etc.)
   * @returns {Promise<string>} - Generated text response
   */
  async generateText(prompt, options = {}) {
    const model = options.model || this.model;

    // If Groq client is configured, try Groq first or fallback instantly
    const groqClient = this._getGroqClient();

    // 1. Try Gemini
    try {
      const client = this._ensureClient();
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(options.generationConfig && { generationConfig: options.generationConfig }),
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (error) {
      logger.warn('[GeminiService] Gemini API unavailable/slow, using fast Groq engine:', error.message);
    }

    // 2. Ultra-Fast Groq Engine Fallback
    if (groqClient) {
      const groqModels = [
        'openai/gpt-oss-20b',
        'qwen/qwen3.6-27b',
        'groq/compound',
        'openai/gpt-oss-120b'
      ];

      for (const groqModel of groqModels) {
        try {
          const generationConfig = options.generationConfig || {};
          const completion = await groqClient.chat.completions.create({
            model: groqModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: generationConfig.temperature ?? 0.7,
            max_tokens: generationConfig.maxOutputTokens ?? 2048,
          });

          const text = completion.choices?.[0]?.message?.content || '';
          if (text) {
            logger.info(`[GeminiService] Fast Groq output delivered (${groqModel})`);
            return text;
          }
        } catch (groqError) {
          logger.warn(`[GeminiService] Groq model ${groqModel} error:`, groqError.message);
        }
      }
    }

    throw new Error('AI Generation unavailable. Please check API configuration.');
  }

  /**
   * Generate content with chat history.
   * @param {Array} history - Array of { role, content } messages
   * @param {string} newMessage - New user message
   * @param {object} [options] - Optional config
   * @returns {Promise<string>} - Generated text response
   */
  async generateChat(history, newMessage, options = {}) {
    const client = this._ensureClient();
    const model = options.model || this.model;

    const contents = [
      ...history.map((msg) => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      { role: 'user', parts: [{ text: newMessage }] },
    ];

    try {
      const response = await client.models.generateContent({
        model,
        contents,
        ...(options.generationConfig && { generationConfig: options.generationConfig }),
      });

      return response.text;
    } catch (error) {
      logger.error('[GeminiService] generateChat failed:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new GeminiService();
