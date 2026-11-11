import api from "./axios";
import { toParams } from "./scans";

// Every sign-in attempt on the web and the mobile app (backend/login_history.py). Admins only.
// filters: search, result ("success" | "failed"), platform ("web" | "mobile")
// returns { items, total, page, per_page }
export const getLoginHistory = ({ page = 1, per_page = 25, ...filters } = {}) =>
  api.get("/api/login-history", { params: { ...toParams(filters), page, per_page } }).then((res) => res.data);
