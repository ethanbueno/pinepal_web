import { createContext, useContext, useState } from "react";
import { loginRequest } from "../api/auth";

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

// A JWT has three parts separated by dots. The middle part holds "exp" (expiry time).
function tokenIsValid(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false; // not a real token
  }
}

// Only stay logged in if the saved token has not expired,
// otherwise the app would show the menu first and then jump to the login page.
function loadUser() {
  try {
    const token = localStorage.getItem("token");
    const saved = localStorage.getItem("user");
    if (token && saved && tokenIsValid(token)) {
      return JSON.parse(saved);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {
    // storage unavailable
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const login = async (username, password) => {
    const data = await loginRequest(username, password);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
