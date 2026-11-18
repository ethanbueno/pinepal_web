import api from "./axios";

// Admin only: downloads an encrypted backup of the whole database (backend/admin_backup.py).
// Rejects with an Error whose message is the server's reason.
export async function downloadBackup() {
  let res;
  try {
    res = await api.get("/api/admin/backup", { responseType: "blob" });
  } catch (err) {
    // the error body is a blob too: read the server's message out of it
    let message = "Could not make the backup.";
    try {
      message = JSON.parse(await err.response.data.text()).error || message;
    } catch {
      // keep the general message
    }
    throw new Error(message, { cause: err });
  }

  const named = /filename="?([^";]+)"?/.exec(res.headers["content-disposition"] || "");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(res.data);
  link.download = named ? named[1] : "pinepal_backup_" + new Date().toISOString().slice(0, 10) + ".zip";
  link.click();
  URL.revokeObjectURL(link.href);
}
