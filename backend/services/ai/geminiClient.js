const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatGroq } = require('@langchain/groq');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { GEMINI_MODEL } = require('../../config/gemini');

/**
 * LangChain-powered wrapper around Gemini with Groq fallback.
 * Provides a single, consistent API for generating content.
 */
class GeminiService {
  constructor() {
    this.model = GEMINI_MODEL;
  }

  _getGoogleModel(options = {}) {
    const modelName = options.model || this.model;
    const temp = options.generationConfig?.temperature ?? 0.7;
    const maxTokens = options.generationConfig?.maxOutputTokens ?? 2048;

    if (!env.GEMINI_API_KEY) {
      throw new Error('Gemini API is not configured. Set GEMINI_API_KEY in .env');
    }

    return new ChatGoogleGenerativeAI({
      apiKey: env.GEMINI_API_KEY,
      model: modelName,
      temperature: temp,
      maxOutputTokens: maxTokens,
    });
  }

  _getFallbackChain(options = {}) {
    const primary = this._getGoogleModel(options);

    if (env.GROQ_API_KEY) {
      const temp = options.generationConfig?.temperature ?? 0.7;
      const maxTokens = options.generationConfig?.maxOutputTokens ?? 2048;

      const fallbackModels = [
        'llama-3.3-70b-specdec',
        'mixtral-8x7b-32768'
      ];

      const groqModelInstances = fallbackModels.map(
        (m) =>
          new ChatGroq({
            apiKey: env.GROQ_API_KEY,
            model: m,
            temperature: temp,
            maxTokens: maxTokens,
          })
      );

      return primary.withFallbacks(groqModelInstances);
    }

    return primary;
  }

  /**
   * Generate content from a text prompt.
   * @param {string} prompt - The prompt text
   * @param {object} [options] - Optional config (model, temperature, etc.)
   * @returns {Promise<string>} - Generated text response
   */
  async generateText(prompt, options = {}) {
    try {
      const chain = this._getFallbackChain(options);
      const response = await chain.invoke(prompt);
      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
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
    try {
      const messages = history.map((msg) => {
        if (msg.role === 'model' || msg.role === 'ai') {
          return ['ai', msg.content];
        } else if (msg.role === 'system') {
          return ['system', msg.content];
        } else {
          return ['human', msg.content];
        }
      });

      messages.push(['human', newMessage]);

      const chain = this._getFallbackChain(options);
      const response = await chain.invoke(messages);
      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    } catch (error) {
      logger.error('[GeminiService] generateChat failed:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new GeminiService();
