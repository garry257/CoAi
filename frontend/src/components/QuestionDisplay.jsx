import React, { useState } from 'react';
import '../styles/QuestionDisplay.css';

const QuestionDisplay = ({ question, currentNumber, totalQuestions, onAnswer, onSkip, loading }) => {
  const [answer, setAnswer] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [showFollowUps, setShowFollowUps] = useState(false);

  const maxChars = 5000;

  const handleAnswerChange = (e) => {
    const text = e.target.value;
    if (text.length <= maxChars) {
      setAnswer(text);
      setCharCount(text.length);
    }
  };

  const handleSubmit = () => {
    if (!answer.trim()) {
      alert('Please provide an answer before submitting');
      return;
    }
    onAnswer(answer);
    setAnswer('');
    setCharCount(0);
  };

  const getDifficultyColor = () => {
    switch (question.difficulty) {
      case 'easy': return 'badge-easy';
      case 'hard': return 'badge-hard';
      default: return 'badge-medium';
    }
  };

  return (
    <div className="question-display">
      {/* Question Header */}
      <div className="question-header">
        <div className="question-meta">
          <span className={`difficulty-badge ${getDifficultyColor()}`}>
            {question.difficulty.toUpperCase()}
          </span>
          <span className="question-counter">
            Question {currentNumber} of {totalQuestions}
          </span>
        </div>
        <div className="question-topic">
          <h3>{question.topic}</h3>
          {question.subtopic && <p className="subtopic">{question.subtopic}</p>}
        </div>
      </div>

      {/* Question Body */}
      <div className="question-body">
        <div className="question-text">
          <h2>{question.question}</h2>
        </div>

        {/* Expected Concepts */}
        {question.expectedConcepts && question.expectedConcepts.length > 0 && (
          <div className="expected-concepts">
            <h4>💡 Key Concepts to Consider:</h4>
            <ul>
              {question.expectedConcepts.map((concept, idx) => (
                <li key={idx}>{concept}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Estimated Time */}
        <div className="estimated-time">
          <span>⏱️ Estimated answer time: {Math.ceil(question.estimatedAnswerSeconds / 60)} minutes</span>
        </div>
      </div>

      {/* Answer Input */}
      <div className="answer-section">
        <div className="answer-header">
          <label htmlFor="answer">Your Answer</label>
          <span className="char-count">
            {charCount} / {maxChars} characters
          </span>
        </div>
        <textarea
          id="answer"
          value={answer}
          onChange={handleAnswerChange}
          placeholder="Type your answer here... Be thorough and explain your reasoning."
          rows={10}
          disabled={loading}
        />
      </div>

      {/* Follow-up Questions Info */}
      {question.followUpQuestions && question.followUpQuestions.length > 0 && (
        <div className="followup-info">
          <button
            type="button"
            className="btn-followup-toggle"
            onClick={() => setShowFollowUps(!showFollowUps)}
          >
            {showFollowUps ? '−' : '+'} Show Follow-up Questions ({question.followUpQuestions.length})
          </button>
          {showFollowUps && (
            <div className="followup-list">
              {question.followUpQuestions.map((fq, idx) => (
                <div key={idx} className="followup-item">
                  <p className="followup-condition">When: {fq.condition}</p>
                  <p className="followup-question">Q: {fq.followUpQuestion}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="answer-actions">
        <button
          onClick={handleSubmit}
          disabled={loading || !answer.trim()}
          className="btn btn-primary"
        >
          {loading ? 'Submitting...' : 'Submit Answer'}
        </button>
        <button
          onClick={onSkip}
          disabled={loading}
          className="btn btn-secondary"
        >
          Skip Question
        </button>
      </div>
    </div>
  );
};

export default QuestionDisplay;
