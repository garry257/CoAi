import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5005';
export const socket = io(SOCKET_URL, {
  autoConnect: true,
});
