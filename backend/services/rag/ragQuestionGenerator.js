const { buildRAGContext } = require('./ragService');
const geminiClient = require('../ai/geminiClient');
const logger = require('../../utils/logger');

async function generateRagQuestion({ candidateProfile, interviewTopic, role, interviewType, difficulty = 'medium' }) {
  const context = buildRAGContext({
    candidateProfile,
    interviewTopic,
    role,
    interviewType,
    limit: 5,
  });

  const prompt = `You are an expert technical interviewer. Use the retrieved evidence below to produce one high-quality interview question for the candidate.

Candidate profile:
- Role target: ${role || 'General'}
- Interview type: ${interviewType || 'technical'}
- Difficulty: ${difficulty}
- Skills: ${(candidateProfile?.skills || []).join(', ') || 'Not provided'}
- Frameworks: ${(candidateProfile?.frameworks || []).join(', ') || 'Not provided'}
- Databases: ${(candidateProfile?.databases || []).join(', ') || 'Not provided'}
- Tools: ${(candidateProfile?.tools || []).join(', ') || 'Not provided'}
- Suggested topics: ${(candidateProfile?.suggestedInterviewTopics || []).join(', ') || 'Not provided'}

Interview topic: ${interviewTopic || 'General technology fundamentals'}

Relevant retrieved knowledge:
${context}

Requirements:
1. Ask a question that is relevant to the candidate’s actual experience and the interview topic.
2. Make it practical, not generic.
3. Explain why the topic matters in one sentence.
4. Return valid JSON: { "question": "...", "whyItMatters": "..." }
`;

  try {
    const text = await geminiClient.generateText(prompt, {
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });

    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    logger.error('[RAGQuestionGenerator] failed to generate question:', error.message);
    throw error;
  }
}

module.exports = {
  generateRagQuestion,
};
