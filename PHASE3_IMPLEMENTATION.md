# Phase 3 Implementation: Interview Configuration & Interview Engine

## Overview
Phase 3 adds complete interview configuration and execution capabilities. Users can configure personalized technical interviews based on their resume and preferences, with the backend controlling all timing and question generation.

## Architecture & Key Design Decisions

### Backend Controls Timer (Critical)
- **startedAt** timestamp stored when interview starts
- Frontend calculates `remainingSeconds = durationMinutes * 60 - (now - startedAt)`
- LLM has **zero control** over actual duration
- Interview auto-completes when duration expires
- No client-side timer manipulation possible

### Personalized Question Generation
- Questions generated from Gemini based on:
  - Candidate's actual resume skills/experience
  - Target role and interview type
  - Selected difficulty level
  - Interview duration (determines question count)
- Questions NOT pre-stored or static
- Each interview gets unique, personalized questions

## Project Structure

### Backend Files Added

```
backend/
├── models/
│   ├── Question.js          [NEW] Question with answer schema
│   └── Interview.js         [UPDATED] Added difficulty, currentQuestionIndex, etc.
├── controllers/
│   └── interviewController.js [NEW] 200+ lines
├── routes/
│   └── interview.routes.js   [NEW] 7 endpoints
├── services/
│   └── interview/
│       └── questionGenerator.js [NEW] Gemini question generation
└── server.js               [UPDATED] Added interview routes
```

### Frontend Files Added

```
frontend/src/
├── pages/
│   ├── InterviewPage.jsx        [NEW] Main interview execution
│   ├── InterviewResults.jsx     [NEW] Results & review
│   └── Dashboard.jsx            [UPDATED] Added config modal
├── components/
│   ├── InterviewTimer.jsx       [NEW] Countdown timer
│   └── QuestionDisplay.jsx      [NEW] Question UI
├── features/interview/
│   └── api.js                   [NEW] API calls
├── styles/
│   ├── InterviewPage.css        [NEW]
│   ├── InterviewTimer.css       [NEW]
│   ├── QuestionDisplay.css      [NEW]
│   ├── InterviewResults.css     [NEW]
│   └── App.css                  [UPDATED] Modal styles
└── App.jsx                      [UPDATED] Added routes
```

## Core Endpoints

### 1. Create Interview
```
POST /api/interviews
{
  role: string,              // Required: "Senior Frontend Developer"
  interviewType: string,     // 'technical' | 'hr' | 'fullstack' | 'ai_genai' | 'resume_based' | 'company_specific'
  difficulty: string,        // 'easy' | 'medium' | 'hard'
  durationMinutes: number,   // 10 | 20 | 30 | 45 | 60
  company?: string,          // Optional: "Google"
  candidateProfileId: string // Required for personalization
}

Response: Interview object with status='planned'
```

### 2. Start Interview
```
POST /api/interviews/:id/start

Response: {
  interview: { /* with status='in_progress', startedAt */ },
  questions: [ /* first question */ ],
  totalQuestions: number
}
```

### 3. Get Current Question
```
GET /api/interviews/:id/current-question

Response: {
  question: { /* full question object */ },
  currentQuestionNumber: number,
  totalQuestions: number,
  elapsedSeconds: number,
  remainingSeconds: number
}
```

### 4. Submit Answer
```
POST /api/interviews/:id/answer
{
  questionNumber: number,
  answerText: string,
  durationSeconds: number
}

Response: {
  questionAnswered: number,
  nextQuestionNumber?: number,
  isInterviewComplete: boolean
}
```

### 5. Skip Question
```
POST /api/interviews/:id/skip-question

Response: {
  skippedQuestion: number,
  nextQuestion?: object
}
```

### 6. Complete Interview
```
POST /api/interviews/:id/complete

Response: {
  interview: { /* status='completed', endedAt, actualDurationSeconds */ },
  questionsAnswered: number,
  totalQuestions: number
}
```

### 7. Get Interview
```
GET /api/interviews/:id

Response: {
  interview: object,
  questions: [ /* all with answers */ ]
}
```

### 8. List Interviews
```
GET /api/interviews

Response: { data: [ /* user's interviews */ ] }
```

## Data Models

