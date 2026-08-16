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

    try {
      const client = this._ensureClient();
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(options.generationConfig && { generationConfig: options.generationConfig }),
      });

      return response.text;
    } catch (error) {
      logger.warn('[GeminiService] Gemini failed, attempting Groq fallback:', error.message);

      const groqClient = this._getGroqClient();
      if (!groqClient) {
        logger.error('[GeminiService] generateText failed:', error.message);
        throw error;
      }

      try {
        const groqModels = [
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant',
          'mixtral-8x7b-32768',
          'gemma2-9b-it'
        ];

        let groqErrorToThrow = null;
        for (const groqModel of groqModels) {
          try {
            logger.info(`[GeminiService] Attempting Groq generation with model: ${groqModel}`);
            const generationConfig = options.generationConfig || {};
            const completion = await groqClient.chat.completions.create({
              model: groqModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: generationConfig.temperature ?? 0.7,
              max_tokens: generationConfig.maxOutputTokens ?? 2048,
            });

            const text = completion.choices?.[0]?.message?.content || '';
            if (!text) {
              throw new Error('Groq returned an empty response');
            }

            logger.info(`[GeminiService] Successfully used Groq (${groqModel}) for text generation`);
            return text;
          } catch (groqError) {
            groqErrorToThrow = groqError;
            logger.warn(`[GeminiService] Groq model ${groqModel} failed:`, groqError.message);
          }
        }
        logger.error('[GeminiService] All Groq fallback models failed');
        throw groqErrorToThrow || new Error('Groq fallback failed');
      } catch (groqError) {
        logger.error('[GeminiService] Groq fallback failed:', groqError.message);
        throw groqError;
      }
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
