const { z } = require('zod');
const geminiClient = require('./geminiClient');
const logger = require('../../utils/logger');

/**
 * Sleep for a given number of milliseconds.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if an error is a transient API error (429, 503, etc.)
 */
function isTransientError(error) {
  const message = error.message || '';
  const isRateLimit = message.includes('429') || message.includes('too many requests');
  const isServerError = message.includes('503') || message.includes('unavailable') || message.includes('high demand');
  const isTimeout = message.includes('timeout') || message.includes('DEADLINE_EXCEEDED');
  return isRateLimit || isServerError || isTimeout;
}

/**
 * Call Gemini and expect a structured JSON response validated against a Zod schema.
 * This is the single choke point for all AI calls that return structured data.
 *
 * @param {string} prompt - The full prompt to send to Gemini
 * @param {z.ZodSchema} schema - Zod schema to validate the response against
 * @param {object} [options] - Optional Gemini config (model, temperature, etc.)
 * @returns {Promise<object>} - Parsed and validated JSON object
 * @throws {Error} - If response fails validation after retries exhausted
 */
async function callStructured(prompt, schema, options = {}) {
  const maxAttempts = 2;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      let effectivePrompt = prompt;

      if (attempt > 0 && lastError && !isTransientError(lastError)) {
        effectivePrompt += `\n\n[SYSTEM: Your previous response was invalid JSON. Error: ${lastError.message}. Please output ONLY valid JSON matching the required schema. No markdown fences, no explanation.]`;
      }

      const rawText = await geminiClient.generateText(effectivePrompt, options);

      // Defensively strip markdown code fences
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      // Parse JSON
      const parsed = JSON.parse(cleaned);

      // Validate against schema
      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`Schema validation failed: ${result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }

      return result.data;
    } catch (error) {
      lastError = error;
      logger.warn(`[StructuredOutput] Attempt ${attempt + 1}/${maxAttempts} failed: ${error.message}`);

      if (attempt < maxAttempts - 1) {
        await sleep(300);
      } else {
        const aiError = new Error(`AI structured output failed: ${error.message}`);
        aiError.name = 'AIOutputError';
        throw aiError;
      }
    }
  }
}

module.exports = { callStructured };
