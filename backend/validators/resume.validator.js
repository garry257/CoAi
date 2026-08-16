const { z } = require('zod');

/**
 * Zod schema for Gemini resume analysis output.
 * Every field from Gemini is validated before any DB write.
 */
const resumeOutputSchema = z.object({
  skills: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  databases: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  projects: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().default(''),
        techUsed: z.array(z.string()).default([]),
      })
    )
    .default([]),
  experience: z
    .array(
      z.object({
        role: z.string().min(1),
        company: z.string().default(''),
        duration: z.string().default(''),
        description: z.string().default(''),
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        degree: z.string().min(1),
        institution: z.string().default(''),
        year: z.string().default(''),
      })
    )
    .default([]),
  certifications: z.array(z.string()).default([]),
  claimedTopics: z.array(z.string()).default([]),
  suggestedInterviewTopics: z
    .array(z.string())
    .min(1, 'Must suggest at least 1 interview topic')
    .max(10, 'Too many suggested topics'),
});

module.exports = { resumeOutputSchema };
