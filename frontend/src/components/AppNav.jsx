import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMessageSquare, FiTarget, FiLogOut, FiUser, FiFileText, FiSearch } from 'react-icons/fi';

const AppNav = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.name || user?.username || 'User';

  return (
    <nav className="coai-nav" id="coai-main-nav">
      {/* Brand */}
      <div className="coai-nav-brand">
        <div className="coai-nav-logo">
          <FiTarget size={22} />
        </div>
        <span className="coai-nav-title">COAI</span>
      </div>

      {/* Navigation Links */}
      <div className="coai-nav-links">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `coai-nav-link ${isActive ? 'active' : ''}`}
          id="nav-link-chat"
        >
          <FiMessageSquare size={16} />
          <span>Chat</span>
        </NavLink>

        <NavLink
          to="/dashboard"
          className={({ isActive }) => `coai-nav-link ${isActive ? 'active' : ''}`}
          id="nav-link-dashboard"
        >
          <FiTarget size={16} />
          <span>Interview Copilot</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `coai-nav-link ${isActive ? 'active' : ''}`}
          id="nav-link-profile"
        >
          <FiFileText size={16} />
          <span>My Profile</span>
        </NavLink>

        <NavLink
          to="/research"
          className={({ isActive }) => `coai-nav-link ${isActive ? 'active' : ''}`}
          id="nav-link-research"
        >
          <FiSearch size={16} />
          <span>Research Coach</span>
        </NavLink>
      </div>

      {/* User info + logout */}
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
    </nav>
  );
};

export default AppNav;
