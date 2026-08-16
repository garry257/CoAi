import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUploadCloud, FiFile, FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';
import { uploadResume } from '../features/resume/api';

const ACCEPTED_TYPE = 'application/pdf';
const MAX_SIZE_MB = 5;

const STAGES = {
  idle: 'idle',
  selected: 'selected',
  uploading: 'uploading',
  analyzing: 'analyzing',
  done: 'done',
  error: 'error',
};

const ResumeUpload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [stage, setStage] = useState(STAGES.idle);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (f) => {
    if (!f) return 'No file selected.';
    if (f.type !== ACCEPTED_TYPE && !f.name.toLowerCase().endsWith('.pdf')) {
      return 'Only PDF files are allowed.';
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File size must be under ${MAX_SIZE_MB} MB (yours: ${(f.size / 1024 / 1024).toFixed(1)} MB).`;
    }
    return null;
  };

  const selectFile = (f) => {
    const err = validateFile(f);
    if (err) {
      setErrorMsg(err);
      setStage(STAGES.error);
      return;
    }
    setFile(f);
    setStage(STAGES.selected);
    setErrorMsg('');
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);

  const handleFileInput = (e) => {
    const picked = e.target.files[0];
    if (picked) selectFile(picked);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStage(STAGES.uploading);
    setProgress(0);

    try {
      // Upload phase (tracked via axios progress)
      setStage(STAGES.uploading);
      await new Promise((res) => setTimeout(res, 100)); // micro-delay for render

      setStage(STAGES.analyzing); // Switch to analysis stage while Gemini runs
      await uploadResume(file, (pct) => setProgress(pct));

      setStage(STAGES.done);
      // Redirect to profile after a short success moment
      setTimeout(() => navigate('/profile'), 1200);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Upload failed. Please try again.';
      setErrorMsg(msg);
      setStage(STAGES.error);
    }
  };

  const reset = () => {
    setStage(STAGES.idle);
    setFile(null);
    setProgress(0);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="coai-resume-page" id="resume-upload-page">
      <div className="coai-resume-header">
        <h1 className="coai-dashboard-title">
          Upload Your <span className="coai-highlight">Resume</span>
        </h1>
        <p className="coai-dashboard-subtitle">
          Our AI will extract your skills, experience, and suggest interview topics.
        </p>
      </div>

      <div className="coai-upload-wrapper">
        {/* Drop Zone */}
        {(stage === STAGES.idle || stage === STAGES.selected || stage === STAGES.error) && (
          <div
            className={`coai-dropzone ${isDragOver ? 'drag-over' : ''} ${stage === STAGES.selected ? 'has-file' : ''} ${stage === STAGES.error ? 'has-error' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            id="resume-dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileInput}
              style={{ display: 'none' }}
              id="resume-file-input"
            />

            {stage === STAGES.error ? (
              <>
                <FiAlertCircle size={48} className="coai-dropzone-icon error" />
                <p className="coai-dropzone-error">{errorMsg}</p>
                <button className="coai-dropzone-retry" onClick={(e) => { e.stopPropagation(); reset(); }}>
                  <FiX size={14} /> Try Again
                </button>
              </>
            ) : stage === STAGES.selected ? (
              <>
                <FiFile size={48} className="coai-dropzone-icon selected" />
                <p className="coai-dropzone-filename">{file.name}</p>
                <p className="coai-dropzone-size">{(file.size / 1024 / 1024).toFixed(2)} MB · PDF</p>
                <button
                  className="coai-dropzone-change"
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                >
                  <FiX size={14} /> Change file
                </button>
              </>
            ) : (
              <>
                <FiUploadCloud size={48} className="coai-dropzone-icon" />
                <p className="coai-dropzone-title">Drop your PDF here</p>
                <p className="coai-dropzone-sub">or click to browse · Max {MAX_SIZE_MB} MB</p>
              </>
            )}
          </div>
        )}

        {/* Upload Progress */}
        {stage === STAGES.uploading && (
          <div className="coai-upload-progress" id="upload-progress">
            <div className="coai-loading-spinner" />
            <p>Uploading resume...</p>
            <div className="coai-progress-bar">
              <div className="coai-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="coai-progress-pct">{progress}%</span>
          </div>
        )}

        {/* Analyzing State */}
        {stage === STAGES.analyzing && (
          <div className="coai-upload-progress" id="analyzing-state">
            <div className="coai-loading-spinner coai-spinner-purple" />
            <p className="coai-analyzing-text">Analyzing with Gemini AI...</p>
            <p className="coai-analyzing-sub">Extracting skills, experience, and projects</p>
            <div className="coai-analyze-steps">
              {['Parsing PDF', 'Reading skills', 'Mapping experience', 'Generating topics'].map((s, i) => (
                <span key={s} className="coai-analyze-step" style={{ animationDelay: `${i * 0.4}s` }}>
                  ✓ {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Success */}
        {stage === STAGES.done && (
          <div className="coai-upload-success" id="upload-success">
            <FiCheckCircle size={56} className="coai-success-icon" />
            <h3>Resume Analyzed!</h3>
            <p>Redirecting to your profile...</p>
          </div>
        )}

        {/* Upload Button */}
        {stage === STAGES.selected && (
          <button
            className="coai-upload-btn"
            onClick={handleUpload}
            id="upload-submit-btn"
          >
            <FiUploadCloud size={18} />
            Analyze Resume with AI
          </button>
        )}
      </div>

      {/* Info Cards */}
      <div className="coai-upload-info-grid">
        {[
          { icon: '🔒', title: 'Secure', desc: 'Your resume is processed server-side. Gemini API key never reaches the browser.' },
          { icon: '⚡', title: 'Fast', desc: 'Text extraction and AI analysis typically complete in under 10 seconds.' },
          { icon: '✅', title: 'Validated', desc: 'Gemini output is schema-validated before saving. No hallucinated data stored.' },
        ].map((card) => (
          <div key={card.title} className="coai-upload-info-card">
            <span className="coai-info-icon">{card.icon}</span>
            <strong>{card.title}</strong>
            <p>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResumeUpload;
