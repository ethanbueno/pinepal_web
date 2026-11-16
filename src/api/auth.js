import api from "./axios";

// returns { access_token, user }
export const loginRequest = (username, password) =>
  api.post("/api/auth/login", { username, password }).then((res) => res.data);

// returns the new user
export const registerRequest = ({ full_name, username, email, password, role }) =>
  api
    .post("/api/auth/register", { full_name, username, email, password, role })
    .then((res) => res.data);

export const getMe = () => api.get("/api/auth/me").then((res) => res.data);

// Tells the server, so the sign-out shows in the audit logs. Never fails the sign-out.
// The token is passed here because the caller removes it from storage right after.
export const logoutRequest = (token) =>
  api
    .post("/api/auth/logout", { platform: "web" }, { headers: { Authorization: `Bearer ${token}` } })
    .catch(() => null);
