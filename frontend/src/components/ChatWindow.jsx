import React, { useEffect, useRef } from 'react';
import { FiUser, FiCpu } from 'react-icons/fi';

const ChatWindow = ({ messages, isLoading }) => {
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="chat-window">
        <div className="empty-state">
          What can I help you with today?
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {messages.map((msg, index) => {
        if (msg.role === 'system') {
          return (
            <div key={index} className="system-notification-wrapper">
              <div className="system-notification-pill">
                {msg.content}
              </div>
            </div>
          );
        }

        return (
          <div key={index} className={`message-wrapper ${msg.role}`}>
            <div className="message-content">
              <div className={`avatar ${msg.role}`}>
                {msg.role === 'user' ? <FiUser /> : <FiCpu />}
              </div>
              <div className="text-content">
                {msg.content}
              </div>
            </div>
          </div>
        );
      })}
      
      {isLoading && (
        <div className="message-wrapper model">
          <div className="message-content">
            <div className="avatar model">
              <FiCpu />
            </div>
            <div className="text-content">
               <div className="typing-indicator">
                 <div className="dot"></div>
                 <div className="dot"></div>
                 <div className="dot"></div>
               </div>
            </div>
          </div>
        </div>
      )}
      <div ref={endOfMessagesRef} />
    </div>
  );
};

export default ChatWindow;
