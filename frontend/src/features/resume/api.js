import axios from 'axios';

const isProd = import.meta.env.PROD;
const BASE = isProd ? '' : 'http://localhost:5005';

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

/**
 * Upload a PDF resume file and get back the analyzed candidate profile.
 * @param {File} file - PDF File object
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{resume, candidateProfile}>}
 */
export const uploadResume = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('resume', file);

  const res = await axios.post(`${BASE}/api/resumes`, formData, {
    headers: {
      ...getHeaders(),
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });

  return res.data.data;
};

/**
 * Get the current user's candidate profile.
 * @returns {Promise<object>} - Candidate profile
 */
export const getCandidateProfile = async () => {
  const res = await axios.get(`${BASE}/api/candidate-profile/me`, {
    headers: getHeaders(),
  });
  return res.data.data;
};

/**
 * Get a specific resume by ID.
 * @param {string} id - Resume MongoDB ID
 */
export const getResume = async (id) => {
  const res = await axios.get(`${BASE}/api/resumes/${id}`, {
    headers: getHeaders(),
  });
  return res.data.data;
};
