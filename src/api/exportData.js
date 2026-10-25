import api from "./axios";
import { toParams } from "./scans";

// Downloads the matching scans as a CSV file from the Flask API.
// Resolves with the number of rows that were exported.
export async function downloadExport(filters, format) {
  if (format === "xlsx") {
    throw new Error("XLSX export is not available yet. Use CSV.");
  }

  const res = await api.get("/api/scans/export", {
    params: toParams(filters),
    responseType: "blob",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(res.data);
  link.download = "pinepal_scans_" + new Date().toISOString().slice(0, 10) + ".csv";
  link.click();
  URL.revokeObjectURL(link.href);

  return Number(res.headers["x-row-count"] ?? 0);
}
