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

/**
 * Helper to extract deduplicated array of candidate skills, languages, frameworks, tools from candidate profile
 */
function extractCandidateSkillList(candidateProfile) {
  const list = [];
  if (candidateProfile) {
    if (Array.isArray(candidateProfile.skills)) list.push(...candidateProfile.skills);
    if (Array.isArray(candidateProfile.languages)) list.push(...candidateProfile.languages);
    if (Array.isArray(candidateProfile.frameworks)) list.push(...candidateProfile.frameworks);
    if (Array.isArray(candidateProfile.databases)) list.push(...candidateProfile.databases);
    if (Array.isArray(candidateProfile.tools)) list.push(...candidateProfile.tools);
    if (Array.isArray(candidateProfile.claimedTopics)) list.push(...candidateProfile.claimedTopics);
    
    // Extract keywords from resumeText if skills array is empty
    if (list.length === 0 && candidateProfile.resumeText) {
      const keywords = candidateProfile.resumeText.match(/\b(Java|Python|JavaScript|TypeScript|C\+\+|C#|HTML|CSS|React|Node\.js|Express|MongoDB|SQL|MySQL|PostgreSQL|AWS|Docker|Kubernetes|Git|REST|GraphQL|Redux|Next\.js|Vue|Angular|Spring|Django|Flask)\b/gi);
      if (keywords) list.push(...keywords);
    }
  }

  // Deduplicate case-insensitively while maintaining clean labels
  const uniqueMap = new Map();
  for (const s of list) {
    const clean = String(s).trim();
    if (clean && !uniqueMap.has(clean.toLowerCase())) {
      uniqueMap.set(clean.toLowerCase(), clean);
    }
  }
  return Array.from(uniqueMap.values());
}

/**
 * Build a full resume snapshot text for the AI interviewer
 */
function buildResumeContext(candidateProfile) {
  if (!candidateProfile) return 'No resume provided.';
  const parts = [];

  const skills = extractCandidateSkillList(candidateProfile);
  if (skills.length > 0) parts.push(`SKILLS & TECHNOLOGIES: ${skills.join(', ')}`);

  if (Array.isArray(candidateProfile.experience) && candidateProfile.experience.length > 0) {
    const exp = candidateProfile.experience.map(e =>
      `• ${e.role || 'Role'} at ${e.company || 'Company'} (${e.duration || 'N/A'}): ${e.description || ''}`
    ).join('\n');
    parts.push(`WORK EXPERIENCE:\n${exp}`);
  }

  if (Array.isArray(candidateProfile.projects) && candidateProfile.projects.length > 0) {
    const proj = candidateProfile.projects.map(p =>
      `• ${p.name || 'Project'}: ${p.description || ''} [Tech: ${(p.techUsed || []).join(', ')}]`
    ).join('\n');
    parts.push(`PROJECTS:\n${proj}`);
  }

  if (Array.isArray(candidateProfile.education) && candidateProfile.education.length > 0) {
    const edu = candidateProfile.education.map(e =>
      `• ${e.degree || 'Degree'} from ${e.institution || 'Institution'} (${e.year || ''})`
    ).join('\n');
    parts.push(`EDUCATION:\n${edu}`);
  }

  if (Array.isArray(candidateProfile.certifications) && candidateProfile.certifications.length > 0) {
    parts.push(`CERTIFICATIONS: ${candidateProfile.certifications.join(', ')}`);
  }

  if (candidateProfile.resumeText && parts.length <= 1) {
    parts.push(`RESUME TEXT:\n${candidateProfile.resumeText.slice(0, 1500)}`);
  }

  return parts.join('\n\n') || 'No detailed profile information.';
}

/**
 * Generate a single question fast for real-time interview stream.
 * Acts like a real interviewer — covers all resume aspects holistically:
 * languages, projects, experience, tools, system design, and behavioral.
 */
async function generateSingleQuestion(params) {
  const {
    role,
    interviewType,
    difficulty = 'medium',
    candidateProfile,
    company,
    questionNumber = 1,
    previousQuestions = []
  } = params;

  const isHR = interviewType === 'hr';
  const conductorRole = isHR ? 'HR and Behavioral' : (interviewType === 'ai_genai' ? 'AI/ML' : 'Technical');
  const companyContext = company ? ` at ${company}` : '';
  const prevText = (previousQuestions || []).map(q => `Q${q.questionNumber || ''}: ${q.question}`).slice(-5).join('\n');
  const resumeContext = buildResumeContext(candidateProfile);

  // Determine coverage area for this question to ensure broad resume coverage
  const coverageAreas = [
    'a core programming language or syntax concept from their resume',
    'a framework or library they listed (ask about real usage, patterns, or challenges)',
    'one of their projects (ask about architecture, decisions made, or challenges faced)',
    'a database or backend technology they mentioned',
    'a tool, deployment, or DevOps technology from their resume',
    'system design or how they would build something related to their tech stack',
    'a behavioral or soft-skill scenario relevant to their experience',
    'debugging or problem-solving in a technology they listed',
    'a concept connecting multiple technologies on their resume',
    'code quality, testing, or best practices relevant to their stack',
  ];
  const coverageInstruction = coverageAreas[(questionNumber - 1) % coverageAreas.length];

  const prompt = `You are an experienced ${conductorRole} interviewer conducting a professional interview for the role of ${role} (${difficulty} difficulty)${companyContext}.

You have carefully read the candidate's full resume below:

===== CANDIDATE RESUME =====
${resumeContext}
============================

QUESTIONS ALREADY ASKED (do NOT repeat these):
${prevText || 'None — this is Question #1.'}

YOUR TASK — Ask Question #${questionNumber}:
Focus area for this question: ${coverageInstruction}

RULES:
1. You are a real interviewer — ask ONE clear, focused, natural interview question.
2. Draw inspiration from the candidate's ACTUAL resume content (their specific projects, exact tech stack, real experience).
3. The question must be different from ALL previously asked questions above.
4. It must match the interview type: ${interviewType}.
5. Do NOT ask about the same thing asked before. Cover new ground each time.
6. Make it feel like a natural conversation — vary between technical, conceptual, scenario-based, and project-based questions.

Return ONLY this JSON:
{
  "topic": "The specific topic area (e.g. React, Node.js, Project Name, System Design)",
  "subtopic": "Specific concept being tested",
  "difficulty": "${difficulty}",
  "question": "Your interview question here",
  "expectedConcepts": ["concept1", "concept2", "concept3"]
}`;

  const singleQuestionSchema = z.object({
    topic: z.string().optional().default('General'),
    subtopic: z.string().optional().default('General'),
    difficulty: z.string().optional().default(difficulty),
    question: z.string(),
    expectedConcepts: z.array(z.string()).optional().default([]),
  });

  try {
    const q = await callStructured(prompt, singleQuestionSchema);
    return {
      topic: q.topic || 'General',
      subtopic: q.subtopic || 'General',
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : difficulty,
      question: q.question,
      expectedConcepts: Array.isArray(q.expectedConcepts) ? q.expectedConcepts : [],
      estimatedAnswerSeconds: 120,
      followUpQuestions: [],
      questionNumber,
      status: 'pending',
    };
  } catch (err) {
    logger.warn('[QuestionGenerator] Fast single question fallback used:', err.message);
    const skills = extractCandidateSkillList(candidateProfile);
    const randomSkill = skills.length > 0 ? skills[(questionNumber - 1) % skills.length] : role;
    return {
      topic: randomSkill,
      subtopic: 'Practical Application',
      difficulty,
      question: `Can you walk me through a project or scenario where you used ${randomSkill}? What challenges did you face and how did you solve them?`,
      expectedConcepts: [randomSkill, 'Problem Solving', 'Real-world Application'],
      estimatedAnswerSeconds: 120,
      followUpQuestions: [],
      questionNumber,
      status: 'pending',
    };
  }
}

module.exports = {
  generateInterviewQuestions,
  generateSingleQuestion,
  extractCandidateSkillList,
  calculateQuestionCount,
};


