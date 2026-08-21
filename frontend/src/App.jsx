import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Existing
import Auth from './components/Auth';
import './App.css';

// COAI — new
import AppNav from './components/AppNav';
import ProtectedRoute from './components/ProtectedRoute';
import ChatPage from './pages/ChatPage';
import Dashboard from './pages/Dashboard';
import ResumeUpload from './pages/ResumeUpload';
import CandidateProfile from './pages/CandidateProfile';
import InterviewPage from './pages/InterviewPage';
import InterviewConfiguration from './pages/InterviewConfiguration';
import VoiceInterviewPage from './pages/VoiceInterviewPage';
import InterviewResults from './pages/InterviewResults';
import ResearchAgent from './pages/ResearchAgent';

function App() {
  const { isAuthenticated, loading, isGuest, guestChatId, setToken } = useAuth();

  const handleAuthSuccess = (newToken, username) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', username);
    setToken(newToken);
  };

  if (loading) {
    return (
      <div className="coai-loading-screen">
        <div className="coai-loading-spinner" />
      </div>
    );
  }

  // Not logged in → show Auth component
  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // ─── GUEST MODE ───────────────────────────────────────────────────────────
  // Guest users joined via share code: show ONLY the chat page.
  // No AppNav, no access to Dashboard / Profile / Interview / Research.
  if (isGuest) {
    return (
      <div className="coai-app-wrapper">
        {/* Minimal guest header */}
        <div style={{
          height: '48px',
          background: 'var(--bg-secondary, #1e293b)',
          borderBottom: '1px solid var(--border-color, #334155)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '10px',
        }}>
          <span style={{ fontSize: '1.1rem' }}>💬</span>
          <span style={{ fontWeight: '700', color: 'var(--text-primary, #f1f5f9)', fontSize: '0.95rem' }}>
            Shared Chat Room
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.75rem',
            background: 'rgba(99,102,241,0.15)',
            color: '#a5b4fc',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '20px',
            padding: '3px 10px',
            fontWeight: '600',
          }}>
            👤 Guest
          </span>
        </div>
        {/* Guest sees ONLY the chat — locked to their joined chat */}
        <main className="coai-app-content">
          <ChatPage guestChatId={guestChatId} />
        </main>
      </div>
    );
  }

  // ─── FULL USER MODE ───────────────────────────────────────────────────────
  return (
    <div className="coai-app-wrapper">
      {/* Top navigation bar — only visible when authenticated */}
      <AppNav />

      {/* Page content */}
      <main className="coai-app-content">
        <Routes>
          {/* Chat — existing functionality, completely unchanged */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />

          {/* COAI Interview Copilot Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Phase 2: Resume Upload & Candidate Profile */}
          <Route
            path="/resume-upload"
            element={
              <ProtectedRoute>
                <ResumeUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <CandidateProfile />
              </ProtectedRoute>
            }
          />

          {/* Phase 3: Interview Configuration & Engine */}
          <Route
            path="/interview-config"
            element={
              <ProtectedRoute>
                <InterviewConfiguration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/:id"
            element={
              <ProtectedRoute>
                <InterviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/:id/voice"
            element={
              <ProtectedRoute>
                <VoiceInterviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/:id/results"
            element={
              <ProtectedRoute>
                <InterviewResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/research"
            element={
              <ProtectedRoute>
                <ResearchAgent />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
