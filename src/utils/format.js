import { getDisease } from "./diseases";

export function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// digits = 1 gives "87.3%" (single scan views), 0 gives "87%" (tables and totals)
export function formatPercent(value, digits = 0) {
  if (value === null || value === undefined) return "-";
  return (value * 100).toFixed(digits) + "%";
}

// A simple colored picture, used while there are no real scan photos.
export function placeholderImage(label) {
  const disease = getDisease(label);
  const color = disease ? disease.color : "#888888";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">` +
    `<rect width="400" height="300" fill="${color}"/>` +
    `<text x="200" y="165" font-size="90" text-anchor="middle">🍍</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export function scanImage(scan) {
  return scan.image_url || placeholderImage(scan.verified_label || scan.predicted_label);
}
