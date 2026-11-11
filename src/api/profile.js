import api from "./axios";

// The signed-in user's own profile (backend/my_profile.py)

// { account: { full_name, username, email, role, created_at }, farm: {...} | null }
export const getProfile = () => api.get("/api/profile").then((res) => res.data);

// only full_name, and for farmers farm_name and farm_size_ha, are saved; returns the new profile
export const updateProfile = (data) => api.put("/api/profile", data).then((res) => res.data);

export const changePassword = (currentPassword, newPassword) =>
  api
    .post("/api/profile/password", { current_password: currentPassword, new_password: newPassword })
    .then((res) => res.data);
