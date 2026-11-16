import api from "./axios";
import { toParams } from "./scans";

// Everything that happens in PinePal (backend/audit_logs.py). Admins only.
// filters: search, category ("activity" | "login" | "data"), result ("success" | "failed"),
//          platform ("web" | "mobile"), table ("users" | "farmers" | "mobile_scans")
// returns { items, total, page, per_page }; each activity or sign-in item has the data
// changes it made in item.changes
export const getAuditLogs = ({ page = 1, per_page = 25, ...filters } = {}) =>
  api.get("/api/audit-logs", { params: { ...toParams(filters), page, per_page } }).then((res) => res.data);
