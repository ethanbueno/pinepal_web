import api from "./axios";

// Dashboard numbers. The Flask API does the counting.
export const getStats = ({ from = "", to = "" } = {}) =>
  api.get("/api/stats", { params: { from: from || undefined, to: to || undefined } }).then((res) => res.data);
