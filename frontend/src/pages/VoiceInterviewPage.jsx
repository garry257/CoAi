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
  const [manualAnswerText, setManualAnswerText] = useState('');

  const {
    isConnected,
    isRecording,
    isSpeaking,
    transcript,
    error: wsError,
    availableVoices,
    selectedVoiceIndex,
    setSelectedVoiceIndex,
    connect,
    disconnect,
    initSession,
    updateContext,
    startRecording,
    stopRecording,
    speakText,
    stopSpeaking,
    clearTranscript,
  } = useAudioStream(id);

  // Sync transcript from speech recognition into editable textarea state
  useEffect(() => {
    if (transcript) {
      setManualAnswerText(transcript);
    }
  }, [transcript]);

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

  // Auto-read question out loud when question loads
  useEffect(() => {
    if (currentQuestion && currentQuestion.question) {
      const timer = setTimeout(() => {
        speakText(currentQuestion.question);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentQuestion, speakText]);

  const handleTimeExpired = useCallback(async () => {
    if (interview && interview.status === 'in_progress') {
      await handleCompleteInterview();
    }
  }, [interview]);

  const handleClear = () => {
    clearTranscript();
    setManualAnswerText('');
  };

  const handleNextQuestion = async () => {
    if (!currentQuestion) return;

    stopSpeaking();
    stopRecording();
    setSubmitting(true);
    
    // Use accumulated transcript or manual text as answer text
    const answerText = manualAnswerText.trim() || transcript.trim() || "(Candidate answered verbally)";
    
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
        setInterview(prev => ({
          ...prev,
          questionsAnswered: res.data.totalAnswered,
          currentQuestionIndex: prev.currentQuestionIndex + 1,
        }));

        const nextRes = await getCurrentQuestion(id);
        if (nextRes.success) {
          setCurrentQuestion(nextRes.data.question);
          handleClear();
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
    stopSpeaking();
    stopRecording();
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
          <div className="question-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Question {interview.currentQuestionIndex + 1} of {interview.totalQuestionsPlanned}</h3>
            
            {/* Read Question Button */}
            <button
              onClick={() => {
                if (isSpeaking) {
                  stopSpeaking();
                } else if (currentQuestion?.question) {
                  speakText(currentQuestion.question);
                }
              }}
              className="btn btn-secondary"
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: isSpeaking ? '#6366f1' : 'var(--border-color)',
                backgroundColor: isSpeaking ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                color: isSpeaking ? '#6366f1' : 'inherit'
              }}
            >
              {isSpeaking ? '🔊 AI Speaking...' : '🔊 Read Question Out Loud'}
            </button>
          </div>
          
          <p className="question-text" style={{ fontSize: '1.25rem', lineHeight: '1.6', margin: '20px 0' }}>
            {currentQuestion?.question}
          </p>
          
          <div className="voice-interface" style={{ marginTop: '30px', padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
             
             {/* Header Banner */}
             <div style={{
                backgroundColor: '#6366f1',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '0.95rem',
                letterSpacing: '0.5px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                gap: '8px'
             }}>
                <span>🎙️</span> Voice AI Interview Session Active
             </div>

             <h4 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Voice Controls</h4>
             
             <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                {!isRecording ? (
                   <button 
                    onClick={startRecording} 
                    className="btn btn-primary" 
                    disabled={!isConnected}
                    style={{
                      padding: '12px 24px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                    }}
                   >
                      🎤 Start Speaking
                   </button>
                ) : (
                   <button 
                    onClick={stopRecording} 
                    className="btn btn-secondary" 
                    style={{ 
                      backgroundColor: '#dc3545', 
                      color: 'white',
                      padding: '12px 24px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      animation: 'pulse 1.5s infinite'
                    }}
                   >
                      ⏹️ Stop Speaking
                   </button>
                )}

                {isSpeaking && (
                  <button
                    onClick={stopSpeaking}
                    className="btn btn-secondary"
                    style={{ padding: '12px 20px', fontSize: '0.95rem' }}
                  >
                    🔇 Mute AI Voice
                  </button>
                )}

                {availableVoices && availableVoices.length > 0 && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>AI Voice:</label>
                    <select
                      value={selectedVoiceIndex}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setSelectedVoiceIndex(idx);
                        if (currentQuestion?.question) {
                          speakText(currentQuestion.question);
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#1e293b',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {availableVoices.map((v, i) => (
                        <option key={i} value={i}>
                          {v.name.replace(/Microsoft |Google /g, '')} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
             </div>

             <div className="status-indicators" style={{ marginBottom: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div>
                  Connection Status: <span style={{ color: isConnected ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>{isConnected ? '✓ Connected' : 'Connecting...'}</span>
                </div>
                {isSpeaking && (
                  <div style={{ color: '#6366f1', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ animation: 'blink 1s infinite' }}>🔊</span> AI Speaking question...
                  </div>
                )}
                {isRecording && (
                  <div style={{ color: '#dc3545', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ animation: 'blink 1s infinite' }}>🔴</span> Listening to your voice...
                  </div>
                )}
                {wsError && <p style={{ color: '#dc3545', marginTop: '10px' }}>{wsError}</p>}
             </div>

             <div className="transcript-box" style={{ 
                backgroundColor: '#ffffff', 
                padding: '18px', 
                borderRadius: '10px',
                border: isRecording ? '2px solid #6366f1' : '1px solid #cbd5e1',
                marginBottom: '24px',
                boxShadow: isRecording ? '0 0 12px rgba(99, 102, 241, 0.25)' : 'none',
                transition: 'all 0.3s ease'
             }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h5 style={{ color: '#475569', margin: 0, fontWeight: '600', fontSize: '0.95rem' }}>
                    Live Transcript & Answer Textbox:
                  </h5>
                  {manualAnswerText && (
                    <button 
                      onClick={handleClear} 
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Clear Text
                    </button>
                  )}
                </div>

                <textarea
                  value={manualAnswerText}
                  onChange={(e) => setManualAnswerText(e.target.value)}
                  placeholder={isRecording ? '🎤 Listening to your microphone... speak your response now!' : 'Click "Start Speaking" to speak your answer, or type your answer here directly...'}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '1.05rem',
                    lineHeight: '1.6',
                    color: '#0f172a',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    fontWeight: '500'
                  }}
                />
             </div>

             <button 
                onClick={handleNextQuestion} 
                className="btn btn-primary"
                disabled={submitting || isRecording}
                style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 'bold' }}
             >
                {submitting ? 'Saving Answer...' : 'Submit Answer & Next Question →'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterviewPage;
