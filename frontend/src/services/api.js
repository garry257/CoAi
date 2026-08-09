import axios from 'axios';

const API_URL = 'http://localhost:5005/api/chats';

export const getChats = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

export const createChat = async () => {
  const response = await axios.post(API_URL);
  return response.data;
};

export const joinChatByCode = async (shareCode) => {
  const response = await axios.post(`${API_URL}/join`, { shareCode });
  return response.data;
};

export const getChatById = async (id) => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data;
};

export const sendMessage = async (id, message) => {
  const response = await axios.post(`${API_URL}/${id}/messages`, { message });
  return response.data;
};
