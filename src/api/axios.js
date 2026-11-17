import axios from "axios";
import { clearCache } from "./cache";

// Base instance for the real Flask API (used once the mocks are removed).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// attach the token to every request
api.interceptors.request.use((config) => {
  // anything that is not a GET may change data, so cached GETs are dropped (see cache.js)
  if ((config.method || "get").toLowerCase() !== "get") clearCache();
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 means the token expired: log out and go to the login page
api.interceptors.response.use(
  (response) => {
    // clear again once the change is done, so a GET that ran meanwhile is not kept
    if ((response.config?.method || "get").toLowerCase() !== "get") clearCache();
    return response;
  },
  (error) => {
    // a wrong password on the login page is also a 401, so leave that one alone
    const isLogin = error.config?.url === "/api/auth/login";
    if (error.response?.status === 401 && !isLogin) {
      clearCache();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
