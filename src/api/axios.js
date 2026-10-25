import axios from "axios";

// Base instance for the real Flask API (used once the mocks are removed).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// attach the token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 means the token expired: log out and go to the login page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // a wrong password on the login page is also a 401, so leave that one alone
    const isLogin = error.config?.url === "/api/auth/login";
    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
