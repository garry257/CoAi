import axios from 'axios';

const isProd = import.meta.env.PROD;
const baseUrl = isProd ? '' : 'http://localhost:5005';
const DASHBOARD_API = `${baseUrl}/api/dashboard`;

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

export const getDashboardSummary = async () => {
  const res = await axios.get(`${DASHBOARD_API}/summary`, getAuthHeaders());
  return res.data.data;
};

export const getDashboardProgress = async () => {
  const res = await axios.get(`${DASHBOARD_API}/progress`, getAuthHeaders());
  return res.data.data;
};

export const deleteWeakTopic = async (topic) => {
  const res = await axios.delete(`${DASHBOARD_API}/weak-topics/${encodeURIComponent(topic)}`, getAuthHeaders());
  return res.data;
};
