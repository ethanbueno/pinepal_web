import api from "./axios";

// Real version: farmers come from the farmers table through the Flask API.
// A farmer's login username is their farmer ID, which is also what the mobile app's scans carry.

// list; filters: search, municipality, status ("active" | "inactive")
export const getFarmers = ({ search = "", municipality = "", status = "" } = {}) =>
  api.get("/api/farmers", { params: { search, municipality, status } }).then((res) => res.data);

// the farm that belongs to the logged in farmer account, or null when none is linked
export const getMyFarmer = () => api.get("/api/farmers/me").then((res) => res.data);

// one farmer, with scans_by_disease
export const getFarmer = (id) => api.get("/api/farmers/" + encodeURIComponent(id)).then((res) => res.data);

// data: farm fields + username + password (creates the farmer's login)
export const createFarmer = (data) => api.post("/api/farmers", data).then((res) => res.data);

// an optional password creates or resets the farmer's login
export const updateFarmer = (id, data) =>
  api.put("/api/farmers/" + encodeURIComponent(id), data).then((res) => res.data);

export const setFarmerStatus = (id, isActive) =>
  api.patch("/api/farmers/" + encodeURIComponent(id) + "/status", { is_active: isActive }).then((res) => res.data);
