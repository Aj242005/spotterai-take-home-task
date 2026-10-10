import axios from 'axios';

// Relative by default so the app works wherever it is served from — the Docker
// image serves this build from Django on the same origin. A hardcoded
// http://localhost:8000/api silently broke every deployment that was not a
// local dev machine. Set VITE_API_BASE_URL to point somewhere else.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BACKEND_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT Access Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Interceptor to handle Token Refresh & Rate Limits
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized (Token Expiration -> Refresh Token Rotation)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/accounts/token/refresh/`, {
            refresh: refreshToken,
          });
          const newAccessToken = res.data.access;
          const newRefreshToken = res.data.refresh;
          
          localStorage.setItem('access_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken);
          }
          
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.dispatchEvent(new Event('auth-logout'));
        }
      }
    }

    // Handle 429 Rate Limit
    if (error.response?.status === 429) {
      const msg = error.response.data?.error || 'Rate limit exceeded. Please wait a moment.';
      console.warn('API Rate Limit Triggered:', msg);
    }

    return Promise.reject(error);
  }
);

export default api;
