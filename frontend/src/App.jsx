import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import Auth from './components/Auth';
import * as api from './services/api';
import { socket } from './services/socket';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentRoomRef = useRef(null);

  useEffect(() => {
    if (token) {
      loadChats();
    }
  }, [token]);

  // Listen for real-time live updates from Socket.io
  useEffect(() => {
    if (!token) return;

    const handleChatUpdated = (updatedChat) => {
      if (currentChat && updatedChat._id === currentChat._id) {
        setMessages(updatedChat.messages);
        setCurrentChat(updatedChat);
      }
      setChats((prevChats) =>
        prevChats.map((c) => (c._id === updatedChat._id ? updatedChat : c))
      );
    };

    const handleUserJoined = (joinedUser) => {
      if (joinedUser !== username) {
        const systemMessage = {
          role: 'system',
          content: `👋 ${joinedUser} has joined the chat room!`
        };
        setMessages((prev) => [...prev, systemMessage]);
      }
    };

    socket.on('chat-updated', handleChatUpdated);
    socket.on('user-joined', handleUserJoined);

    return () => {
      socket.off('chat-updated', handleChatUpdated);
      socket.off('user-joined', handleUserJoined);
    };
  }, [currentChat, token]);

  const loadChats = async () => {
    try {
      const data = await api.getChats();
      setChats(data);
      if (data.length > 0) {
        selectChat(data[0]._id);
      } else {
        handleNewChat();
      }
    } catch (error) {
      console.error('Failed to load chats', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const selectChat = async (id) => {
    try {
      const chat = await api.getChatById(id);
      switchSocketRoom(chat.shareCode);
      setCurrentChat(chat);
      setMessages(chat.messages);
    } catch (error) {
      console.error('Failed to load chat messages', error);
    }
  };

  const switchSocketRoom = (newShareCode) => {
    if (currentRoomRef.current) {
      socket.emit('leave-room', currentRoomRef.current);
    }
    if (newShareCode) {
      socket.emit('join-room', { shareCode: newShareCode, username });
      currentRoomRef.current = newShareCode;
    }
  };

  const handleNewChat = async () => {
    try {
      const newChat = await api.createChat();
      setChats((prev) => [newChat, ...prev]);
      switchSocketRoom(newChat.shareCode);
      setCurrentChat(newChat);
      setMessages([]);
    } catch (error) {
      console.error('Failed to create new chat', error);
    }
  };

  const handleJoinChat = async (code) => {
    const joinedChat = await api.joinChatByCode(code);
    setChats((prev) => {
      if (!prev.some((c) => c._id === joinedChat._id)) {
        return [joinedChat, ...prev];
      }
      return prev;
    });
    switchSocketRoom(joinedChat.shareCode);
    setCurrentChat(joinedChat);
    
    // Add local notification that you joined
    const localJoinedMessage = {
      role: 'system',
      content: `🎉 You joined this room as "${username}"`
    };
    setMessages([...joinedChat.messages, localJoinedMessage]);
  };

  const handleSendMessage = async (text) => {
    if (!currentChat) return;

    // Optimistically append user message
    const newMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    try {
      await api.sendMessage(currentChat._id, text);
    } catch (error) {
      console.error('Failed to send message', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = (newToken, newUsername) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
    setChats([]);
    setCurrentChat(null);
    setMessages([]);
    if (currentRoomRef.current) {
      socket.emit('leave-room', currentRoomRef.current);
      currentRoomRef.current = null;
    }
  };

  if (!token) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app-container">
      <Sidebar 
        chats={chats} 
        currentChat={currentChat} 
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onJoinChat={handleJoinChat}
        onLogout={handleLogout}
        username={username}
      />
      <div className="main-chat">
        <ChatWindow messages={messages} isLoading={isLoading} />
        <MessageInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}

export default App;
