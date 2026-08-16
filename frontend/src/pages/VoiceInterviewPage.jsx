import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/InterviewPage.css';
import InterviewTimer from '../components/InterviewTimer';
import {
  getCurrentQuestion,
  submitAnswer,
  completeInterview,
  getInterview,
} from '../features/interview/api';
import { useAudioStream } from '../hooks/useAudioStream';

const VoiceInterviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const {
    isConnected,
    isRecording,
    transcript,
    error: wsError,
    connect,
    disconnect,
    initSession,
    updateContext,
    startRecording,
    stopRecording,
    clearTranscript,
  } = useAudioStream(id);

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
        
        // Connect to WS
        connect();
      } catch (err) {
        setError('Failed to load interview');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      disconnect();
    };
  }, [id, connect, disconnect]);

  // Init Gemini Session once connected and data loaded
  useEffect(() => {
    if (isConnected && interview && currentQuestion) {
       initSession(interview.role, currentQuestion);
    }
  }, [isConnected, interview, currentQuestion, initSession]);

  const handleTimeExpired = useCallback(async () => {
    if (interview && interview.status === 'in_progress') {
      await handleCompleteInterview();
    }
  }, [interview]);

  const handleNextQuestion = async () => {
    if (!currentQuestion) return;

    setSubmitting(true);
    // Use the accumulated transcript as the answer text, fallback to something if empty
    const answerText = transcript.trim() || "(Candidate answered via voice, no transcript captured)";
    
    try {
      const res = await submitAnswer(
        id,
        currentQuestion.questionNumber,
        answerText,
        Math.ceil(elapsedSeconds / currentQuestion.questionNumber)
      );

      if (!res.success) {
        setError(res.message);
        return;
      }

      if (res.data.isInterviewComplete) {
        navigate(`/interview/${id}/results`, { replace: true });
      } else if (res.data.nextQuestionNumber) {
        const nextRes = await getCurrentQuestion(id);
        if (nextRes.success) {
          setCurrentQuestion(nextRes.data.question);
          clearTranscript();
          updateContext(nextRes.data.question);
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
          <p>Loading Voice Interview...</p>
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

  const totalSeconds = interview.durationMinutes * 60;

  return (
    <div className="interview-page">
      {/* Sidebar with Progress */}
      <div className="interview-sidebar">
        <div className="interview-info">
          <h3>{interview.role} (Voice Mode)</h3>
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

        {/* Question & Voice Interface */}
        <div className="question-display" style={{ marginTop: '20px' }}>
          <div className="question-header">
            <h3>Question {interview.currentQuestionIndex + 1} of {interview.totalQuestionsPlanned}</h3>
          </div>
          <p className="question-text">{currentQuestion?.question}</p>
          
          <div className="voice-interface" style={{ marginTop: '40px', padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
             <h4 style={{ marginBottom: '20px' }}>Voice Controls</h4>
             
             <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                {!isRecording ? (
                   <button onClick={startRecording} className="btn btn-primary" disabled={!isConnected}>
                      Start Speaking
                   </button>
                ) : (
                   <button onClick={stopRecording} className="btn btn-secondary" style={{ backgroundColor: '#dc3545', color: 'white' }}>
                      Stop Speaking
                   </button>
                )}
             </div>

             <div className="status-indicators" style={{ marginBottom: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Connection Status: <span style={{ color: isConnected ? '#28a745' : '#dc3545' }}>{isConnected ? 'Connected' : 'Connecting...'}</span>
                {wsError && <p style={{ color: '#dc3545', marginTop: '10px' }}>{wsError}</p>}
             </div>

             <div className="transcript-box" style={{ 
                minHeight: '150px', 
                backgroundColor: 'var(--bg-primary)', 
                padding: '15px', 
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '20px'
             }}>
                <h5 style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>Live Transcript:</h5>
                <p>{transcript || 'No speech detected yet...'}</p>
             </div>

             <button 
                onClick={handleNextQuestion} 
                className="btn btn-primary"
                disabled={submitting || isRecording}
                style={{ width: '100%' }}
             >
                {submitting ? 'Saving...' : 'Submit & Next Question'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterviewPage;
