import React, { useEffect, useRef } from 'react';
import { FiUser, FiCpu } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

        const isUser = msg.role === 'user';

        return (
          <div key={index} className={`message-wrapper ${msg.role}`}>
            <div className="message-content">
              <div className={`avatar ${msg.role}`}>
                {isUser ? <FiUser /> : <FiCpu />}
              </div>
              <div className={`text-content ${isUser ? '' : 'markdown-body'}`}>
                {isUser ? (
                  msg.content
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Tables
                      table: ({ node, ...props }) => (
                        <div className="md-table-wrapper">
                          <table {...props} />
                        </div>
                      ),
                      // Code blocks
                      code: ({ node, inline, className, children, ...props }) => {
                        const lang = className?.replace('language-', '') || '';
                        if (inline) {
                          return <code className="md-inline-code" {...props}>{children}</code>;
                        }
                        // Block code — rendered as pre directly, never inside a <p>
                        return (
                          <div className="md-code-block">
                            {lang && <div className="md-code-lang">{lang}</div>}
                            <pre><code {...props}>{children}</code></pre>
                          </div>
                        );
                      },
                      // Headings
                      h1: ({ node, ...props }) => <h1 className="md-h1" {...props} />,
                      // Override <p> to use a div when children might be block elements
                      p: ({ node, children, ...props }) => {
                        // Check if any child is a block-level element (div, pre, table)
                        const hasBlock = Array.isArray(children) && children.some(
                          c => c?.props?.className?.includes('md-code-block') ||
                               c?.props?.className?.includes('md-table-wrapper')
                        );
                        if (hasBlock) return <div className="md-p">{children}</div>;
                        return <p className="md-p" {...props}>{children}</p>;
                      },
                      h2: ({ node, ...props }) => <h2 className="md-h2" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="md-h3" {...props} />,
                      // Blockquote
                      blockquote: ({ node, ...props }) => <blockquote className="md-blockquote" {...props} />,
                      // Lists
                      ul: ({ node, ...props }) => <ul className="md-ul" {...props} />,
                      ol: ({ node, ...props }) => <ol className="md-ol" {...props} />,
                      li: ({ node, ...props }) => <li className="md-li" {...props} />,
                      // Paragraphs
                      p: ({ node, ...props }) => <p className="md-p" {...props} />,
                      // Strong / Bold
                      strong: ({ node, ...props }) => <strong className="md-strong" {...props} />,
                      // Links
                      a: ({ node, ...props }) => (
                        <a className="md-link" target="_blank" rel="noopener noreferrer" {...props} />
                      ),
                      // Horizontal rule
                      hr: ({ node, ...props }) => <hr className="md-hr" {...props} />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
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
