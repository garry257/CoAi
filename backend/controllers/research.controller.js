const { runResearchAgent } = require('../services/research/researchAgent');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Handle research agent query execution request.
 */
exports.queryResearchAgent = async (req, res) => {
  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return apiResponse.error(res, 'A prompt query is required', 400);
    }

    const result = await runResearchAgent(prompt.trim());

    return apiResponse.success(res, result, 'AI research agent query completed successfully');
  } catch (error) {
    logger.error('[ResearchController] queryResearchAgent failed:', error.message);
    return apiResponse.error(res, error.message || 'AI Research Agent failed during execution', 500);
  }
};
