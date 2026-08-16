const { callStructured } = require('../ai/structuredOutput');
const { buildRAGContext } = require('../rag/ragService');
const logger = require('../../utils/logger');

/**
 * Question generation schema for Gemini structured output
 */
const questionGenSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          subtopic: { type: 'string' },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard']
          },
          question: { type: 'string' },
          expectedConcepts: {
            type: 'array',
            items: { type: 'string' }
          },
          estimatedAnswerSeconds: { type: 'number' },
          followUpQuestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                condition: { type: 'string' },
                followUpQuestion: { type: 'string' }
              }
            }
          }
        },
        required: ['topic', 'difficulty', 'question', 'expectedConcepts', 'estimatedAnswerSeconds']
      }
    }
  },
  required: ['questions']
};

/**
 * Calculate number of questions based on interview duration
 * @param {number} durationMinutes - Interview duration in minutes
 * @returns {number} - Number of questions to generate
 */
function calculateQuestionCount(durationMinutes) {
  // Approximate: 1 question every 5-7 minutes (including follow-ups)
  if (durationMinutes <= 10) return 1;
  if (durationMinutes <= 20) return 2;
  if (durationMinutes <= 30) return 3;
  if (durationMinutes <= 45) return 5;
  return 7; // 60 minutes
}

/**
 * Build the question generation prompt
 * @param {object} params - Parameters
 * @returns {string} - Prompt string
 */
function buildQuestionPrompt(params) {
  const {
    role,
    interviewType,
    difficulty,
    durationMinutes,
    candidateProfile,
    company,
    numQuestions,
  } = params;

  const skillsText = candidateProfile?.skills?.join(', ') || 'Not provided';
  const languagesText = candidateProfile?.languages?.join(', ') || 'Not provided';
  const frameworksText = candidateProfile?.frameworks?.join(', ') || 'Not provided';
  const databasesText = candidateProfile?.databases?.join(', ') || 'Not provided';
  const toolsText = candidateProfile?.tools?.join(', ') || 'Not provided';
  const experienceText = candidateProfile?.experience
    ?.map(exp => `${exp.role} at ${exp.company} (${exp.duration})`)
    .join('; ') || 'Not provided';

  const companyContext = company ? ` at ${company}` : '';
  const ragContext = buildRAGContext({
    candidateProfile,
    interviewTopic: role,
    role,
    interviewType,
    limit: 5,
  });

  return `You are an expert technical interview conductor. Generate ${numQuestions} personalized interview questions for the following candidate and scenario.

RETRIEVED KNOWLEDGE CONTEXT:
${ragContext}


CANDIDATE PROFILE:
- Skills: ${skillsText}
- Programming Languages: ${languagesText}
- Frameworks: ${frameworksText}
- Databases: ${databasesText}
- Tools: ${toolsText}
- Experience: ${experienceText}

INTERVIEW CONFIGURATION:
- Target Role: ${role}
- Interview Type: ${interviewType}
- Difficulty Level: ${difficulty}
- Total Duration: ${durationMinutes} minutes${companyContext ? `\n- Company Context: ${company}` : ''}

INSTRUCTIONS:
1. Generate exactly ${numQuestions} questions that:
   - Are personalized to the candidate's actual skills and experience
   - Align with the target role and interview type
   - Progressively test deeper knowledge
   - Mix conceptual and practical questions
   
2. Question difficulty distribution:
   - If difficulty='easy': 50% easy, 30% medium, 20% hard
   - If difficulty='medium': 20% easy, 60% medium, 20% hard  
   - If difficulty='hard': 10% easy, 30% medium, 60% hard

3. For each question, provide:
   - topic: Main area being tested (e.g., "React", "Database Design")
   - subtopic: Specific subtopic (e.g., "Hooks", "Normalization")
   - difficulty: 'easy', 'medium', or 'hard'
   - question: The actual question to ask
   - expectedConcepts: 3-5 key concepts that should be mentioned in a good answer
   - estimatedAnswerSeconds: How long a good answer typically takes (60-300 seconds)
   - followUpQuestions: 1-3 follow-up questions that probe deeper based on the candidate's answer

4. Reference the candidate's actual experience:
   - If they used React, ask specific React questions (hooks, state management, etc.)
   - If they worked with databases, ask design or optimization questions
   - Avoid technologies they don't have on their resume
   - Make questions progressively harder

5. Return ONLY a valid JSON object with no markdown, no explanation, no extra text.

IMPORTANT: The follow-up questions should have a 'condition' field that indicates when to ask it (e.g., "if answer mentions useContext"), and 'followUpQuestion' field with the actual follow-up.

Return your response as valid JSON:`;
}

/**
 * Generate interview questions based on candidate profile and interview config
 * @param {object} params - Parameters
 * @returns {Promise<array>} - Array of generated question objects
 */
async function generateInterviewQuestions(params) {
  const {
    role,
    interviewType,
    difficulty = 'medium',
    durationMinutes,
    candidateProfile,
    company,
  } = params;

  if (!role || !interviewType || !durationMinutes || !candidateProfile) {
    throw new Error('Missing required parameters for question generation');
  }

  const numQuestions = calculateQuestionCount(durationMinutes);

  try {
    logger.info('[QuestionGenerator] Generating', {
      role,
      interviewType,
      difficulty,
      durationMinutes,
      numQuestions,
    });

    const prompt = buildQuestionPrompt({
      role,
      interviewType,
      difficulty,
      durationMinutes,
      candidateProfile,
      company,
      numQuestions,
    });

    const result = await callStructured(prompt, questionGenSchema, {
      generationConfig: {
        temperature: 0.7, // Moderate creativity for varied but coherent questions
        maxOutputTokens: 4096,
      },
    });

    if (!result.questions || !Array.isArray(result.questions)) {
      throw new Error('Invalid response structure from Gemini');
    }

    // Validate and enhance questions
    const validatedQuestions = result.questions.map((q, index) => ({
      ...q,
      topic: q.topic || 'General',
      subtopic: q.subtopic || 'N/A',
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      question: q.question || '',
      expectedConcepts: Array.isArray(q.expectedConcepts) ? q.expectedConcepts : [],
      estimatedAnswerSeconds: q.estimatedAnswerSeconds || 120,
      followUpQuestions: Array.isArray(q.followUpQuestions) ? q.followUpQuestions : [],
      questionNumber: index + 1,
    }));

    logger.info('[QuestionGenerator] Successfully generated', {
      count: validatedQuestions.length,
    });

    return validatedQuestions;
  } catch (error) {
    logger.error('[QuestionGenerator] Error:', error.message);
    throw error;
  }
}

module.exports = {
  generateInterviewQuestions,
  calculateQuestionCount,
};
