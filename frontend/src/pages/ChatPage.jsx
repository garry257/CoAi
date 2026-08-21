import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import MessageInput from '../components/MessageInput';
import * as api from '../services/api';
import { socket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

const ChatPage = ({ guestChatId }) => {
  const { user, logout, isGuest } = useAuth();
  const username = user?.username || localStorage.getItem('username');

  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentRoomRef = useRef(null);

  useEffect(() => {
    if (guestChatId) {
      loadGuestChat(guestChatId);
    } else {
      loadChats();
    }
  }, [guestChatId]);

  // Real-time socket updates
  useEffect(() => {
    const handleChatUpdated = (updatedChat) => {
      if (currentChat && updatedChat._id === currentChat._id) {
        setMessages(updatedChat.messages);
        setCurrentChat(updatedChat);
        setDocuments(updatedChat.documents || []);
      }
      setChats((prev) => prev.map((c) => (c._id === updatedChat._id ? updatedChat : c)));
    };

    const handleUserJoined = (joinedUser) => {
      if (joinedUser !== username) {
        setMessages((prev) => [...prev, { role: 'system', content: `👋 ${joinedUser} has joined the chat room!` }]);
      }
    };

    socket.on('chat-updated', handleChatUpdated);
    socket.on('user-joined', handleUserJoined);
    return () => {
      socket.off('chat-updated', handleChatUpdated);
      socket.off('user-joined', handleUserJoined);
    };
  }, [currentChat]);

  const loadGuestChat = async (chatId) => {
    try {
      const chat = await api.getChatById(chatId);
      switchSocketRoom(chat.shareCode);
      setCurrentChat(chat);
      setMessages(chat.messages);
      setDocuments(chat.documents || []);
      setChats([chat]);
    } catch (err) {
      console.error('Failed to load guest chat:', err);
    }
  };

  const loadChats = async () => {
    try {
      const data = await api.getChats();
      setChats(data);
      if (data.length > 0) {
        selectChat(data[0]._id);
      } else {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to load chats', err);
      if (err.response?.status === 401) logout();
    }
  };

  const selectChat = async (id) => {
    if (isGuest && guestChatId && id !== guestChatId) return;
    try {
      const chat = await api.getChatById(id);
      switchSocketRoom(chat.shareCode);
      setCurrentChat(chat);
      setMessages(chat.messages);
      setDocuments(chat.documents || []);
    } catch (err) {
      console.error('Failed to load chat messages', err);
    }
  };

  const switchSocketRoom = (newShareCode) => {
    if (currentRoomRef.current) socket.emit('leave-room', currentRoomRef.current);
    if (newShareCode) {
      socket.emit('join-room', { shareCode: newShareCode, username });
      currentRoomRef.current = newShareCode;
    }
  };

  const handleNewChat = async () => {
    if (isGuest) return;
    try {
      const newChat = await api.createChat();
      setChats((prev) => [newChat, ...prev]);
      switchSocketRoom(newChat.shareCode);
      setCurrentChat(newChat);
      setMessages([]);
      setDocuments([]);
    } catch (err) {
      console.error('Failed to create new chat', err);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      await api.deleteChat(chatId);
      const remaining = chats.filter((c) => c._id !== chatId);
      setChats(remaining);
      if (currentChat?._id === chatId) {
        if (remaining.length > 0) {
          selectChat(remaining[0]._id);
        } else {
          setCurrentChat(null);
          setMessages([]);
          setDocuments([]);
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete chat', err);
      alert(err.response?.data?.error || 'Could not delete chat');
    }
  };

  const handleJoinChat = async (code) => {
    if (isGuest) return;
    const joinedChat = await api.joinChatByCode(code);
    setChats((prev) => {
      if (!prev.some((c) => c._id === joinedChat._id)) return [joinedChat, ...prev];
      return prev;
    });
    switchSocketRoom(joinedChat.shareCode);
    setCurrentChat(joinedChat);
    setDocuments(joinedChat.documents || []);
    setMessages([...joinedChat.messages, { role: 'system', content: `🎉 You joined this room as "${username}"` }]);
  };

  const handleSendMessage = async (text) => {
    if (!currentChat) return;
    // Optimistic user message
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);
    try {
      const updatedChat = await api.sendMessage(currentChat._id, text);
      // Use the API response directly — more reliable than socket alone
      if (updatedChat && updatedChat.messages) {
        setMessages(updatedChat.messages);
        setCurrentChat(updatedChat);
      }
    } catch (err) {
      console.error('Failed to send message', err);
      setMessages((prev) => [...prev, { role: 'model', content: '⚠️ Failed to get a response. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadDoc = async (chatId, file) => {
    const res = await api.uploadDocument(chatId, file);
    setDocuments(res.documents || []);
    // Update chat list to show doc count badge
    setChats((prev) => prev.map((c) => c._id === chatId ? { ...c, documents: res.documents } : c));
  };

  const handleDeleteDoc = async (chatId, docId) => {
    const res = await api.deleteDocument(chatId, docId);
    setDocuments(res.documents || []);
    setChats((prev) => prev.map((c) => c._id === chatId ? { ...c, documents: res.documents } : c));
  };

  const handleLogout = () => {
    if (currentRoomRef.current) {
      socket.emit('leave-room', currentRoomRef.current);
      currentRoomRef.current = null;
    }
    logout();
  };

  // ─── GUEST MODE ───────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <div className="app-container" style={{ gridTemplateColumns: '1fr' }}>
        <div className="main-chat">
          {currentChat && (
            <div style={{
              padding: '10px 20px',
              background: 'rgba(99,102,241,0.08)',
              borderBottom: '1px solid rgba(99,102,241,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.85rem',
              color: '#a5b4fc',
            }}>
              <span>🔗</span>
              <span>
                <strong style={{ color: '#c7d2fe' }}>{currentChat.title || 'Shared Chat'}</strong>
                <span style={{ margin: '0 8px', opacity: 0.5 }}>·</span>
                Share Code: <strong style={{ letterSpacing: '2px', color: '#818cf8' }}>{currentChat.shareCode}</strong>
              </span>
              <button
                onClick={handleLogout}
                style={{
                  marginLeft: 'auto', background: 'none',
                  border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px',
                  color: '#94a3b8', padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem',
                }}
              >
                Leave
              </button>
            </div>
          )}
          <ChatWindow messages={messages} isLoading={isLoading} />
          <MessageInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            currentChatId={currentChat?._id}
            documents={documents}
            onUploadDoc={handleUploadDoc}
            onDeleteDoc={handleDeleteDoc}
          />
        </div>
      </div>
    );
  }

  // ─── FULL USER MODE ───────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <Sidebar
        chats={chats}
        currentChat={currentChat}
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onJoinChat={handleJoinChat}
        onDeleteChat={handleDeleteChat}
        onLogout={handleLogout}
        username={username}
      />
      <div className="main-chat">
        <ChatWindow messages={messages} isLoading={isLoading} />
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          currentChatId={currentChat?._id}
          documents={documents}
          onUploadDoc={handleUploadDoc}
          onDeleteDoc={handleDeleteDoc}
        />
      </div>
    </div>
  );
};

export default ChatPage;
