const { ChatGroq } = require('@langchain/groq');
const geminiClient = require('./geminiClient');
const env = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Call Gemini and expect a structured JSON response validated against a Zod schema.
 * Uses LangChain's native `.withStructuredOutput` helper with fallback routing.
 *
 * @param {string} prompt - The full prompt to send to Gemini
 * @param {z.ZodSchema} schema - Zod schema to validate the response against
 * @param {object} [options] - Optional Gemini config (model, temperature, etc.)
 * @returns {Promise<object>} - Parsed and validated JSON object
 */
async function callStructured(prompt, schema, options = {}) {
  try {
    const primaryModel = geminiClient._getGoogleModel(options);
    let structuredModel = primaryModel.withStructuredOutput(schema, { method: 'functionCalling' });

    // If Groq key is present, attach structured fallback models
    if (env.GROQ_API_KEY) {
      const temp = options.generationConfig?.temperature ?? 0.7;
      const maxTokens = options.generationConfig?.maxOutputTokens ?? 2048;

      const fallbackModels = [
        'llama-3.3-70b-specdec',
        'mixtral-8x7b-32768'
      ];

      const structuredFallbacks = fallbackModels.map((m) => {
        const groqModel = new ChatGroq({
          apiKey: env.GROQ_API_KEY,
          model: m,
          temperature: temp,
          maxTokens: maxTokens,
        });
        return groqModel.withStructuredOutput(schema, { method: 'functionCalling' });
      });

      structuredModel = structuredModel.withFallbacks(structuredFallbacks);
    }

    const response = await structuredModel.invoke(prompt);
    return response;
  } catch (error) {
    logger.error('[StructuredOutput] LangChain structured output failed:', error);
    throw error;
  }
}

module.exports = { callStructured };
