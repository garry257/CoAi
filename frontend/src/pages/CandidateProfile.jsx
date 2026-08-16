import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUpload, FiCode, FiDatabase, FiTool, FiBookOpen,
  FiBriefcase, FiAward, FiTarget, FiCpu, FiRefreshCw
} from 'react-icons/fi';
import { getCandidateProfile } from '../features/resume/api';

/* ─── Small reusable chip ─── */
const Chip = ({ label, color = 'blue' }) => (
  <span className={`coai-chip coai-chip-${color}`}>{label}</span>
);

/* ─── Section wrapper ─── */
const Section = ({ icon, title, children, id }) => (
  <section className="coai-profile-section" id={id}>
    <h2 className="coai-section-title">
      {icon} {title}
    </h2>
    {children}
  </section>
);

const CandidateProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCandidateProfile();
      setProfile(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('no-profile');
      } else {
        setError(err.response?.data?.message || 'Failed to load profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="coai-dashboard">
        <div className="coai-loading-screen">
          <div className="coai-loading-spinner" />
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error === 'no-profile') {
    return (
      <div className="coai-dashboard">
        <div className="coai-empty-state">
          <div className="coai-empty-icon"><FiTarget size={48} /></div>
          <h3>No profile yet</h3>
          <p>Upload your resume to generate your candidate profile and interview topics.</p>
          <button className="coai-empty-cta" onClick={() => navigate('/resume-upload')}>
            <FiUpload size={16} /> Upload Resume
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="coai-dashboard">
        <div className="coai-empty-state">
          <div className="coai-empty-icon"><FiAward size={48} /></div>
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <button className="coai-empty-cta" onClick={loadProfile}>
            <FiRefreshCw size={16} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const skillGroups = [
    { icon: <FiCode size={16} />, label: 'Languages', items: profile.languages, color: 'blue' },
    { icon: <FiCpu size={16} />, label: 'Frameworks', items: profile.frameworks, color: 'purple' },
    { icon: <FiDatabase size={16} />, label: 'Databases', items: profile.databases, color: 'green' },
    { icon: <FiTool size={16} />, label: 'Tools', items: profile.tools, color: 'orange' },
  ];

  return (
    <div className="coai-dashboard coai-profile-page" id="candidate-profile-page">

      {/* Header */}
      <div className="coai-profile-header">
        <div>
          <h1 className="coai-dashboard-title">
            Your <span className="coai-highlight">Candidate Profile</span>
          </h1>
          <p className="coai-dashboard-subtitle">
            Extracted and validated from your resume by Gemini AI
          </p>
        </div>
        <button
          className="coai-outline-btn"
          onClick={() => navigate('/resume-upload')}
          id="re-upload-btn"
        >
          <FiUpload size={15} /> Re-upload Resume
        </button>
      </div>

      {/* Suggested Interview Topics — most important, shown first */}
      {profile.suggestedInterviewTopics?.length > 0 && (
        <Section icon={<FiTarget size={18} />} title="Suggested Interview Topics" id="suggested-topics">
          <div className="coai-topics-grid">
            {profile.suggestedInterviewTopics.map((t, i) => (
              <div key={t} className="coai-topic-card" style={{ animationDelay: `${i * 0.05}s` }}>
                <span className="coai-topic-number">{i + 1}</span>
                <span className="coai-topic-label">{t}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Skills by category */}
      <Section icon={<FiCode size={18} />} title="Technical Skills" id="skills-section">
        {/* All skills as chips */}
        {profile.skills?.length > 0 && (
          <div className="coai-chips-group">
            <span className="coai-chips-label">All Skills</span>
            <div className="coai-chips-row">
              {profile.skills.map((s) => <Chip key={s} label={s} color="blue" />)}
            </div>
          </div>
        )}
        {/* Categorized */}
        {skillGroups.map(({ icon, label, items, color }) =>
          items?.length > 0 ? (
            <div key={label} className="coai-chips-group">
              <span className="coai-chips-label">{icon} {label}</span>
              <div className="coai-chips-row">
                {items.map((s) => <Chip key={s} label={s} color={color} />)}
              </div>
            </div>
          ) : null
        )}
      </Section>

      {/* Experience */}
      {profile.experience?.length > 0 && (
        <Section icon={<FiBriefcase size={18} />} title="Experience" id="experience-section">
          <div className="coai-timeline">
            {profile.experience.map((exp, i) => (
              <div key={i} className="coai-timeline-item">
                <div className="coai-timeline-dot" />
                <div className="coai-timeline-content">
                  <div className="coai-timeline-header">
                    <strong className="coai-timeline-role">{exp.role}</strong>
                    {exp.company && <span className="coai-timeline-company">{exp.company}</span>}
                    {exp.duration && <span className="coai-timeline-duration">{exp.duration}</span>}
                  </div>
                  {exp.description && <p className="coai-timeline-desc">{exp.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Projects */}
      {profile.projects?.length > 0 && (
        <Section icon={<FiCpu size={18} />} title="Projects" id="projects-section">
          <div className="coai-projects-grid">
            {profile.projects.map((proj, i) => (
              <div key={i} className="coai-project-card">
                <h4 className="coai-project-name">{proj.name}</h4>
                {proj.description && <p className="coai-project-desc">{proj.description}</p>}
                {proj.techUsed?.length > 0 && (
                  <div className="coai-chips-row coai-project-chips">
                    {proj.techUsed.map((t) => <Chip key={t} label={t} color="purple" />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Education */}
      {profile.education?.length > 0 && (
        <Section icon={<FiBookOpen size={18} />} title="Education" id="education-section">
          <div className="coai-timeline">
            {profile.education.map((edu, i) => (
              <div key={i} className="coai-timeline-item">
                <div className="coai-timeline-dot coai-dot-green" />
                <div className="coai-timeline-content">
                  <div className="coai-timeline-header">
                    <strong className="coai-timeline-role">{edu.degree}</strong>
                    {edu.institution && <span className="coai-timeline-company">{edu.institution}</span>}
                    {edu.year && <span className="coai-timeline-duration">{edu.year}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Certifications */}
      {profile.certifications?.length > 0 && (
        <Section icon={<FiAward size={18} />} title="Certifications" id="certifications-section">
          <div className="coai-chips-row">
            {profile.certifications.map((c) => <Chip key={c} label={c} color="orange" />)}
          </div>
        </Section>
      )}

      {/* Claimed Topics */}
      {profile.claimedTopics?.length > 0 && (
        <Section icon={<FiTarget size={18} />} title="Claimed Expertise Topics" id="claimed-topics-section">
          <div className="coai-chips-row">
            {profile.claimedTopics.map((t) => <Chip key={t} label={t} color="green" />)}
          </div>
        </Section>
      )}
    </div>
  );
};

export default CandidateProfile;
