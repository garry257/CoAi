import { io } from 'socket.io-client';

// In production on Render, Socket connects to window.location.origin
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5005');

export const socket = io(SOCKET_URL, {
  autoConnect: true,
});
