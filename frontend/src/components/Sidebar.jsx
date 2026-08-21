import React, { useState } from 'react';
import { FiPlus, FiMessageSquare, FiUsers, FiCopy, FiCheck, FiLogOut, FiUser, FiTrash2, FiFileText, FiMenu, FiX } from 'react-icons/fi';

const Sidebar = ({ chats, currentChat, onSelectChat, onNewChat, onJoinChat, onDeleteChat, onLogout, username }) => {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoinError('');
    try {
      await onJoinChat(joinCodeInput.trim(), username);
      setShowJoinModal(false);
      setJoinCodeInput('');
      setMobileOpen(false);
    } catch (err) {
      setJoinError(err.response?.data?.error || 'Failed to join chat with this code');
    }
  };

  const handleDelete = async (e, chatId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this chat permanently?')) return;
    setDeletingId(chatId);
    try {
      await onDeleteChat(chatId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectChat = (id) => {
    onSelectChat(id);
    setMobileOpen(false); // close drawer on mobile after selection
  };

  const sidebarContent = (
    <div className="sidebar-inner">
      <div className="sidebar-buttons">
        <button className="new-chat-btn" onClick={() => { onNewChat(); setMobileOpen(false); }}>
          <FiPlus /> New chat
        </button>
        <button className="join-chat-btn" onClick={() => setShowJoinModal(true)}>
          <FiUsers /> Join Chat
        </button>
      </div>

      {currentChat?.shareCode && (
        <div className="share-code-banner">
          <div className="share-code-info">
            <span className="label">Room Share Code:</span>
            <span className="code">{currentChat.shareCode}</span>
          </div>
          <button className="copy-code-btn" onClick={(e) => handleCopyCode(e, currentChat.shareCode)}>
            {copied ? <FiCheck color="#10b981" /> : <FiCopy />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      <div className="chat-list">
        {chats.map((chat) => (
          <div
            key={chat._id}
            className={`chat-item ${currentChat?._id === chat._id ? 'active' : ''}`}
            onClick={() => handleSelectChat(chat._id)}
          >
            <FiMessageSquare style={{ flexShrink: 0 }} />
            <div className="chat-title-wrapper" style={{ flex: 1, minWidth: 0 }}>
              <span className="chat-title">{chat.title || 'New Chat'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                {chat.shareCode && <span className="mini-code">#{chat.shareCode}</span>}
                {chat.documents?.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.68rem', color: '#818cf8' }}>
                    <FiFileText size={10} />
                    {chat.documents.length} doc{chat.documents.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <button
              className="chat-delete-btn"
              title="Delete chat"
              disabled={deletingId === chat._id}
              onClick={(e) => handleDelete(e, chat._id)}
              style={{
                flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                color: '#ef4444', padding: '4px', borderRadius: '4px',
                opacity: 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center',
              }}
            >
              {deletingId === chat._id ? <span style={{ fontSize: '0.7rem' }}>...</span> : <FiTrash2 size={13} />}
            </button>
          </div>
        ))}
      </div>

      {/* Profile & Logout */}
      <div className="sidebar-profile-footer">
        <div className="profile-info">
          <div className="profile-avatar"><FiUser size={14} /></div>
          <span className="profile-name">{username}</span>
        </div>
        <button className="logout-btn" onClick={onLogout} title="Log Out">
          <FiLogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <div className="sidebar sidebar-desktop">
        {sidebarContent}
      </div>

      {/* ── Mobile: toggle button (shown inside chat header) ──── */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open chats"
      >
        <FiMenu size={20} />
        <span>Chats</span>
      </button>

      {/* ── Mobile: slide-in drawer ───────────────────────────── */}
      {mobileOpen && (
        <div className="sidebar-drawer-overlay" onClick={() => setMobileOpen(false)}>
          <div className="sidebar sidebar-drawer" onClick={e => e.stopPropagation()}>
            <div className="sidebar-drawer-header">
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>Your Chats</span>
              <button
                onClick={() => setMobileOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <FiX size={20} />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Join Chat Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Join Shared Chat Room</h3>
            <p>Enter the 6-character Share Code from your friend:</p>
            <form onSubmit={handleJoinSubmit}>
              <div className="modal-input-group">
                <label>Share Code:</label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12CD"
                  maxLength={6}
                  className="input-code"
                  autoFocus
                />
              </div>
              {joinError && <div className="modal-error">{joinError}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowJoinModal(false)}>Cancel</button>
                <button type="submit" className="btn-join">Join Chat</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
