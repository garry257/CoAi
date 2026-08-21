import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const isProd = import.meta.env.PROD;
const baseUrl = isProd ? '' : 'http://localhost:5005';
const getAuthUrl = (type) => `${baseUrl}/api/auth/${type}`;

const Auth = ({ onAuthSuccess }) => {
  // mode: 'login' | 'register' | 'guest'
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { guestJoin } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'guest') {
        if (!shareCode.trim()) {
          setError('Please enter a share code');
          setLoading(false);
          return;
        }
        const data = await guestJoin(shareCode.trim(), displayName.trim() || 'Guest');
        onAuthSuccess(data.token, data.username);
      } else {
        if (!username.trim() || !password.trim()) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }
        const type = mode === 'login' ? 'login' : 'register';
        const response = await axios.post(getAuthUrl(type), {
          username: username.trim(),
          password: password.trim(),
        });
        onAuthSuccess(response.data.token, response.data.username);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-container" style={{ maxWidth: '420px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '4px' }}>
          {mode === 'guest' ? '🔗 Join a Chat Room' : mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: '24px' }}>
          {mode === 'guest'
            ? 'Enter the share code your friend gave you'
            : mode === 'login'
            ? 'Sign in to access your chats & tools'
            : 'Sign up for full access to all features'}
        </p>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1px solid #334155', marginBottom: '24px' }}>
          {[
            { key: 'login', label: '🔑 Sign In' },
            { key: 'register', label: '✨ Sign Up' },
            { key: 'guest', label: '🔗 Join Room' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setMode(tab.key); setError(''); }}
              style={{
                flex: 1,
                padding: '10px 6px',
                fontSize: '0.82rem',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: mode === tab.key ? '#6366f1' : 'transparent',
                color: mode === tab.key ? '#fff' : '#94a3b8',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'guest' ? (
            <>
              <div className="form-group">
                <label>Share Code</label>
                <input
                  type="text"
                  value={shareCode}
                  onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                  placeholder="e.g., X7K9P2"
                  maxLength={10}
                  style={{ textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '700', fontSize: '1.1rem' }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Your Display Name <span style={{ color: '#94a3b8', fontWeight: '400' }}>(optional)</span></label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., John (appears in chat)"
                  maxLength={30}
                />
              </div>
              <div style={{
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '0.82rem',
                color: '#94a3b8',
                lineHeight: '1.5',
              }}>
                🔒 <strong style={{ color: '#c7d2fe' }}>Guest access</strong> — you'll only see the shared chat room. To access the full app (Interview Copilot, Profile, Research), create a free account.
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading
              ? 'Please wait...'
              : mode === 'guest'
              ? '🚀 Join Chat Room'
              : mode === 'login'
              ? 'Sign In'
              : 'Sign Up'}
          </button>
        </form>

        {mode !== 'guest' && (
          <div className="auth-toggle" style={{ marginTop: '16px', textAlign: 'center' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
