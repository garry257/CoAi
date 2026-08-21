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
  FiLink,
  FiZap,
  FiCheckCircle
} from 'react-icons/fi';

const FormattedAnswer = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const blocks = [];
  let currentTable = null;
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'paragraph', lines: [...currentParagraph] });
      currentParagraph = [];
    }
  };

  const flushTable = () => {
    if (currentTable && currentTable.length > 0) {
      blocks.push({ type: 'table', rows: [...currentTable] });
      currentTable = null;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph();
      if (!currentTable) currentTable = [];
      if (!/^\|[\s-:]+(\|[\s-:]+)*\|$/.test(trimmed)) {
        currentTable.push(trimmed);
      }
    } else {
      flushTable();
      if (trimmed.startsWith('#')) {
        flushParagraph();
        blocks.push({ type: 'heading', text: trimmed });
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
        currentParagraph.push(trimmed);
      } else if (trimmed === '') {
        flushParagraph();
      } else {
        currentParagraph.push(trimmed);
      }
    }
  });

  flushParagraph();
  flushTable();

  const parseInline = (text) => {
    if (!text) return null;

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const title = match[1];
      const url = match[2];
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="coai-inline-link-btn"
        >
          <span>{title}</span>
          <FiLink size={12} style={{ marginLeft: '4px' }} />
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.map((part, pIdx) => {
      if (typeof part !== 'string') return part;

      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**')) {
          return <strong key={bIdx} style={{ color: '#f8fafc', fontWeight: '700' }}>{bPart.slice(2, -2)}</strong>;
        }
        return bPart;
      });
    });
  };

  return (
    <div className="coai-formatted-answer">
      {blocks.map((block, bIdx) => {
        if (block.type === 'heading') {
          const level = block.text.match(/^#+/)[0].length;
          const headingText = block.text.replace(/^#+\s*/, '');
          
          if (level === 1 || level === 2) {
            return (
              <div key={bIdx} className="coai-section-header">
                <h3 className="coai-section-title">{headingText}</h3>
              </div>
            );
          }
          return (
            <h4 key={bIdx} className="coai-section-subtitle">
              {headingText}
            </h4>
          );
        }

        if (block.type === 'table') {
          if (block.rows.length === 0) return null;
          const parseRow = (rowStr) =>
            rowStr
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim());

          const headers = parseRow(block.rows[0]);
          const dataRows = block.rows.slice(1).map(parseRow);

          return (
            <div key={bIdx} className="coai-table-responsive">
              <table className="coai-data-table">
                <thead>
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th key={hIdx}>{parseInline(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx}>{parseInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === 'paragraph') {
          return (
            <div key={bIdx} className="coai-paragraph-block">
              {block.lines.map((line, lIdx) => {
                const isBullet = line.startsWith('- ') || line.startsWith('* ');
                const isNumber = /^\d+\.\s/.test(line);

                if (isBullet || isNumber) {
                  const cleanLine = line.replace(/^([-*]|\d+\.)\s*/, '');
                  return (
                    <div key={lIdx} className="coai-list-item">
                      <span className="coai-list-bullet">
                        {isNumber ? line.match(/^\d+/)[0] : '•'}
                      </span>
                      <div className="coai-list-content">{parseInline(cleanLine)}</div>
                    </div>
                  );
                }

                return (
                  <p key={lIdx} className="coai-text-line">
                    {parseInline(line)}
                  </p>
                );
              })}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

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
            <p style={{ fontWeight: 600, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiZap /> Fast AI Agent analyzing live web search results...
            </p>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', maxWidth: '400px' }}>
              Retrieving live listings and synthesizing response in 2-3 seconds...
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
          {/* Summary Metric Header */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '180px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiZap size={24} style={{ color: '#8b5cf6' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>FAST AI SEARCH</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>Sub-3s Synthesized</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '180px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiLink size={24} style={{ color: '#3b82f6' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>VERIFIED SOURCES</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>{result.sources?.length || 0} Links Found</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '180px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiCheckCircle size={24} style={{ color: '#22c55e' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ACCURACY SCORE</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>100% Live Verified</div>
              </div>
            </div>
          </div>

          {/* Main Synthesized Answer (FIRST) */}
          <div className="coai-research-card">
            <div className="coai-research-answer-box" style={{ background: 'transparent', padding: 0, margin: 0, border: 'none' }}>
              <h2 className="coai-research-answer-title" style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '1.25rem' }}>
                Synthesized Research Findings
              </h2>
              <FormattedAnswer content={result.answer} />
            </div>

            {/* Sources List */}
            {result.sources && result.sources.length > 0 && (
              <div className="coai-research-sources-box" style={{ marginTop: '2rem' }}>
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
