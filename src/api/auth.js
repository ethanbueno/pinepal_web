import api from "./axios";

// returns { access_token, user }
export const loginRequest = (username, password) =>
  api.post("/api/auth/login", { username, password }).then((res) => res.data);

// returns the new user
export const registerRequest = ({ full_name, username, password, role }) =>
  api
    .post("/api/auth/register", { full_name, username, password, role })
    .then((res) => res.data);

export const getMe = () => api.get("/api/auth/me").then((res) => res.data);
