import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardSummary, getDashboardProgress, deleteWeakTopic } from '../features/dashboard/api';
import { createInterview, startInterview, deleteInterview } from '../features/interview/api';
import { getCandidateProfile } from '../features/resume/api';
import {
  FiTarget, FiTrendingUp, FiAlertTriangle,
  FiPlay, FiUpload, FiUsers, FiArrowRight, FiAward,
  FiBarChart2, FiClock, FiX, FiAlertCircle, FiTrash2
} from 'react-icons/fi';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInterviewConfig, setShowInterviewConfig] = useState(false);
  const [interviewConfig, setInterviewConfig] = useState({
    role: '',
    interviewType: 'resume_based',
    company: '',
    durationMinutes: 30,
    difficulty: 'medium',
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [candidateProfileId, setCandidateProfileId] = useState(null);

  useEffect(() => {
    loadDashboard();
    checkCandidateProfile();
  }, []);

  const checkCandidateProfile = async () => {
    try {
      const profile = await getCandidateProfile();
      if (profile && profile._id) {
        setCandidateProfileId(profile._id);
      }
    } catch (err) {
      console.error('No candidate profile found yet:', err);
    }
  };

  const loadDashboard = async () => {
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setSummary({
        totalInterviews: 0,
        averageScore: 0,
        weakTopicsCount: 0,
        weakTopics: [],
        recentInterviews: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWeakTopic = async (topic) => {
    if (!window.confirm(`Are you sure you want to remove "${topic}" from your weak areas?`)) {
      return;
    }
    try {
      await deleteWeakTopic(topic);
      loadDashboard();
    } catch (err) {
      console.error('Failed to delete weak topic:', err);
    }
  };

  const handleDeleteInterview = async (interviewId) => {
    if (!window.confirm('Are you sure you want to delete this interview session permanently?')) {
      return;
    }
    try {
      await deleteInterview(interviewId);
      loadDashboard();
    } catch (err) {
      console.error('Failed to delete interview:', err);
    }
  };

  const handleStartInterview = () => {
    navigate('/interview-config');
  };

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setInterviewConfig(prev => ({
      ...prev,
      [name]: name === 'durationMinutes' ? parseInt(value) : value
    }));
  };

  const handleSubmitInterview = async (e) => {
    e.preventDefault();
    setConfigError('');
    setConfigLoading(true);

    try {
      if (!interviewConfig.role.trim()) {
        setConfigError('Please enter a target role');
        setConfigLoading(false);
        return;
      }

      // Create interview
      const interviewRes = await createInterview({
        ...interviewConfig,
        candidateProfileId,
      });

      if (!interviewRes.success) {
        if (interviewRes.message?.toLowerCase().includes('upload your resume')) {
          navigate('/resume-upload', { state: { from: '/dashboard' } });
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

      // Navigate to interview in text mode only for Phase 3.
      navigate(`/interview/${interviewId}`);
    } catch (err) {
      setConfigError(err.message || 'An error occurred');
    } finally {
      setConfigLoading(false);
    }
  };

  const displayName = user?.name || user?.username || 'there';

  if (loading) {
    return (
      <div className="coai-dashboard">
        <div className="coai-loading-screen">
          <div className="coai-loading-spinner" />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      icon: <FiTarget size={24} />,
      label: 'Total Interviews',
      value: summary?.totalInterviews || 0,
      accent: 'blue',
      description: 'Completed sessions',
    },
    {
      icon: <FiTrendingUp size={24} />,
      label: 'Average Score',
      value: `${summary?.averageScore || 0}%`,
      accent: 'green',
      description: 'Overall performance',
    },
    {
      icon: <FiAlertTriangle size={24} />,
      label: 'Weak Topics',
      value: summary?.weakTopicsCount || 0,
      accent: 'orange',
      description: 'Need improvement',
    },
  ];

  const quickActions = [
    {
      icon: <FiPlay size={20} />,
      label: 'Start Interview',
      description: 'Begin a new mock interview session',
      accent: 'blue',
      disabled: false,
      onClick: handleStartInterview,
    },
    {
      icon: <FiUpload size={20} />,
      label: 'Upload Resume',
      description: 'Analyze your resume for personalized prep',
      accent: 'green',
      disabled: false,
      onClick: () => navigate('/resume-upload'),
    },
    {
      icon: <FiUsers size={20} />,
      label: 'My Profile',
      description: 'View your extracted candidate profile',
      accent: 'purple',
      disabled: false,
      onClick: () => navigate('/profile'),
    },
  ];

  const hasData = summary?.totalInterviews > 0;

  return (
    <div className="coai-dashboard" id="coai-dashboard-page">
      {/* Welcome Section */}
      <header className="coai-dashboard-header">
        <div className="coai-dashboard-greeting">
          <h1 className="coai-dashboard-title">
            Welcome back, <span className="coai-highlight">{displayName}</span> 👋
          </h1>
          <p className="coai-dashboard-subtitle">
            Your AI-powered interview preparation hub. Let's ace your next interview.
          </p>
        </div>
        <div className="coai-dashboard-header-badge">
          <FiAward size={18} />
          <span>Interview Copilot</span>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="coai-stats-grid" id="coai-stats-section">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`coai-stat-card coai-stat-${stat.accent}`}
            style={{ animationDelay: `${index * 0.1}s` }}
            id={`stat-card-${stat.accent}`}
          >
            <div className="coai-stat-icon">{stat.icon}</div>
            <div className="coai-stat-info">
              <span className="coai-stat-value">{stat.value}</span>
              <span className="coai-stat-label">{stat.label}</span>
              <span className="coai-stat-desc">{stat.description}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Quick Actions */}
      <section className="coai-quick-actions-section" id="coai-actions-section">
        <h2 className="coai-section-title">
          <FiBarChart2 size={20} />
          Quick Actions
        </h2>
        <div className="coai-quick-actions-grid">
          {quickActions.map((action, index) => (
            <button
              key={action.label}
              className={`coai-quick-action coai-action-${action.accent} ${action.disabled ? 'disabled' : ''}`}
              onClick={action.onClick}
              disabled={action.disabled}
              style={{ animationDelay: `${0.4 + index * 0.1}s` }}
              id={`action-${action.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <div className="coai-action-icon">{action.icon}</div>
              <div className="coai-action-info">
                <span className="coai-action-label">{action.label}</span>
                <span className="coai-action-desc">{action.description}</span>
              </div>
              <FiArrowRight size={16} className="coai-action-arrow" />
              {action.disabled && <span className="coai-coming-soon">Coming Soon</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Weak Topics Breakdown */}
      {hasData && summary?.weakTopics?.length > 0 && (
        <section className="coai-activity-section" id="coai-weak-topics-section">
          <h2 className="coai-section-title">
            <FiAlertCircle size={20} />
            Weak Areas to Improve
          </h2>
          <div className="coai-weak-topics-list">
            {summary.weakTopics.map((wt) => (
              <div key={wt.topic} className="coai-weak-topic-item">
                <div className="coai-weak-topic-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="coai-weak-topic-name">{wt.topic}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="coai-weak-topic-count" style={{ fontSize: '0.85rem', opacity: 0.8 }}>{wt.count} weak question{wt.count > 1 ? 's' : ''}</span>
                    <button
                      onClick={() => handleDeleteWeakTopic(wt.topic)}
                      className="coai-delete-btn"
                      title="Remove from Weak Areas"
                      style={{ background: 'none', border: 'none', color: '#ff5c5c', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ff3333'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#ff5c5c'}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="coai-weak-topic-bar">
                  <div
                    className="coai-weak-topic-fill"
                    style={{ width: `${Math.min(100, wt.count * 20)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Activity / Empty State */}
      <section className="coai-activity-section" id="coai-activity-section">
        <h2 className="coai-section-title">
          <FiClock size={20} />
          Recent Interviews
        </h2>
        {hasData ? (
          <div className="coai-activity-list">
            {summary.recentInterviews.map((interview) => (
              <div key={interview._id} className="coai-activity-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div className="coai-activity-dot" />
                  <div className="coai-activity-info">
                    <span className="coai-activity-role">{interview.role}</span>
                    <span className="coai-activity-date">
                      {interview.interviewType?.replace('_', ' ').toUpperCase()} &bull; {new Date(interview.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span className={`coai-activity-score ${interview.overallScore >= 70 ? 'good' : interview.overallScore >= 40 ? 'mid' : 'low'}`}>
                    {interview.overallScore}%
                  </span>
                  <button
                    onClick={() => handleDeleteInterview(interview._id)}
                    className="coai-delete-btn"
                    title="Delete Interview Session"
                    style={{ background: 'none', border: 'none', color: '#ff5c5c', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff3333'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#ff5c5c'}
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="coai-empty-state">
            <div className="coai-empty-icon">
              <FiTarget size={48} />
            </div>
            <h3>No interviews yet</h3>
            <p>Complete your first mock interview to see your progress and stats here.</p>
            <button
              className="coai-empty-cta"
              onClick={handleStartInterview}
              id="empty-state-start-btn"
            >
              <FiPlay size={16} />
              Start Your First Interview
            </button>
          </div>
        )}
      </section>

      {/* Interview Configuration Modal */}
      {showInterviewConfig && (
        <div className="coai-modal-overlay" onClick={() => setShowInterviewConfig(false)}>
          <div className="coai-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="coai-modal-header">
              <h2>Configure Your Interview</h2>
              <button
                className="coai-modal-close"
                onClick={() => setShowInterviewConfig(false)}
              >
                <FiX size={24} />
              </button>
            </div>

            {configError && <div className="coai-modal-error">{configError}</div>}

            <form onSubmit={handleSubmitInterview} className="coai-interview-form">
              {/* Target Role */}
              <div className="coai-form-group">
                <label htmlFor="role">Target Role *</label>
                <input
                  type="text"
                  id="role"
                  name="role"
                  value={interviewConfig.role}
                  onChange={handleConfigChange}
                  placeholder="e.g., Senior Frontend Developer"
                  required
                />
              </div>

              {/* Interview Type */}
              <div className="coai-form-group">
                <label htmlFor="interviewType">Interview Type *</label>
                <select
                  id="interviewType"
                  name="interviewType"
                  value={interviewConfig.interviewType}
                  onChange={handleConfigChange}
                >
                  <option value="resume_based">Resume-Based</option>
                  <option value="hr">HR / Behavioral</option>
                  <option value="company_specific">Company Specific</option>
                </select>
              </div>

              {/* Company (Optional) */}
              <div className="coai-form-group">
                <label htmlFor="company">Company (Optional)</label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={interviewConfig.company}
                  onChange={handleConfigChange}
                  placeholder="e.g., Google, Microsoft"
                />
              </div>

              {/* Duration */}
              <div className="coai-form-group">
                <label htmlFor="durationMinutes">Interview Duration *</label>
                <select
                  id="durationMinutes"
                  name="durationMinutes"
                  value={interviewConfig.durationMinutes}
                  onChange={handleConfigChange}
                >
                  <option value={10}>10 minutes</option>
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>

              {/* Difficulty */}
              <div className="coai-form-group">
                <label>Difficulty Level *</label>
                <div className="coai-difficulty-options">
                  <label className="coai-radio-label">
                    <input
                      type="radio"
                      name="difficulty"
                      value="easy"
                      checked={interviewConfig.difficulty === 'easy'}
                      onChange={handleConfigChange}
                    />
                    <span>Easy</span>
                  </label>
                  <label className="coai-radio-label">
                    <input
                      type="radio"
                      name="difficulty"
                      value="medium"
                      checked={interviewConfig.difficulty === 'medium'}
                      onChange={handleConfigChange}
                    />
                    <span>Medium</span>
                  </label>
                  <label className="coai-radio-label">
                    <input
                      type="radio"
                      name="difficulty"
                      value="hard"
                      checked={interviewConfig.difficulty === 'hard'}
                      onChange={handleConfigChange}
                    />
                    <span>Hard</span>
                  </label>
                </div>
              </div>

              {/* Form Actions */}
              <div className="coai-modal-actions">
                <button
                  type="submit"
                  disabled={configLoading}
                  className="coai-btn-primary"
                >
                  {configLoading ? 'Starting Interview...' : 'Start Interview'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInterviewConfig(false)}
                  disabled={configLoading}
                  className="coai-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
