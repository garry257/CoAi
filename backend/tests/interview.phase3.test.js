const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateRemainingSeconds,
  normalizeQuestionPayload,
  summarizeInterviewProgress,
} = require('../controllers/interviewController');

test('calculateRemainingSeconds uses server time and clamps to zero at expiry', () => {
  const startedAt = new Date(Date.now() - (61 * 60 * 1000));
  const remaining = calculateRemainingSeconds(startedAt, 60);
  assert.equal(remaining, 0);
});

test('normalizeQuestionPayload preserves the required question fields', () => {
  const payload = normalizeQuestionPayload({
    topic: 'React',
    subtopic: 'Hooks',
    difficulty: 'medium',
    question: 'Explain useEffect',
    expectedConcepts: ['cleanup', 'dependencies'],
    estimatedAnswerSeconds: 180,
    followUpQuestions: [{ condition: 'when answer mentions state', followUpQuestion: 'What changed?' }],
  });

  assert.deepEqual(Object.keys(payload).sort(), ['difficulty', 'estimatedAnswerSeconds', 'expectedConcepts', 'followUpQuestions', 'question', 'subtopic', 'topic'].sort());
  assert.equal(payload.topic, 'React');
  assert.equal(payload.followUpQuestions.length, 1);
});

test('summarizeInterviewProgress tracks answered and skipped counts', () => {
  const summary = summarizeInterviewProgress([
    { status: 'answered' },
    { status: 'answered' },
    { status: 'skipped' },
    { status: 'pending' },
  ]);

  assert.equal(summary.answered, 2);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.pending, 1);
  assert.equal(summary.completionRate, 50);
});
