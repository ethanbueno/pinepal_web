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

// Forgot password (backend/password_reset.py). Returns { mode: "direct", reset_token, username }
// when the email belongs to an account (404 when it doesn't), or { mode: "code", message } when
// the server emails a 6-digit code instead (PASSWORD_RESET_EMAIL_CODE=1).
export const requestResetCode = (email) =>
  api.post("/api/auth/forgot-password", { email }).then((res) => res.data);

// Sets the new password: with the reset_token (direct mode) or the emailed code. Returns { message }.
export const resetPassword = ({ email, code, resetToken, newPassword }) =>
  api
    .post("/api/auth/reset-password", { email, code, reset_token: resetToken, new_password: newPassword })
    .then((res) => res.data);

// Tells the server, so the sign-out shows in the audit logs. Never fails the sign-out.
// The token is passed here because the caller removes it from storage right after.
export const logoutRequest = (token) =>
  api
    .post("/api/auth/logout", { platform: "web" }, { headers: { Authorization: `Bearer ${token}` } })
    .catch(() => null);
