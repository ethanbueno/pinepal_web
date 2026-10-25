import api from "./axios";

// Sends the photo to Flask, which runs the same .tflite model as the mobile app.
// Returns { predictions: [{ label, confidence }], low_confidence, protocol }
export function diagnoseImage(file) {
  const form = new FormData();
  form.append("image", file);
  return api.post("/api/diagnose", form).then((res) => res.data);
}