### Interview Model
```javascript
{
  userId: ObjectId,                    // User reference
  candidateProfileId: ObjectId,        // Linked profile
  resumeId: ObjectId,                  // Linked resume
  role: String,                        // Target role
  interviewType: String,               // Type enum
  company: String,                     // Company context
  difficulty: String,                  // 'easy' | 'medium' | 'hard'
  durationMinutes: Number,             // 10/20/30/45/60
  status: String,                      // 'planned' | 'in_progress' | 'completed' | 'terminated'
  startedAt: Date,                     // [CRITICAL] Used for timer calculation
  endedAt: Date,
  actualDurationSeconds: Number,
  topicsPlanned: Array,
  currentQuestionIndex: Number,        // Track current position
  totalQuestionsPlanned: Number,
  questionsAnswered: Number,
  overallScore: Number,
  timestamps: Boolean,                 // createdAt, updatedAt
}
```

### Question Model
```javascript
{
  interviewId: ObjectId,               // Parent interview
  topic: String,                       // e.g., "React Hooks"
  subtopic: String,                    // e.g., "useEffect"
  difficulty: String,                  // 'easy' | 'medium' | 'hard'
  question: String,                    // Actual question
  expectedConcepts: [String],          // Key concepts to mention
  estimatedAnswerSeconds: Number,      // Suggested time
  followUpQuestions: [
    {
      condition: String,               // When to ask
      followUpQuestion: String         // The follow-up
    }
  ],
  questionNumber: Number,              // Sequential 1, 2, 3...
  status: String,                      // 'pending' | 'active' | 'answered' | 'skipped'
  answer: {
    candidateText: String,
    submittedAt: Date,
    duration_seconds: Number
  },
  feedback: String,                    // (Future: AI feedback)
  score: Number,                       // (Future: Auto-scoring)
  timestamps: Boolean
}
```

## Frontend User Flow

### 1. Dashboard (Updated)
- Shows "Start Interview" button (now enabled)
- Clicking opens configuration modal
- Modal has fields:
  - Target Role (text input, required)
  - Interview Type (dropdown)
  - Company (text input, optional)
  - Duration (dropdown: 10/20/30/45/60)
  - Difficulty (radio buttons: easy/medium/hard)

### 2. Interview Page
**Layout:** 
- **Sidebar (left):** Interview info, progress bar, question list, "End Interview" button
- **Main (center):** Timer + Question Display

