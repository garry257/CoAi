const { z } = require('zod');
const { callStructured } = require('../ai/structuredOutput');
const searchService = require('./searchService');
const logger = require('../../utils/logger');

// Define the step schema for the agent
const agentStepSchema = z.object({
  thought: z.string().describe('Reasoning explanation of what you are searching for next or why you are done.'),
  toolName: z.enum([
    'searchInterviewTrends',
    'searchJobRequirements',
    'searchCompanyInformation',
    'searchLearningResources'
  ]).nullable().describe('The name of the tool to execute, or null if you are finished and ready to respond.'),
  query: z.string().optional().describe('The search query keyword(s) for the tool (required if toolName is not null).'),
  answer: z.string().optional().describe('The final comprehensive answer synthesizing the search findings (required if toolName is null).'),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string()
  })).optional().describe('The list of sources used in the answer, selected strictly from actual tool results (required if toolName is null).')
});

/**
 * AI Research Agent sequential runner.
 * @param {string} userRequest - The prompt/request from the user.
 * @returns {Promise<object>} - Object containing final { answer, sources, steps }
 */
async function runResearchAgent(userRequest) {
  const steps = [];
  const accumulatedSources = new Map(); // url -> title, to check and prevent invented resources
  let iterations = 0;
  const maxIterations = 5;

  logger.info(`[ResearchAgent] Starting research for: "${userRequest}"`);

  while (iterations < maxIterations) {
    iterations++;
    logger.info(`[ResearchAgent] Iteration ${iterations}/${maxIterations}`);

    // Build the agent context prompt
    const systemContext = `You are an AI Research Agent. Your goal is to research topics, interview trends, job requirements, company details, or learning resources based on the user request.
You have access to the following controlled search tools:
1. \`searchInterviewTrends(query)\` - Search for current interview trends, questions, and patterns for a given role or technology.
2. \`searchJobRequirements(query)\` - Search for specific job descriptions, skill requirements, or qualifications for a role.
3. \`searchCompanyInformation(query)\` - Search for company profiles, culture, recent news, or interview experiences.
4. \`searchLearningResources(query)\` - Search for tutorials, documentation, courses, or guides to learn a technology.

To use a tool, respond with a JSON object containing:
- "thought": Explaining why you need this search and what info you expect to find.
- "toolName": The string name of one of the four tools above.
- "query": The search query to pass.

If you have enough information to answer the user's request, or if no further searches are needed, respond with:
- "thought": Explaining why you have finished searching and are ready to respond.
- "toolName": null.
- "answer": Your comprehensive answer, synthesizing all findings. Highlight key insights, statistics, or patterns. Make it detailed, clear, and structured. Include inline citations or refer to sources.
- "sources": An array of objects with { "title": "Source Title", "url": "https://..." } that you used in your answer.

Rules:
- DO NOT invent/hallucinate resources or URLs. Only include sources in your final response that were actually returned in the search results of a tool call in the history below.
- Keep search queries concise.
- If a search returned no results, try another search query or proceed with a different tool.`;

    let historyText = '';
    if (steps.length === 0) {
      historyText = 'No searches have been performed yet.';
    } else {
      historyText = steps.map((step, idx) => {
        return `Step ${idx + 1}:
- Tool Called: ${step.toolName}
- Thought: ${step.thought}
- Query Used: ${step.query}
- Results Returned:
${step.results.length === 0 ? '  (No results found)' : step.results.map(r => `  * [${r.title}](${r.url})\n    Snippet: ${r.snippet}`).join('\n')}`;
      }).join('\n\n---\n\n');
    }

    const prompt = `${systemContext}

USER REQUEST:
"${userRequest}"

SEARCH HISTORY:
${historyText}

Analyze the user request and history. Decide whether you need to execute a tool (set "toolName" to a tool and provide a "query") or if you are ready to answer (set "toolName" to null, provide "answer" and "sources").`;

    // Call the structured output helper
    const stepResult = await callStructured(prompt, agentStepSchema);

    if (stepResult.toolName) {
      const toolName = stepResult.toolName;
      const query = stepResult.query || userRequest;
      const thought = stepResult.thought;

      logger.info(`[ResearchAgent] Decided to call: ${toolName}`);
      logger.info(`[ResearchAgent] Why called: ${thought}`);
      logger.info(`[ResearchAgent] Query: ${query}`);

      // Backend Tool Execution
      let results = [];
      if (toolName === 'searchInterviewTrends') {
        results = await searchService.searchInterviewTrends(query);
      } else if (toolName === 'searchJobRequirements') {
        results = await searchService.searchJobRequirements(query);
      } else if (toolName === 'searchCompanyInformation') {
        results = await searchService.searchCompanyInformation(query);
      } else if (toolName === 'searchLearningResources') {
        results = await searchService.searchLearningResources(query);
      }

      logger.info(`[ResearchAgent] Tool returned ${results.length} results.`);

      // Log returned titles
      results.forEach(r => {
        logger.info(`  - Result: "${r.title}" -> ${r.url}`);
        accumulatedSources.set(r.url, r.title);
      });

      // Record step details
      steps.push({
        stepNumber: iterations,
        thought,
        toolName,
        query,
        results
      });

    } else {
      // Agent is finished!
      logger.info(`[ResearchAgent] Finished. Why: ${stepResult.thought}`);

      const rawSources = stepResult.sources || [];
      const verifiedSources = [];

      // Filter sources to ensure they are strictly from actual search results (prevent hallucination)
      rawSources.forEach(src => {
        if (accumulatedSources.has(src.url)) {
          verifiedSources.push({
            title: accumulatedSources.get(src.url), // Use the actual title from search
            url: src.url
          });
        } else {
          // If the model tried to map it but there's a close URL match or it slightly formatted it,
          // let's check if there is an exact URL match, otherwise skip it to prevent invented resources.
          logger.warn(`[ResearchAgent] Filtered out invented source: ${src.title} (${src.url})`);
        }
      });

      // If verifiedSources is empty but we have accumulated sources, let's proactively add the top 3 actual sources used
      if (verifiedSources.length === 0 && accumulatedSources.size > 0) {
        let count = 0;
        for (const [url, title] of accumulatedSources.entries()) {
          verifiedSources.push({ title, url });
          count++;
          if (count >= 4) break;
        }
      }

      return {
        answer: stepResult.answer || 'Research complete, but no answer was formulated.',
        sources: verifiedSources,
        steps
      };
    }
  }

  // Fallback if we exceeded max iterations without a final answer
  logger.warn(`[ResearchAgent] Exceeded max iterations (${maxIterations}) without explicit finish. Synthesizing final answer.`);
  
  // Do a final generation to force response
  const finalPrompt = `You have completed 5 search iterations. You MUST now synthesize your answer.
User Request: "${userRequest}"

Accumulated Search Results:
${Array.from(accumulatedSources.entries()).map(([url, title]) => `- [${title}](${url})`).join('\n')}

Provide the final answer and source citations matching the accumulated search results.`;

  const finalResponse = await callStructured(finalPrompt, z.object({
    answer: z.string(),
    sources: z.array(z.object({
      title: z.string(),
      url: z.string()
    }))
  }));

  const verifiedSources = [];
  (finalResponse.sources || []).forEach(src => {
    if (accumulatedSources.has(src.url)) {
      verifiedSources.push({ title: accumulatedSources.get(src.url), url: src.url });
    }
  });

  if (verifiedSources.length === 0 && accumulatedSources.size > 0) {
    let count = 0;
    for (const [url, title] of accumulatedSources.entries()) {
      verifiedSources.push({ title, url });
      count++;
      if (count >= 4) break;
    }
  }

  return {
    answer: finalResponse.answer,
    sources: verifiedSources,
    steps
  };
}

module.exports = {
  runResearchAgent
};
