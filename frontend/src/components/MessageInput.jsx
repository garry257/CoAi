import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiPaperclip, FiX, FiFileText, FiLoader } from 'react-icons/fi';

const MessageInput = ({ onSendMessage, isLoading, currentChatId, documents = [], onUploadDoc, onDeleteDoc }) => {
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;

    setUploadError('');
    setUploading(true);
    try {
      await onUploadDoc(currentChatId, file);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed. Try a PDF or TXT file.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const hasRagContext = documents.length > 0;

  return (
    <div className="input-area">
      {/* Document chips */}
      {hasRagContext && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '8px 16px 0',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginRight: '4px' }}>
            📎 Context docs:
          </span>
          {documents.map((doc) => (
            <span
              key={doc._id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '20px',
                padding: '3px 10px 3px 8px',
                fontSize: '0.75rem',
                color: '#a5b4fc',
                fontWeight: '600',
                maxWidth: '200px',
              }}
            >
              <FiFileText size={11} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.name}
              </span>
              <button
                onClick={() => onDeleteDoc && onDeleteDoc(currentChatId, doc._id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#ef4444',
                  padding: '0 0 0 2px',
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: 1,
                }}
                title={`Remove ${doc.name}`}
              >
                <FiX size={11} />
              </button>
            </span>
          ))}
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '4px' }}>
            — AI will answer based on these docs
          </span>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div style={{
          margin: '6px 16px 0',
          padding: '6px 12px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '6px',
          color: '#fca5a5',
          fontSize: '0.78rem',
        }}>
          ⚠️ {uploadError}
        </div>
      )}

      <div className="input-container" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.doc,.docx"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Paperclip button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !currentChatId}
          title="Upload document for AI context (PDF, TXT, MD)"
          style={{
            background: 'none',
            border: 'none',
            cursor: uploading ? 'wait' : 'pointer',
            color: hasRagContext ? '#818cf8' : '#64748b',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.2s',
            flexShrink: 0,
          }}
        >
          {uploading ? <FiLoader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <FiPaperclip size={18} />}
        </button>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasRagContext ? '💬 Ask about your uploaded documents...' : 'Message ChatGPT...'}
          rows={1}
          disabled={isLoading}
          style={{ flex: 1 }}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!message.trim() || isLoading}
        >
          <FiSend size={18} />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
