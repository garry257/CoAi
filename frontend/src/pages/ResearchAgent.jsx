import React, { useState } from 'react';
import axios from 'axios';
import { 
  FiSearch, 
  FiTrendingUp, 
  FiBriefcase, 
  FiGlobe, 
  FiBookOpen, 
  FiChevronDown, 
  FiChevronUp,
  FiCpu,
  FiLink
} from 'react-icons/fi';

const ResearchAgent = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState({});

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedSteps({});

    try {
      const response = await axios.post('/api/research/query', { 
        prompt: prompt.trim() 
      });
      
      if (response.data?.success) {
        setResult(response.data.data);
      } else {
        setError(response.data?.message || 'Failed to complete research query.');
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || 
        'An error occurred while executing the research agent loop.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleStepResults = (stepIndex) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepIndex]: !prev[stepIndex]
    }));
  };

  const getToolIcon = (toolName) => {
    switch (toolName) {
      case 'searchInterviewTrends':
        return <FiTrendingUp className="coai-tool-icon" />;
      case 'searchJobRequirements':
        return <FiBriefcase className="coai-tool-icon" />;
      case 'searchCompanyInformation':
        return <FiGlobe className="coai-tool-icon" />;
      case 'searchLearningResources':
        return <FiBookOpen className="coai-tool-icon" />;
      default:
        return <FiSearch className="coai-tool-icon" />;
    }
  };

  const getToolLabel = (toolName) => {
    switch (toolName) {
      case 'searchInterviewTrends':
        return 'Interview Trends Tool';
      case 'searchJobRequirements':
        return 'Job Requirements Tool';
      case 'searchCompanyInformation':
        return 'Company Info Tool';
      case 'searchLearningResources':
        return 'Learning Resources Tool';
      default:
        return 'Search Tool';
    }
  };

  const getDomainName = (urlStr) => {
    try {
      const url = new URL(urlStr);
      return url.hostname.replace('www.', '');
    } catch (e) {
      return 'link';
    }
  };

  const handleSuggestionClick = (text) => {
    setPrompt(text);
  };

  const suggestions = [
    'What are the core interview trends and common requirements for senior React 19 roles in 2026?',
    'Find interview experiences, salary expectations, and company culture insights for Netflix software engineering.',
    'I want to learn Rust programming. Find the best tutorials, guides, and learning roadmaps.',
    'What skills and qualifications are companies looking for in a Python AI/ML Engineer job description?'
  ];

  return (
    <div className="coai-research-container">
      {/* Header */}
      <div className="coai-research-header">
        <h1 className="coai-research-title">AI Research Coach</h1>
        <p className="coai-research-subtitle">
          Ask the agent to research trends, companies, jobs, or study guides using real-time search tools.
        </p>
      </div>

      {/* Input Form */}
      <div className="coai-research-card">
        <form onSubmit={handleSearch} className="coai-research-form">
          <div className="coai-research-input-wrapper">
            <input
              type="text"
              placeholder="What would you like me to research? (e.g., senior Node.js trends, company culture, learning roadmaps...)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="coai-research-input"
              disabled={loading}
            />
          </div>
          <button 
            type="submit" 
            className="coai-research-button"
            disabled={loading || !prompt.trim()}
          >
            <FiSearch size={18} />
            {loading ? 'Researching...' : 'Start Research'}
          </button>
        </form>

        {/* Suggestion Chips */}
        {!loading && !result && (
          <div style={{ marginTop: '1.25rem' }}>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>
              SUGGESTED TOPICS:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionClick(sug)}
                  style={{
                    textAlign: 'left',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem',
                    color: '#cbd5e1',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  }}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="coai-research-card">
          <div className="coai-research-loading">
            <div className="coai-research-spinner" />
            <p style={{ fontWeight: 600, color: '#a78bfa' }}>Agent is executing reasoning loop...</p>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', maxWidth: '400px' }}>
              The agent will decide which search tools to call, execute the searches on the backend, and analyze the results. This may take 10-20 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="coai-research-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <p style={{ color: '#f87171', fontWeight: 600 }}>Error executing agent:</p>
          <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginTop: '0.25rem' }}>{error}</p>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <>
          {/* Steps Timeline */}
          {result.steps && result.steps.length > 0 && (
            <div className="coai-research-card">
              <h2 className="coai-research-steps-title">
                <FiCpu style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Agent Execution & Search Log
              </h2>
              <div className="coai-research-steps-timeline">
                {result.steps.map((step, idx) => (
                  <div key={idx} className="coai-research-step-node">
                    <div className="coai-research-step-card">
                      <div className="coai-research-step-header">
                        <span className="coai-research-step-badge">
                          {getToolIcon(step.toolName)}
                          <span style={{ marginLeft: '0.4rem' }}>{getToolLabel(step.toolName)}</span>
                        </span>
                        <span className="coai-research-step-query">
                          Query: "{step.query}"
                        </span>
                      </div>
                      
                      <div className="coai-research-step-thought">
                        <strong>Reasoning:</strong> {step.thought}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleStepResults(idx)}
                        className="coai-research-step-results-toggle"
                      >
                        {expandedSteps[idx] ? (
                          <>
                            <FiChevronUp /> Hide search results ({step.results?.length || 0})
                          </>
                        ) : (
                          <>
                            <FiChevronDown /> Show search results ({step.results?.length || 0})
                          </>
                        )}
                      </button>

                      {expandedSteps[idx] && (
                        <div className="coai-research-results-grid">
                          {step.results && step.results.map((res, rIdx) => (
                            <div key={rIdx} className="coai-research-result-card">
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="coai-research-result-link"
                              >
                                {res.title}
                              </a>
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <FiLink size={10} /> {getDomainName(res.url)}
                              </span>
                              <p className="coai-research-result-snippet">
                                {res.snippet}
                              </p>
                            </div>
                          ))}
                          {(!step.results || step.results.length === 0) && (
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', gridColumn: '1/-1' }}>
                              No search results returned for this query.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Synthesized Answer */}
          <div className="coai-research-card">
            <div className="coai-research-answer-box">
              <h2 className="coai-research-answer-title">Synthesized Research Findings</h2>
              <div className="coai-research-answer-text">
                {result.answer}
              </div>
            </div>

            {/* Sources List */}
            {result.sources && result.sources.length > 0 && (
              <div className="coai-research-sources-box">
                <h3 className="coai-research-sources-title">Verified Sources Referenced</h3>
                <div className="coai-research-sources-list">
                  {result.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="coai-research-source-tag"
                      title={src.title}
                    >
                      <FiLink size={11} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
                      <span style={{ verticalAlign: 'middle' }}>{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ResearchAgent;
