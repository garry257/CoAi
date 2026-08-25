const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const { PromptTemplate } = require('@langchain/core/prompts');
const { callStructured } = require('../ai/structuredOutput');
const searchService = require('./searchService');
const logger = require('../../utils/logger');
const CandidateProfile = require('../../models/candidate-profile.model');

// Define search capabilities as LangChain Tools
const searchJobsTool = tool(
  async ({ query }) => {
    return await searchService.searchJobRequirements(query);
  },
  {
    name: 'search_job_requirements',
    description: 'Searches for current job postings, internship listings, and target skill requirements.',
    schema: z.object({ query: z.string() }),
  }
);

const searchTrendsTool = tool(
  async ({ query }) => {
    return await searchService.searchInterviewTrends(query);
  },
  {
    name: 'search_interview_trends',
    description: 'Searches for interview questions, preparation guides, and tech industry trends.',
    schema: z.object({ query: z.string() }),
  }
);

const finalAnswerSchema = z.object({
  answer: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).optional().default([])
});

/**
 * AI Research Agent — Profile & Tech Stack Matching Version (LangChain Refactored)
 */
async function runResearchAgent(userRequest, options = {}) {
  logger.info(`[ResearchAgent] Starting profile-aware research for: "${userRequest}"`);
  const startTime = Date.now();

  const lowerReq = userRequest.toLowerCase();
  const isProfileQuery = lowerReq.includes('profile') || 
                        lowerReq.includes('resume') || 
                        lowerReq.includes('match') || 
                        lowerReq.includes('my skill') || 
                        lowerReq.includes('intenship') || 
                        lowerReq.includes('internship') || 
                        lowerReq.includes('job') || 
                        lowerReq.includes('for me');

  let profileContext = '';
  let candidateTech = [];
  let candidateRole = 'Software Engineering Candidate';

  if (isProfileQuery) {
    try {
      let profile = null;
      if (options.userId) {
        profile = await CandidateProfile.findOne({ userId: options.userId });
      }
      if (!profile) {
        profile = await CandidateProfile.findOne().sort({ updatedAt: -1 });
      }

      if (profile) {
        candidateTech = [
          ...(profile.skills || []),
          ...(profile.frameworks || []),
          ...(profile.languages || []),
          ...(profile.databases || []),
          ...(profile.tools || [])
        ].filter(Boolean);

        if (profile.experience && profile.experience[0]?.role) {
          candidateRole = profile.experience[0].role;
        }

        profileContext = `
CANDIDATE PROFILE DETECTED FROM DATABASE:
- Target Role: ${candidateRole}
- Detected Technologies & Skills: ${candidateTech.join(', ') || 'React, Node.js, JavaScript, Python, SQL'}
- Key Projects: ${(profile.projects || []).map(p => p.name).join(', ') || 'Web/Full-Stack Applications'}
`;
      }
    } catch (err) {
      logger.warn('[ResearchAgent] Could not fetch candidate profile:', err.message);
    }
  }

  let searchQuery = userRequest;
  if (candidateTech.length > 0) {
    const topTech = candidateTech.slice(0, 4).join(' ');
    searchQuery = `${topTech} internship job requirements apply link 2026`;
  }

  // Execute LangChain tools in parallel
  const [jobResults, trendResults] = await Promise.all([
    searchJobsTool.invoke({ query: searchQuery }),
    searchTrendsTool.invoke({ query: searchQuery })
  ]);

  const steps = [
    { stepNumber: 1, toolName: 'searchJobRequirements', thought: 'Scoping relevant tech stack requirements for target jobs.', query: searchQuery, results: jobResults },
    { stepNumber: 2, toolName: 'searchInterviewTrends', thought: 'Gathering interview trends and conceptual questions.', query: searchQuery, results: trendResults }
  ];

  const accumulatedSources = new Map();
  [...jobResults, ...trendResults].forEach(r => accumulatedSources.set(r.url, r.title));

  const historyText = steps.map((step, idx) =>
    `Search ${idx + 1} [${step.toolName}]:\n` +
    (step.results.length === 0
      ? '  (No results found)'
      : step.results.map(r => `  * [${r.title}](${r.url})\n    Snippet: ${r.snippet}`).join('\n'))
  ).join('\n\n---\n\n');

  const agentPromptTemplate = new PromptTemplate({
    template: `You are an AI Research Coach specializing in candidate profile analysis and job/internship matching.

User Query: "{userRequest}"

{profileContext}

Real-time Search Results:
{historyText}

INSTRUCTIONS FOR OUTPUT FORMATTING:
1. First, add section: "## 1. Candidate Profile Tech Stack Identified" listing the candidate's technologies as bullet points.
2. Second, add section: "## 2. Top Matching Internship Opportunities" containing a markdown table with columns:
   | Platform / Portal | Sample Internship Title | Location / Mode | Stipend / Salary | Required Tech Stack | Link to Apply |
   - Fill at least 3-4 realistic internship postings.
   - Put exact apply links in the "Link to Apply" column formatted as [Apply on PortalName](https://url).
3. Third, add section: "## 3. Skill Match Analysis & Tips" with 2-3 tailored recommendations for applying.`,
    inputVariables: ['userRequest', 'profileContext', 'historyText']
  });

  const formattedPrompt = await agentPromptTemplate.format({
    userRequest,
    profileContext: profileContext || 'No candidate profile context provided.',
    historyText
  });

  let finalResult;
  try {
    finalResult = await callStructured(formattedPrompt, finalAnswerSchema);
  } catch (e) {
    logger.error('[ResearchAgent] Synthesis failed:', e.message);
    finalResult = {
      answer: 'Research complete based on available search results.',
      sources: []
    };
  }

  const rawSources = finalResult.sources || [];
  let verifiedSources = rawSources.filter(s => accumulatedSources.has(s.url));
  if (verifiedSources.length === 0 && accumulatedSources.size > 0) {
    let count = 0;
    for (const [url, title] of accumulatedSources.entries()) {
      verifiedSources.push({ title, url });
      if (++count >= 4) break;
    }
  }

  logger.info(`[ResearchAgent] Completed in ${Date.now() - startTime}ms with ${verifiedSources.length} sources.`);

  return {
    answer: finalResult.answer || 'Research complete.',
    sources: verifiedSources,
    steps
  };
}

module.exports = { runResearchAgent };
