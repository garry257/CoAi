const { z } = require('zod');
const { PromptTemplate } = require('@langchain/core/prompts');
const { callStructured } = require('./structuredOutput');
const logger = require('../../utils/logger');

// Define response schema for evaluation
const evaluationSchema = z.object({
  score: z.number().int().min(0).max(100),
  feedback: z.string(),
  isRelevant: z.boolean(),
});

/**
 * Evaluates a candidate's answer against expected concepts.
 * Returns score (0-100), feedback, and relevance.
 *
 * @param {string} questionText - The question asked
 * @param {string} candidateAnswer - The candidate's reply
 * @param {string[]} expectedConcepts - Key concepts expected in the answer
 * @param {string} topic - Topic area (technical/hr/etc)
 * @returns {Promise<{ score: number, feedback: string, isRelevant: boolean }>}
 */
async function evaluateAnswer(questionText, candidateAnswer, expectedConcepts = [], topic = '') {
  try {
    const evaluationPromptTemplate = new PromptTemplate({
      template: `You are an expert interviewer evaluating a candidate's response to an interview question.

Question: "{questionText}"
Topic: "{topic}"
Expected Key Concepts/Keywords: {expectedConceptsJson}

Candidate's Answer: "{candidateAnswer}"

Instructions:
1. Determine if the candidate's answer is relevant to the question. If the answer is completely off-topic, irrelevant, gibberish, or tries to dodge the question, set isRelevant to false and set the score to 0.
2. If relevant, set isRelevant to true. Analyze their answer. Check if they covered the expected key concepts/keywords (they don't need to match the words exactly, look for the correct understanding or synonyms).
3. Score the answer out of 100:
   - 0: Completely irrelevant or wrong.
   - 1-49: Poor/incomplete answer, missing almost all key concepts.
   - 50-69: Average answer, covers some concepts but lacks detail.
   - 70-89: Good answer, covers most key concepts with decent reasoning.
   - 90-100: Excellent, comprehensive answer covering all key concepts.
4. Provide constructive and specific feedback under 3 sentences. Be encouraging but clear on what was missed.`,
      inputVariables: ['questionText', 'topic', 'expectedConceptsJson', 'candidateAnswer']
    });

    const formattedPrompt = await evaluationPromptTemplate.format({
      questionText,
      topic,
      expectedConceptsJson: JSON.stringify(expectedConcepts),
      candidateAnswer
    });

    const evaluation = await callStructured(formattedPrompt, evaluationSchema, {
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent grading
      }
    });

    logger.info('[EvaluatorService] Successfully evaluated answer via LangChain', {
      score: evaluation.score,
      isRelevant: evaluation.isRelevant,
    });

    return evaluation;
  } catch (error) {
    logger.error('[EvaluatorService] Error during evaluation:', error.message);
    // Safe fallback: 40% completion credit, no feedback
    return {
      score: candidateAnswer.trim().length > 10 ? 40 : 0,
      feedback: 'Could not perform AI evaluation due to rate limits or API issues.',
      isRelevant: true,
    };
  }
}

module.exports = { evaluateAnswer };
