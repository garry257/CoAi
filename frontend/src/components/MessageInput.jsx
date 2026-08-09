import React, { useState, useRef, useEffect } from 'react';
import { FiSend } from 'react-icons/fi';

const MessageInput = ({ onSendMessage, isLoading }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

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
      if (textareaRef.current) {
         textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-area">
      <div className="input-container">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message ChatGPT..."
          rows={1}
          disabled={isLoading}
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
