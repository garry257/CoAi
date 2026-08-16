const { z } = require('zod');
const { callStructured } = require('../ai/structuredOutput');
const searchService = require('./searchService');
const logger = require('../../utils/logger');

// Define the step schema for the agent
const agentStepSchema = z.object({
  thought: z.string().describe('Reasoning explanation.'),
  toolName: z.enum([
    'searchInterviewTrends',
    'searchJobRequirements',
    'searchCompanyInformation',
    'searchLearningResources'
  ]).nullable().describe('Tool to call, or null if ready to answer.'),
  query: z.string().optional().describe('Search query (required if toolName is not null).'),
  answer: z.string().optional().describe('Final answer (required if toolName is null).'),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string()
  })).optional().describe('Sources used (required if toolName is null).')
});

/**
 * Decide which tools to run upfront in parallel by asking the LLM once.
 */
const planSchema = z.object({
  searches: z.array(z.object({
    toolName: z.enum(['searchInterviewTrends', 'searchJobRequirements', 'searchCompanyInformation', 'searchLearningResources']),
    query: z.string()
  })).optional().default([]).describe('1–3 searches to run in parallel to answer the user request.')
});

/**
 * AI Research Agent — fast parallel version.
 * 1) Ask the LLM to plan 1-3 searches at once
 * 2) Run all searches in parallel
 * 3) Ask LLM to synthesize a final answer
 */
async function runResearchAgent(userRequest) {
  logger.info(`[ResearchAgent] Starting research for: "${userRequest}"`);

  // ─── Step 1: Plan searches (1 LLM call) ───────────────────────────────────
  const planPrompt = `You are an AI Research Agent. Given this user request, decide which 1–3 search tools to call IN PARALLEL to get enough information to answer fully.

Available tools:
- searchInterviewTrends: search interview questions, trends, patterns for a role/tech
- searchJobRequirements: search job descriptions, skills, requirements for a role
- searchCompanyInformation: search company profile, culture, news, interview experiences
- searchLearningResources: search tutorials, docs, courses for a technology

User Request: "${userRequest}"

Return a JSON with a "searches" array of 1-3 { toolName, query } objects. Be concise and targeted.`;

  let plan;
  try {
    plan = await callStructured(planPrompt, planSchema);
  } catch (e) {
    logger.error('[ResearchAgent] Planning failed:', e.message);
    plan = { searches: [{ toolName: 'searchJobRequirements', query: userRequest }] };
  }

  const searches = (plan.searches || []).slice(0, 3); // max 3
  logger.info(`[ResearchAgent] Running ${searches.length} searches in parallel`);

  // ─── Step 2: Execute all searches in parallel ─────────────────────────────
  const toolMap = {
    searchInterviewTrends: searchService.searchInterviewTrends.bind(searchService),
    searchJobRequirements: searchService.searchJobRequirements.bind(searchService),
    searchCompanyInformation: searchService.searchCompanyInformation.bind(searchService),
    searchLearningResources: searchService.searchLearningResources.bind(searchService),
  };

  const searchPromises = searches.map(async (s) => {
    const fn = toolMap[s.toolName];
    if (!fn) return { toolName: s.toolName, query: s.query, results: [] };
    const results = await fn(s.query);
    logger.info(`[ResearchAgent] ${s.toolName}("${s.query}") → ${results.length} results`);
    return { toolName: s.toolName, query: s.query, results };
  });

  const steps = await Promise.all(searchPromises);

  // Collect all found sources
  const accumulatedSources = new Map();
  steps.forEach(step => {
    step.results.forEach(r => accumulatedSources.set(r.url, r.title));
  });

  // ─── Step 3: Synthesize answer (1 LLM call) ───────────────────────────────
  const historyText = steps.map((step, idx) =>
    `Search ${idx + 1} [${step.toolName}("${step.query}")]:\n` +
    (step.results.length === 0
      ? '  (No results found)'
      : step.results.map(r => `  * [${r.title}](${r.url})\n    Snippet: ${r.snippet}`).join('\n'))
  ).join('\n\n---\n\n');

  const synthesisPrompt = `You are an AI Research Assistant. Based on the search results below, provide a comprehensive, well-structured answer to the user's request.

User Request: "${userRequest}"

Search Results:
${historyText}

Provide:
1. A clear, detailed answer with key insights, structured with headings/bullet points.
2. Sources strictly from the search results above (do NOT invent URLs).

Respond with JSON: { "thought": "...", "toolName": null, "answer": "...", "sources": [{"title": "...", "url": "..."}] }`;

  const finalAnswerSchema = z.object({
    thought: z.string().optional().default('Done'),
    toolName: z.null().optional(),
    answer: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).optional().default([])
  });

  let finalResult;
  try {
    finalResult = await callStructured(synthesisPrompt, finalAnswerSchema);
  } catch (e) {
    logger.error('[ResearchAgent] Synthesis failed:', e.message);
    finalResult = {
      answer: 'Research complete. Please see the sources for details.',
      sources: []
    };
  }

  // Verify sources are real (no hallucinated URLs)
  const rawSources = finalResult.sources || [];
  let verifiedSources = rawSources.filter(s => accumulatedSources.has(s.url));
  if (verifiedSources.length === 0 && accumulatedSources.size > 0) {
    let count = 0;
    for (const [url, title] of accumulatedSources.entries()) {
      verifiedSources.push({ title, url });
      if (++count >= 4) break;
    }
  }

  logger.info(`[ResearchAgent] Done. ${verifiedSources.length} verified sources.`);

  return {
    answer: finalResult.answer || 'Research complete.',
    sources: verifiedSources,
    steps
  };
}

module.exports = { runResearchAgent };
