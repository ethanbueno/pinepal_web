import api from "./axios";
import { toParams } from "./scans";

// Downloads the matching scans from the Flask API as a CSV or an Excel (XLSX) file.
// Resolves with the number of rows that were exported.
export async function downloadExport(filters, format) {
  const extension = format === "xlsx" ? "xlsx" : "csv";

  const res = await api.get("/api/scans/export", {
    params: { ...toParams(filters), format: extension },
    responseType: "blob",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(res.data);
  link.download = "pinepal_scans_" + new Date().toISOString().slice(0, 10) + "." + extension;
  link.click();
  URL.revokeObjectURL(link.href);

  return Number(res.headers["x-row-count"] ?? 0);
}
