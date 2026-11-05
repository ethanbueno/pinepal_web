import api from "./axios";

// Sends the photo to Flask, which runs the same .tflite model as the mobile app.
// Returns { is_pineapple, pineapple_score, predictions: [{ label, confidence }], uncertain, protocol }.
// When is_pineapple is false, predictions is empty and the photo must not be saved.
export function diagnoseImage(file) {
  const form = new FormData();
  form.append("image", file);
  return api.post("/api/diagnose", form).then((res) => res.data);
}
