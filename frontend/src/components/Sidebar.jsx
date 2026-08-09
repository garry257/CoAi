import React, { useState } from 'react';
import { FiPlus, FiMessageSquare, FiUsers, FiCopy, FiCheck } from 'react-icons/fi';

const Sidebar = ({ chats, currentChat, onSelectChat, onNewChat, onJoinChat }) => {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinError, setJoinError] = useState('');

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
      const nameToUse = usernameInput.trim() || 'A new user';
      await onJoinChat(joinCodeInput.trim(), nameToUse);
      setShowJoinModal(false);
      setJoinCodeInput('');
      setUsernameInput('');
    } catch (err) {
      setJoinError(err.response?.data?.error || 'Failed to join chat with this code');
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-buttons">
        <button className="new-chat-btn" onClick={onNewChat}>
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
            onClick={() => onSelectChat(chat._id)}
          >
            <FiMessageSquare />
            <div className="chat-title-wrapper">
              <span className="chat-title">{chat.title || 'New Chat'}</span>
              {chat.shareCode && <span className="mini-code">#{chat.shareCode}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Join Chat Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Join Shared Chat Room</h3>
            <p>Enter your name and the Share Code from your friend:</p>
            <form onSubmit={handleJoinSubmit}>
              <div className="modal-input-group">
                <label>Your Name:</label>
                <input 
                  type="text" 
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. Alex"
                  className="input-name"
                />
              </div>

              <div className="modal-input-group">
                <label>Share Code:</label>
                <input 
                  type="text" 
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12CD"
                  maxLength={6}
                  className="input-code"
                />
              </div>

              {joinError && <div className="modal-error">{joinError}</div>}
              
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowJoinModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-join">
                  Join Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
