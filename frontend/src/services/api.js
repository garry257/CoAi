import axios from 'axios';

const isProd = import.meta.env.PROD;
const baseUrl = isProd ? '' : 'http://localhost:5005';
const API_URL = `${baseUrl}/api/chats`;

// Add a request interceptor to attach JWT token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
