const { callStructured } = require('../ai/structuredOutput');
const { resumeOutputSchema } = require('../../validators/resume.validator');
const logger = require('../../utils/logger');

// Truncate resume text to avoid exceeding Gemini context limits
// ~12,000 chars ≈ ~3,000 tokens — plenty for a resume
const MAX_TEXT_LENGTH = 12000;

/**
 * Build the structured resume analysis prompt.
 * @param {string} rawText - Extracted PDF text
 * @returns {string} - Full prompt string
 */
const buildPrompt = (rawText) => {
  const truncated = rawText.length > MAX_TEXT_LENGTH
    ? rawText.slice(0, MAX_TEXT_LENGTH) + '\n[... text truncated ...]'
    : rawText;

  return `You are an expert technical resume parser. Extract structured information from the resume text below.

RESUME TEXT:
---
${truncated}
---

Return ONLY a valid JSON object with exactly these fields. No markdown fences, no explanation, no extra text:

{
  "skills": [],
  "languages": [],
  "frameworks": [],
  "databases": [],
  "tools": [],
  "projects": [{ "name": "", "description": "", "techUsed": [] }],
  "experience": [{ "role": "", "company": "", "duration": "", "description": "" }],
  "education": [{ "degree": "", "institution": "", "year": "" }],
  "certifications": [],
  "claimedTopics": [],
  "suggestedInterviewTopics": []
}

Field definitions:
- skills: All technical skills explicitly mentioned (broad list)
- languages: Programming/scripting languages only (e.g. JavaScript, Python, Java)
- frameworks: Frameworks and libraries (e.g. React, Express, Spring Boot, Django)
- databases: Database technologies (e.g. MongoDB, PostgreSQL, Redis, MySQL)
- tools: Dev tools, cloud platforms, DevOps (e.g. Git, Docker, AWS, Kubernetes, Postman)
- projects: Each distinct project found in the resume
- experience: Each job/internship role found
- education: Each degree or educational qualification
- certifications: Any certifications or courses mentioned
- claimedTopics: Topics the candidate implicitly claims expertise in based on their full profile
- suggestedInterviewTopics: 5-8 specific topics to interview this candidate on, based on their actual experience (not generic topics)

Rules:
- Output ONLY valid JSON. No markdown code blocks.
- Use empty arrays [] if no data exists for a section.
- Do not invent or hallucinate information not in the resume.
- String values must not be null — use empty string "" if unknown.
- suggestedInterviewTopics must be specific to this candidate's profile.`;
};

/**
 * Analyze resume text using Gemini and return validated structured data.
 * @param {string} rawText - Extracted PDF text
 * @returns {Promise<object>} - Validated resume analysis object
 */
const analyzeResume = async (rawText) => {
  logger.info('[ResumeAnalyzer] Starting Gemini analysis...');

  const prompt = buildPrompt(rawText);

  try {
    const result = await callStructured(prompt, resumeOutputSchema, {
      generationConfig: {
        temperature: 0.1, // Low temp = more factual, less creative
        maxOutputTokens: 2048,
      },
    });

    logger.info('[ResumeAnalyzer] Analysis complete', {
      skills: result.skills.length,
      projects: result.projects.length,
      suggestedTopics: result.suggestedInterviewTopics.length,
    });

    return result;
  } catch (error) {
    if (error.name === 'AIOutputError') {
      const err = new Error('AI analysis failed to produce valid output. Please try again.');
      err.statusCode = 502;
      throw err;
    }
    throw error;
  }
};

module.exports = { analyzeResume };
