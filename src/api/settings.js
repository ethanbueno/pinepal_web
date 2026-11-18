import api from "./axios";

// Settings admins change from the web (backend/app_settings.py)

// the mobile app's download link; public, the login page uses it. Returns the URL string.
export const getAppDownloadUrl = () =>
  api.get("/api/settings/app-download").then((res) => res.data.url);

// admin only; returns the saved URL
export const saveAppDownloadUrl = (url) =>
  api.put("/api/settings/app-download", { url }).then((res) => res.data.url);
