const { z } = require('zod');
const { PromptTemplate } = require('@langchain/core/prompts');
const { callStructured } = require('../ai/structuredOutput');
const { buildRAGContext } = require('./ragService');
const logger = require('../../utils/logger');

const questionSchema = z.object({
  question: z.string(),
  whyItMatters: z.string()
});

async function generateRagQuestion({ candidateProfile, interviewTopic, role, interviewType, difficulty = 'medium' }) {
  const context = await buildRAGContext({
    candidateProfile,
    interviewTopic,
    role,
    interviewType,
    limit: 5,
  });

  const generatorPromptTemplate = new PromptTemplate({
    template: `You are an expert technical interviewer. Use the retrieved evidence below to produce one high-quality interview question for the candidate.

Candidate profile:
- Role target: {role}
- Interview type: {interviewType}
- Difficulty: {difficulty}
- Skills: {skills}
- Frameworks: {frameworks}
- Databases: {databases}
- Tools: {tools}
- Suggested topics: {suggestedTopics}

Interview topic: {interviewTopic}

Relevant retrieved knowledge:
{context}

Requirements:
1. Ask a question that is relevant to the candidate’s actual experience and the interview topic.
2. Make it practical, not generic.
3. Explain why the topic matters in one sentence.`,
    inputVariables: ['role', 'interviewType', 'difficulty', 'skills', 'frameworks', 'databases', 'tools', 'suggestedTopics', 'interviewTopic', 'context']
  });

  const formattedPrompt = await generatorPromptTemplate.format({
    role: role || 'General',
    interviewType: interviewType || 'technical',
    difficulty,
    skills: (candidateProfile?.skills || []).join(', ') || 'Not provided',
    frameworks: (candidateProfile?.frameworks || []).join(', ') || 'Not provided',
    databases: (candidateProfile?.databases || []).join(', ') || 'Not provided',
    tools: (candidateProfile?.tools || []).join(', ') || 'Not provided',
    suggestedTopics: (candidateProfile?.suggestedInterviewTopics || []).join(', ') || 'Not provided',
    interviewTopic: interviewTopic || 'General technology fundamentals',
    context
  });

  try {
    const questionResult = await callStructured(formattedPrompt, questionSchema, {
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });
    return questionResult;
  } catch (error) {
    logger.error('[RAGQuestionGenerator] failed to generate question:', error.message);
    throw error;
  }
}

module.exports = {
  generateRagQuestion,
};