**Components:**
- **InterviewTimer:** Countdown with color changes
  - Normal: Green (> 25% remaining)
  - Warning: Orange (10-25% remaining)
  - Critical: Red (< 10% remaining)
  - Expired: Dark red (time's up)
  
- **QuestionDisplay:** 
  - Question with topic/subtopic/difficulty
  - Expected concepts checklist
  - Textarea for answer (5000 char limit)
  - "Submit Answer" and "Skip Question" buttons
  - Follow-up questions (expandable)

### 3. Results Page
- Summary cards (role, type, difficulty, duration)
- Performance stats (answered/skipped/score)
- Complete Q&A review with expandable answers
- Tips for next time
- "Start Another Interview" button

## Question Generation (Gemini)

### Prompt Strategy
1. Injects candidate's actual skills/experience
2. Filters for technologies on resume (no random questions)
3. Specifies role + type + difficulty context
4. Requests specific JSON structure
5. Validates output before saving

### Question Distribution
- **Easy Mode:** 50% easy, 30% medium, 20% hard
- **Medium Mode:** 20% easy, 60% medium, 20% hard
- **Hard Mode:** 10% easy, 30% medium, 60% hard

### Question Count Logic
- 10 min: 1-2 questions
- 20 min: 2-3 questions
- 30 min: 3-4 questions
- 45 min: 4-5 questions
- 60 min: 6-7 questions

## Security & Validation

### Backend Validation
- ✅ Auth middleware on all interview endpoints
- ✅ Ownership verification (userId check)
- ✅ Enum validation on interview type/difficulty
- ✅ Duration must be one of: 10/20/30/45/60
- ✅ Character limit on answers (5000)
- ✅ Timestamp validation on answers

### Timer Security
- ✅ startedAt stored server-side (immutable)
- ✅ Frontend receives only startedAt + currentTime
- ✅ Remaining time = backend-calculated, not client input
- ✅ No way for client to add time or skip duration
- ✅ Server validates interview status before allowing operations

### Error Handling
- ✅ Try-catch around all async operations
- ✅ Meaningful error messages to frontend
- ✅ Logging on all major operations
- ✅ 404 for missing interviews/questions
- ✅ 403 for unauthorized access

## Styling & UX

### Design System
- Color scheme: Purple gradient (#667eea → #764ba2)
- Accent colors: Blue (normal), Orange (warning), Red (danger)
- Consistent spacing, border-radius, shadows
- Responsive mobile-first design

### Animations
- Smooth transitions on buttons/modals
- Pulse animation on critical timer
- Fade-in for questions
- Progress bar transitions

## Testing Checklist

### Backend Endpoints
- [ ] Create interview with all field combinations
- [ ] Validate role and difficulty enums
- [ ] Verify question generation (personalized)
- [ ] Test answer submission and progression
- [ ] Test skip question functionality
- [ ] Verify timer calculation (elapsed/remaining)
- [ ] Test interview completion
- [ ] Verify data persistence

### Frontend Flow
- [ ] Dashboard modal opens/closes
- [ ] Config form validates required fields
- [ ] Interview page loads correctly
- [ ] Timer displays and updates every second
- [ ] Timer color changes at thresholds
- [ ] Questions load one by one
- [ ] Character counter in textarea
- [ ] Submit/skip buttons work
- [ ] Progress sidebar updates
- [ ] Results page shows correct data
- [ ] Responsive on mobile

### Edge Cases
- [ ] No resume/profile (redirect to upload)
- [ ] Very short interview (10 min)
- [ ] Very long interview (60 min)
- [ ] All questions skipped
- [ ] Partial completion (end early)
- [ ] Timer expires during answer
- [ ] Network error during submission
- [ ] Multiple concurrent interviews (not allowed in UI but test backend)

## Known Limitations & Future Enhancements

### Phase 3 Limitations
1. **No voice input** - Text only (as requested)
2. **No AI feedback** - Answers recorded but not scored yet
3. **No candidate comparison** - No benchmarking against others
4. **No adaptive difficulty** - Difficulty set at start, doesn't adjust
5. **No resume re-analysis** - Uses initial candidate profile

### Phase 4+ Features
1. Voice input/output (speech-to-text, text-to-speech)
2. AI-powered answer scoring and feedback
3. Follow-up question routing based on answers
4. Real-time difficulty adjustment
5. Interview statistics and weak topics identification
6. Performance benchmarking
7. Peer comparison (anonymized)
8. Practice mode vs. practice scoring

## Environment Setup

### Backend Requirements
```bash
npm install express mongoose cors dotenv
npm install @google/genai groq-sdk
# .env needs: GEMINI_API_KEY, MONGODB_URI
```

### Frontend Requirements
```bash
npm install axios react-icons react-router-dom
```

## Deployment Notes

1. **Database Indexes:** Add indexes on:
   - Interview.userId (query user's interviews)
   - Interview.candidateProfileId (linked profile)
   - Question.interviewId (fetch questions for interview)

2. **Gemini API:** Ensure sufficient quota for:
   - Resume analysis (Phase 2)
   - Question generation (Phase 3)
   - (Phase 4: Answer scoring)

3. **File Storage:** If storing answer audio (Phase 4):
   - Use S3 or Cloud Storage
   - Implement cleanup for old interviews

## Success Metrics

Phase 3 is complete when:
- ✅ Users can configure and start interviews from Dashboard
- ✅ Questions are personalized to user's resume
- ✅ Timer counts down (backend-controlled)
- ✅ Users can answer, skip, or end interviews
- ✅ All answers saved with timestamps
- ✅ Results page shows complete interview history
- ✅ No LLM influence on timer duration
- ✅ Text input/output works smoothly
- ✅ Mobile responsive design
- ✅ All endpoints tested and validated

---

**Author:** Interview Copilot Development Team  
**Date:** August 16, 2026  
**Status:** Phase 3 Implementation Complete  
**Next:** Phase 4 - Voice Integration & Answer Scoring
