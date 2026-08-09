import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import * as api from './services/api';
import { socket } from './services/socket';

function App() {
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentRoomRef = useRef(null);

  useEffect(() => {
    loadChats();
  }, []);

  // Listen for real-time live updates from Socket.io
  useEffect(() => {
    const handleChatUpdated = (updatedChat) => {
      if (currentChat && updatedChat._id === currentChat._id) {
        setMessages(updatedChat.messages);
        setCurrentChat(updatedChat);
      }
      setChats((prevChats) =>
        prevChats.map((c) => (c._id === updatedChat._id ? updatedChat : c))
      );
    };

    const handleUserJoined = (username) => {
      const systemMessage = {
        role: 'system',
        content: `👋 ${username} has joined the chat room!`
      };
      setMessages((prev) => [...prev, systemMessage]);
    };

    socket.on('chat-updated', handleChatUpdated);
    socket.on('user-joined', handleUserJoined);

    return () => {
      socket.off('chat-updated', handleChatUpdated);
      socket.off('user-joined', handleUserJoined);
    };
  }, [currentChat]);

  const loadChats = async () => {
    try {
      const data = await api.getChats();
      setChats(data);
      if (data.length > 0 && !currentChat) {
        selectChat(data[0]._id);
      } else if (data.length === 0) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Failed to load chats', error);
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

  const switchSocketRoom = (newShareCode, username = null) => {
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
      setChats([newChat, ...chats]);
      switchSocketRoom(newChat.shareCode);
      setCurrentChat(newChat);
      setMessages([]);
    } catch (error) {
      console.error('Failed to create new chat', error);
    }
  };

  const handleJoinChat = async (code, username) => {
    const joinedChat = await api.joinChatByCode(code);
    setChats((prev) => {
      if (!prev.some((c) => c._id === joinedChat._id)) {
        return [joinedChat, ...prev];
      }
      return prev;
    });
    switchSocketRoom(joinedChat.shareCode, username);
    setCurrentChat(joinedChat);
    
    // Add local notification that you joined
    const localJoinedMessage = {
      role: 'system',
      content: `🎉 You joined the chat room as "${username}"`
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

  return (
    <div className="app-container">
      <Sidebar 
        chats={chats} 
        currentChat={currentChat} 
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onJoinChat={handleJoinChat}
      />
      <div className="main-chat">
        <ChatWindow messages={messages} isLoading={isLoading} />
        <MessageInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}

export default App;
