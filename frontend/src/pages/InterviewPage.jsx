import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/InterviewPage.css';
import InterviewTimer from '../components/InterviewTimer';
import QuestionDisplay from '../components/QuestionDisplay';
import {
  getCurrentQuestion,
  submitAnswer,
  completeInterview,
  skipQuestion,
  getInterview,
} from '../features/interview/api';

const InterviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch current question on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [interviewRes, questionRes] = await Promise.all([
          getInterview(id),
          getCurrentQuestion(id),
        ]);

        if (!interviewRes.success) {
          setError(interviewRes.message);
          return;
        }

        if (!questionRes.success) {
          setError(questionRes.message);
          return;
        }

        setInterview(interviewRes.data.interview);
        setCurrentQuestion(questionRes.data.question);
        setElapsedSeconds(questionRes.data.elapsedSeconds);
      } catch (err) {
        setError('Failed to load interview');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleTimeExpired = useCallback(async () => {
    // Auto-complete interview if time runs out
    if (interview && interview.status === 'in_progress') {
      await handleCompleteInterview();
    }
  }, [interview]);

  const handleAnswerSubmit = async (answerText) => {
    if (!currentQuestion) return;

    setSubmitting(true);
    try {
      const res = await submitAnswer(
        id,
        currentQuestion.questionNumber,
        answerText,
        Math.ceil(elapsedSeconds / currentQuestion.questionNumber) // Rough estimate
      );

      if (!res.success) {
        setError(res.message);
        return;
      }

      if (res.data.isInterviewComplete) {
        // Interview complete
        navigate(`/interview/${id}/results`, { replace: true });
      } else if (res.data.nextQuestionNumber) {
        // Update local interview state
        setInterview(prev => ({
          ...prev,
          questionsAnswered: res.data.totalAnswered,
          currentQuestionIndex: prev.currentQuestionIndex + 1,
        }));

        // Load next question
        const nextRes = await getCurrentQuestion(id);
        if (nextRes.success) {
          setCurrentQuestion(nextRes.data.question);
        } else {
          setError('Failed to load next question');
        }
      }
    } catch (err) {
      setError('Error submitting answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipQuestion = async () => {
    if (!currentQuestion) return;

    try {
      const res = await skipQuestion(id);

      if (!res.success) {
        setError(res.message);
        return;
      }

      if (res.data.nextQuestion) {
        // Update local interview state
        setInterview(prev => ({
          ...prev,
          currentQuestionIndex: prev.currentQuestionIndex + 1,
        }));
        setCurrentQuestion(res.data.nextQuestion);
      } else {
        // No more questions
        navigate(`/interview/${id}/results`, { replace: true });
      }
    } catch (err) {
      setError('Error skipping question');
    }
  };

  const handleCompleteInterview = async () => {
    try {
      const res = await completeInterview(id);
      if (res.success) {
        navigate(`/interview/${id}/results`, { replace: true });
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError('Error completing interview');
    }
  };

  if (loading) {
    return (
      <div className="interview-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="interview-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!interview || !currentQuestion) {
    return (
      <div className="interview-page">
        <div className="error-container">
          <h2>Interview Not Found</h2>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const totalSeconds = interview.durationMinutes * 60;

  return (
    <div className="interview-page">
      {/* Sidebar with Progress */}
      <div className="interview-sidebar">
        <div className="interview-info">
          <h3>{interview.role}</h3>
          <p className="interview-type">{interview.interviewType}</p>
          {interview.company && <p className="interview-company">{interview.company}</p>}
        </div>

        <div className="progress-section">
          <h4>Progress</h4>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(interview.questionsAnswered / interview.totalQuestionsPlanned) * 100}%`
              }}
            ></div>
          </div>
          <p className="progress-text">
            {interview.questionsAnswered} of {interview.totalQuestionsPlanned} questions answered
          </p>
        </div>

        <div className="question-list">
          <h4>Questions</h4>
          <div className="questions">
            {[...Array(interview.totalQuestionsPlanned)].map((_, i) => (
              <div
                key={i}
                className={`question-item ${
                  i === interview.currentQuestionIndex ? 'active' : ''
                } ${i < interview.questionsAnswered ? 'completed' : ''}`}
              >
                {i < interview.questionsAnswered ? '✓' : i + 1}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleCompleteInterview}
          className="btn btn-secondary btn-complete"
          disabled={submitting}
        >
          End Interview
        </button>
      </div>

      {/* Main Content */}
      <div className="interview-main">
        {/* Timer */}
        <InterviewTimer
          startedAt={interview.startedAt}
          totalSeconds={totalSeconds}
          onTimeExpired={handleTimeExpired}
        />

        {/* Question */}
        <QuestionDisplay
          question={currentQuestion}
          currentNumber={interview.currentQuestionIndex + 1}
          totalQuestions={interview.totalQuestionsPlanned}
          onAnswer={handleAnswerSubmit}
          onSkip={handleSkipQuestion}
          loading={submitting}
        />
      </div>
    </div>
  );
};

export default InterviewPage;
