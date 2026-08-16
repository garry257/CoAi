import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/InterviewResults.css';
import { getInterview } from '../features/interview/api';

const InterviewResults = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await getInterview(id);

        if (!res.success) {
          setError(res.message);
          return;
        }

        setInterview(res.data.interview);
        setQuestions(res.data.questions);
      } catch (err) {
        setError('Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const answeredQuestions = questions.filter(q => q.status === 'answered');
  const skippedQuestions = questions.filter(q => q.status === 'skipped');
  const percentageAnswered = Math.round((answeredQuestions.length / questions.length) * 100);

  if (loading) {
    return (
      <div className="interview-results">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="interview-results">
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

  if (!interview) {
    return (
      <div className="interview-results">
        <div className="error-container">
          <h2>Interview Not Found</h2>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="interview-results">
      <div className="results-container">
        {/* Header */}
        <div className="results-header">
          <h1>Interview Completed! 🎉</h1>
          <p className="subtitle">Here's a summary of your performance</p>
        </div>

        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <h3>Role</h3>
            <p className="value">{interview.role}</p>
          </div>

          <div className="summary-card">
            <h3>Interview Type</h3>
            <p className="value">{interview.interviewType}</p>
          </div>

          <div className="summary-card">
            <h3>Difficulty</h3>
            <p className="value">{interview.difficulty}</p>
          </div>

          <div className="summary-card">
            <h3>Duration</h3>
            <p className="value">{formatDuration(interview.actualDurationSeconds || 0)}</p>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="performance-section">
          <h2>Performance Summary</h2>
          
          <div className="performance-grid">
            <div className="stat-box">
              <div className="stat-number">{answeredQuestions.length}/{questions.length}</div>
              <div className="stat-label">Questions Answered</div>
              <div className="stat-percentage">{percentageAnswered}%</div>
            </div>

            <div className="stat-box">
              <div className="stat-number">{skippedQuestions.length}</div>
              <div className="stat-label">Questions Skipped</div>
            </div>

            <div className="stat-box">
              <div className="stat-number">{interview.overallScore || 0}</div>
              <div className="stat-label">Overall Score</div>
              <div className="stat-message">(Out of 100)</div>
            </div>
          </div>
        </div>

        {/* Questions Review */}
        <div className="questions-review">
          <h2>Questions Review</h2>
          
          <div className="questions-list">
            {questions.map((question, idx) => (
              <div key={idx} className={`question-review-item status-${question.status}`}>
                <div className="question-number">
                  {question.status === 'answered' ? '✓' : '○'}
                  {' '}
                  Q{question.questionNumber}
                </div>

                <div className="question-details">
                  <div className="question-title">
                    <span className="topic">{question.topic}</span>
                    {question.subtopic && <span className="subtopic">{question.subtopic}</span>}
                    <span className={`difficulty difficulty-${question.difficulty}`}>
                      {question.difficulty}
                    </span>
                  </div>

                  <p className="question-text">{question.question}</p>

                  {question.answer && question.status === 'answered' && (
                    <details className="answer-details">
                      <summary>View Your Answer</summary>
                      <div className="answer-box">
                        <p>{question.answer.candidateText}</p>
                        {question.answer.duration_seconds && (
                          <p className="answer-time">
                            Time spent: {Math.ceil(question.answer.duration_seconds / 60)} minutes
                          </p>
                        )}
                      </div>
                    </details>
                  )}

                  {question.status === 'skipped' && (
                    <p className="skipped-message">This question was skipped</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="results-actions">
          <button
            onClick={() => navigate('/interview-config')}
            className="btn btn-primary"
          >
            Start Another Interview
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-secondary"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Tips Section */}
        <div className="tips-section">
          <h3>💡 Tips for Next Time</h3>
          <ul>
            <li>Try to answer all questions - skipping leaves gaps in your preparation</li>
            <li>Take time to think through your answers thoroughly</li>
            <li>Structure your answers with clear examples and reasoning</li>
            <li>Practice explaining your technical decisions and trade-offs</li>
            <li>Review skipped questions and practice them for next time</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InterviewResults;
