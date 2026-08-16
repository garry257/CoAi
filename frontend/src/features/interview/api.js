import axios from 'axios';

const isProd = import.meta.env.PROD;
const BASE = isProd ? '' : 'http://localhost:5005';
const API_URL = `${BASE}/api/interviews`;

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const createInterview = async (config) => {
  try {
    const response = await axios.post(API_URL, config, { headers: getHeaders() });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Error creating interview'
    };
  }
};

export const startInterview = async (interviewId) => {
  try {
    const response = await axios.post(`${API_URL}/${interviewId}/start`, {}, { headers: getHeaders() });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Error starting interview'
    };
  }
};

export const getCurrentQuestion = async (interviewId) => {
  try {
    const response = await axios.get(`${API_URL}/${interviewId}/current-question`, { headers: getHeaders() });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Error fetching question'
    };
  }
};

export const submitAnswer = async (interviewId, questionNumber, answerText, durationSeconds) => {
  try {
    const response = await axios.post(`${API_URL}/${interviewId}/answer`, {
      questionNumber,
      answerText,
      durationSeconds
    }, { headers: getHeaders() });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Error submitting answer'
    };
  }
};

export const getInterview = async (interviewId) => {
  try {
    const response = await axios.get(`${API_URL}/${interviewId}`, { headers: getHeaders() });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Error fetching interview'
    };
  }
};

export const listInterviews = async () => {
  try {
    const response = await axios.get(API_URL, { headers: getHeaders() });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Error fetching interviews'
    };
  }
};

export const completeInterview = async (interviewId) => {
  try {
    const response = await axios.post(`${API_URL}/${interviewId}/complete`, {}, { headers: getHeaders() });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Error completing interview'
    };
  }
};

export const skipQuestion = async (interviewId) => {
  try {
    const response = await axios.post(`${API_URL}/${interviewId}/skip-question`, {}, { headers: getHeaders() });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Error skipping question'
    };
  }
};
