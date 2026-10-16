import axios from 'axios';
import { SERVER_URL } from '../utils/serverUrl';

const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
});

// Automatically inject JWT token to all requests if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
