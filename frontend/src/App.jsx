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
  const { isAuthenticated, loading, setToken } = useAuth();

  // Auth.jsx does its own axios call and passes back (token, username).
  // We push the token into AuthContext state — this triggers fetchUser()
  // via the useEffect in AuthContext, which flips isAuthenticated to true.
  const handleAuthSuccess = (newToken, username) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', username);
    setToken(newToken); // ← this is the key: updates React state in AuthContext
  };

  if (loading) {
    return (
      <div className="coai-loading-screen">
        <div className="coai-loading-spinner" />
      </div>
    );
  }

  // Not logged in → show Auth component (existing UI, unchanged)
  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

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
