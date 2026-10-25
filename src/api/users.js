import api from "./axios";

// Real version: accounts come from the users table through the Flask API (admin only).

export const getUsers = () => api.get("/api/users").then((res) => res.data);

export const createUser = (data) => api.post("/api/users", data).then((res) => res.data);

export const updateUser = (id, data) => api.put("/api/users/" + id, data).then((res) => res.data);

export const deleteUser = (id) => api.delete("/api/users/" + id).then(() => null);
