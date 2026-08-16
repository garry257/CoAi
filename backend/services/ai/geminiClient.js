const { getGeminiClient, GEMINI_MODEL } = require('../../config/gemini');
const logger = require('../../utils/logger');

/**
 * Thin wrapper around Gemini SDK.
 * Provides a single, consistent API for generating content.
 */
class GeminiService {
  constructor() {
    this.client = null;
    this.model = GEMINI_MODEL;
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
    const client = this._ensureClient();
    const model = options.model || this.model;

    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(options.generationConfig && { generationConfig: options.generationConfig }),
      });

      return response.text;
    } catch (error) {
      logger.error('[GeminiService] generateText failed:', error.message);
      throw error;
    }
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
