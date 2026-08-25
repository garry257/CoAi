import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createInterview, startInterview } from '../features/interview/api';
import { getCandidateProfile } from '../features/resume/api';
import {
  FiArrowLeft, FiMic, FiType, FiClock, FiZap,
  FiCheckCircle
} from 'react-icons/fi';

const InterviewConfiguration = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [interviewMode, setInterviewMode] = useState('text'); // 'text' or 'voice'
  const [candidateProfileId, setCandidateProfileId] = useState(null);
  const [config, setConfig] = useState({
    role: '',
    interviewType: 'resume_based',
    company: '',
    durationMinutes: 30,
    difficulty: 'medium',
  });

  useEffect(() => {
    checkCandidateProfile();
  }, []);

  const checkCandidateProfile = async () => {
    try {
      const profile = await getCandidateProfile();
      if (profile && profile._id) {
        setCandidateProfileId(profile._id);
      }
    } catch (err) {
      console.error('No candidate profile found:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: name === 'durationMinutes' ? parseInt(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setConfigError('');
    setConfigLoading(true);

    try {
      if (!config.role.trim()) {
        setConfigError('Please enter a target role');
        setConfigLoading(false);
        return;
      }

      // Create interview
      const interviewRes = await createInterview({
        ...config,
        candidateProfileId,
      });

      if (!interviewRes.success) {
        if (interviewRes.message?.toLowerCase().includes('upload your resume')) {
          navigate('/resume-upload', { state: { from: '/interview-config' } });
          return;
        }
        setConfigError(interviewRes.message || 'Failed to create interview');
        setConfigLoading(false);
        return;
      }

      const interviewId = interviewRes.data._id;

      // Start interview and generate questions
      const startRes = await startInterview(interviewId);

      if (!startRes.success) {
        setConfigError(startRes.message || 'Failed to start interview');
        setConfigLoading(false);
        return;
      }

      // Navigate based on selected mode
      if (interviewMode === 'voice') {
        navigate(`/interview/${interviewId}/voice`);
      } else {
        navigate(`/interview/${interviewId}`);
      }
    } catch (err) {
      setConfigError(err.message || 'An error occurred');
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div className="coai-config-page">
      {/* Background blur effect */}
      <div className="coai-config-background" />

      {/* Content */}
      <div className="coai-config-container">
        {/* Header with back button */}
        <div className="coai-config-header">
          <button
            className="coai-config-back-btn"
            onClick={() => navigate('/dashboard')}
            type="button"
          >
            <FiArrowLeft size={20} />
            Back
          </button>
          <h1 className="coai-config-title">Configure Your Interview</h1>
          <div style={{ width: '80px' }} /> {/* Spacer */}
        </div>

        <div className="coai-config-wrapper">
          {/* Mode Selection */}
          <div className="coai-config-section">
            <h2 className="coai-config-section-title">Interview Mode</h2>
            <div className="coai-mode-selector">
              <button
                className={`coai-mode-btn ${interviewMode === 'text' ? 'active' : ''}`}
                onClick={() => setInterviewMode('text')}
                type="button"
              >
                <FiType size={24} />
                <span>Text Interview</span>
                <small>Type your answers</small>
              </button>
              <button
                className={`coai-mode-btn ${interviewMode === 'voice' ? 'active' : ''}`}
                onClick={() => setInterviewMode('voice')}
                type="button"
              >
                <FiMic size={24} />
                <span>Voice Interview</span>
                <small>Speak your answers</small>
              </button>
            </div>
          </div>

          {/* Configuration Form */}
          <form onSubmit={handleSubmit} className="coai-config-form">
            {/* Error Message */}
            {configError && (
              <div className="coai-config-error">
                <span>⚠️ {configError}</span>
              </div>
            )}

            {/* Target Role */}
            <div className="coai-config-field">
              <label htmlFor="role" className="coai-config-label">
                Target Role <span className="required">*</span>
              </label>
              <input
                type="text"
                id="role"
                name="role"
                value={config.role}
                onChange={handleChange}
                placeholder="e.g., Senior Frontend Developer"
                className="coai-config-input"
                disabled={configLoading}
              />
            </div>

            {/* Interview Type */}
            <div className="coai-config-field">
              <label htmlFor="type" className="coai-config-label">
                Interview Type <span className="required">*</span>
              </label>
              <select
                id="type"
                name="interviewType"
                value={config.interviewType}
                onChange={handleChange}
                className="coai-config-select"
                disabled={configLoading}
              >
                <option value="resume_based">Resume-Based</option>
                <option value="hr">HR / Behavioral</option>
                <option value="company_specific">Company Specific</option>
              </select>
            </div>

            {/* Company */}
            <div className="coai-config-field">
              <label htmlFor="company" className="coai-config-label">
                Company <span className="optional">(Optional)</span>
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={config.company}
                onChange={handleChange}
                placeholder="e.g., Google, Microsoft"
                className="coai-config-input"
                disabled={configLoading}
              />
            </div>

            {/* Duration & Difficulty */}
            <div className="coai-config-row">
              <div className="coai-config-field">
                <label htmlFor="duration" className="coai-config-label">
                  Duration <span className="required">*</span>
                </label>
                <select
                  id="duration"
                  name="durationMinutes"
                  value={config.durationMinutes}
                  onChange={handleChange}
                  className="coai-config-select"
                  disabled={configLoading}
                >
                  <option value="10">10 minutes</option>
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>

              <div className="coai-config-field">
                <label htmlFor="difficulty" className="coai-config-label">
                  Difficulty <span className="required">*</span>
                </label>
                <div className="coai-difficulty-grid">
                  {['easy', 'medium', 'hard'].map(level => (
                    <label key={level} className="coai-difficulty-option">
                      <input
                        type="radio"
                        name="difficulty"
                        value={level}
                        checked={config.difficulty === level}
                        onChange={handleChange}
                        disabled={configLoading}
                      />
                      <span className="coai-difficulty-label">
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="coai-config-actions">
              <button
                type="button"
                className="coai-config-btn-secondary"
                onClick={() => navigate('/dashboard')}
                disabled={configLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="coai-config-btn-primary"
                disabled={configLoading}
              >
                {configLoading ? 'Starting Interview...' : 'Start Interview'}
                {!configLoading && <FiZap size={18} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InterviewConfiguration;
