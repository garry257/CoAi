const { callStructured } = require('../ai/structuredOutput');
const { buildRAGContext } = require('../rag/ragService');
const { z } = require('zod');
const logger = require('../../utils/logger');

/**
 * Question generation schema for Gemini structured output (Zod schema)
 */
const questionGenSchema = z.object({
  questions: z.array(
    z.object({
      topic: z.string(),
      subtopic: z.string().optional(),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      question: z.string(),
      expectedConcepts: z.array(z.string()),
      estimatedAnswerSeconds: z.number(),
      followUpQuestions: z.array(
        z.object({
          condition: z.string().optional(),
          followUpQuestion: z.string(),
        })
      ).optional(),
    })
  ),
});

/**
 * Calculate number of questions based on interview duration
 * @param {number} durationMinutes - Interview duration in minutes
 * @returns {number} - Number of questions to generate
 */
function calculateQuestionCount(durationMinutes) {
  // Generate roughly 1 question per 3 minutes
  if (durationMinutes <= 10) return 3;
  if (durationMinutes <= 20) return 6;
  if (durationMinutes <= 30) return 9;
  if (durationMinutes <= 45) return 12;
  return 15; // 60 minutes
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

  const isHR = interviewType === 'hr';

  let profileSection = `CANDIDATE PROFILE:\n- Experience: ${experienceText}`;
  if (!isHR) {
    profileSection += `\n- Skills: ${skillsText}\n- Programming Languages: ${languagesText}\n- Frameworks: ${frameworksText}\n- Databases: ${databasesText}\n- Tools: ${toolsText}`;
  }

  const ragSection = isHR ? '' : `RETRIEVED KNOWLEDGE CONTEXT:\n${ragContext}\n\n`;

  const conductorRole = isHR ? 'HR and Behavioral' : (interviewType === 'ai_genai' ? 'AI/ML' : 'technical');
  
  return `You are an expert ${conductorRole} interview conductor. Generate ${numQuestions} personalized interview questions for the following candidate and scenario.

${ragSection}${profileSection}

INTERVIEW CONFIGURATION:
- Target Role: ${role}
- Interview Type: ${interviewType}
- Difficulty Level: ${difficulty}
- Total Duration: ${durationMinutes} minutes${companyContext ? `\n- Company Context: ${company}` : ''}

INSTRUCTIONS:
1. Generate exactly ${numQuestions} questions that:
   - Are personalized to the candidate's actual skills and experience
   - STRICTLY align with the specified Interview Type: ${interviewType}
   - Progressively test deeper knowledge
   - Mix conceptual and practical questions

CRITICAL RULE FOR INTERVIEW TYPE:
- If Interview Type is 'hr', ask ONLY behavioral, cultural fit, situational, and soft-skills questions (e.g., leadership, conflict resolution). Do NOT ask technical coding questions.
- If Interview Type is 'technical' or 'fullstack', focus heavily on technical, coding, architecture, and system design questions.
- If Interview Type is 'ai_genai', focus specifically on Artificial Intelligence, Machine Learning, LLMs, and Generative AI concepts.
- If Interview Type is 'resume_based', directly question the experiences, tools, and projects mentioned in the candidate's profile.
- If Interview Type is 'company_specific', tailor the questions to the company's domain, culture, or known interview style.
   
2. Question difficulty distribution:
   - If difficulty='easy': 50% easy, 30% medium, 20% hard
   - If difficulty='medium': 20% easy, 60% medium, 20% hard  
   - If difficulty='hard': 10% easy, 30% medium, 60% hard

3. For each question, provide:
   - topic: Main area being tested (e.g., "Behavioral", "React", "Database Design")
   - subtopic: Specific subtopic (e.g., "Conflict Resolution", "Hooks", "Normalization")
   - difficulty: 'easy', 'medium', or 'hard'
   - question: The actual question to ask
   - expectedConcepts: 3-5 key concepts that should be mentioned in a good answer
   - estimatedAnswerSeconds: How long a good answer typically takes (60-300 seconds)
   - followUpQuestions: 1-3 follow-up questions that probe deeper based on the candidate's answer

4. Reference the candidate's actual experience:
   - Adapt your questions based on their profile, but NEVER violate the CRITICAL RULE FOR INTERVIEW TYPE.
   - Avoid technologies they don't have on their resume.
   - Make questions progressively harder.

5. Return ONLY a valid JSON object with no markdown, no explanation, no extra text.

IMPORTANT: The follow-up questions should have a 'condition' field that indicates when to ask it (e.g., "if answer mentions X"), and 'followUpQuestion' field with the actual follow-up.

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
