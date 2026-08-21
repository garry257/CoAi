import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMessageSquare, FiTarget, FiLogOut, FiUser, FiFileText, FiSearch, FiMenu, FiX } from 'react-icons/fi';

const NAV_LINKS = [
  { to: '/', end: true, icon: FiMessageSquare, label: 'Chat', id: 'nav-link-chat' },
  { to: '/dashboard', icon: FiTarget, label: 'Interview', id: 'nav-link-dashboard' },
  { to: '/profile', icon: FiFileText, label: 'Profile', id: 'nav-link-profile' },
  { to: '/research', icon: FiSearch, label: 'Research', id: 'nav-link-research' },
];

const AppNav = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isAuthenticated) return null;

  const displayName = user?.name || user?.username || 'User';

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuOpen(false);
  };

  return (
    <>
      {/* ─── Desktop / Tablet Top Nav ─────────────────────────── */}
      <nav className="coai-nav" id="coai-main-nav">
        {/* Brand */}
        <div className="coai-nav-brand">
          <div className="coai-nav-logo">
            <FiTarget size={22} />
          </div>
          <span className="coai-nav-title">CoAI– AI Interview Assistant</span>
        </div>

        {/* Desktop Nav Links */}
        <div className="coai-nav-links">
          {NAV_LINKS.map(({ to, end, icon: Icon, label, id }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `coai-nav-link ${isActive ? 'active' : ''}`}
              id={id}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        {/* User info + logout (desktop) */}
        <div className="coai-nav-user">
          <div className="coai-nav-avatar" id="nav-user-avatar">
            <FiUser size={14} />
          </div>
          <span className="coai-nav-username">{displayName}</span>
          <button
            className="coai-nav-logout"
            onClick={handleLogout}
            title="Logout"
            id="nav-logout-btn"
          >
            <FiLogOut size={16} />
          </button>
        </div>

        {/* Hamburger (mobile only) */}
        <button
          className="coai-nav-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>
      </nav>

      {/* ─── Mobile Dropdown Menu ─────────────────────────────── */}
      {menuOpen && (
        <div className="coai-mobile-menu" onClick={() => setMenuOpen(false)}>
          <div className="coai-mobile-menu-inner" onClick={e => e.stopPropagation()}>
            <div className="coai-mobile-user-row">
              <div className="coai-nav-avatar">
                <FiUser size={16} />
              </div>
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{displayName}</span>
              <button className="coai-nav-logout" onClick={handleLogout} style={{ marginLeft: 'auto' }}>
                <FiLogOut size={16} />
              </button>
            </div>
            {NAV_LINKS.map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `coai-mobile-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* ─── Mobile Bottom Tab Bar ────────────────────────────── */}
      <nav className="coai-bottom-nav">
        {NAV_LINKS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `coai-bottom-tab ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};

export default AppNav;
