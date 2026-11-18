import api from "./axios";

// Real version: the scans come from the Flask API (the mobile app's scans in MySQL).

// Drop empty filters and turn them into plain query-string values.
export function toParams(filters = {}) {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === "" || value === null || value === undefined || value === false) return;
    if (Array.isArray(value)) {
      if (value.length > 0) params[key] = value.join(",");
    } else if (value === true) {
      params[key] = "1";
    } else {
      params[key] = value;
    }
  });
  return params;
}

// returns { items, total, page, per_page }
export const getScans = ({ page = 1, per_page = 20, ...filters } = {}) =>
  api.get("/api/scans", { params: { ...toParams(filters), page, per_page } }).then((res) => res.data);

// number of scans that match the filters
export const countScans = (filters) =>
  api.get("/api/scans/count", { params: toParams(filters) }).then((res) => res.data);

// lighter objects for the map
export const getMapScans = (filters) =>
  api.get("/api/scans/map", { params: toParams(filters) }).then((res) => res.data);

export const getScan = (uuid) => api.get("/api/scans/" + uuid).then((res) => res.data);

export const verifyScan = (uuid, verifiedLabel, verifiedBy) =>
  api
    .post("/api/scans/" + uuid + "/verify", { verified_label: verifiedLabel, verified_by: verifiedBy })
    .then((res) => res.data);

export const deleteScan = (uuid) => api.delete("/api/scans/" + uuid).then(() => null);

// used by the Diagnose page ("Save as Scan")
export const createScan = (data) => api.post("/api/scans", data).then((res) => res.data);

// A farmer saving from the Diagnose page: the same upload the mobile app uses, so the
// photo is kept and the scan lands in the farmer's own history.
// scan: scan_uuid, farm_name, municipality, latitude, longitude, scanned_at,
//       predicted_label, confidence, second_label, second_confidence, notes
export function uploadMyScan(file, scan) {
  const form = new FormData();
  Object.entries(scan).forEach(([key, value]) => {
    if (value !== null && value !== undefined) form.append(key, value);
  });
  form.append("image_source", "Web");
  form.append("image", file);
  return api.post("/api/mobile/scans", form).then((res) => res.data);
}
