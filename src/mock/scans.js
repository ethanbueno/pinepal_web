import { sampleFarmers } from "./farmers";
import { USE_SAMPLE_DATA } from "./config";
import { DISEASES } from "../utils/diseases";

// Temporary sample scans. Remove when the Flask /api/scans routes work.
// 60 scans spread over the last ~6 months, made with a simple loop.
const labels = DISEASES.map((d) => d.label);
const sources = ["Camera", "Camera", "Gallery", "Camera", "Web"];
const DAY = 24 * 60 * 60 * 1000;

const sampleScans = [];

for (let i = 0; i < 60; i++) {
  const farmer = sampleFarmers[i % sampleFarmers.length];
  const label = labels[(i * 7 + 3) % 6];
  let secondLabel = labels[(i * 5 + 1) % 6];
  if (secondLabel === label) {
    secondLabel = labels[(i + 2) % 6];
  }

  const confidence = 0.45 + ((i * 37) % 54) / 100; // 0.45 to 0.98
  const secondConfidence = Math.min((1 - confidence) * 0.7, 0.3);
  const scannedAt = new Date(Date.now() - i * 3 * DAY).toISOString().slice(0, 19);
  const verified = i % 3 === 0;

  sampleScans.push({
    scan_uuid: "scan-" + String(i + 1).padStart(4, "0"),
    farmer_id: farmer.farmer_id,
    farmer_name: farmer.full_name,
    farm_name: farmer.farm_name,
    municipality: farmer.municipality,
    latitude: farmer.farm_latitude + (((i * 13) % 20) - 10) / 1000,
    longitude: farmer.farm_longitude + (((i * 17) % 20) - 10) / 1000,
    scanned_at: scannedAt,
    predicted_label: label,
    confidence: Number(confidence.toFixed(3)),
    second_label: secondLabel,
    second_confidence: Number(secondConfidence.toFixed(3)),
    image_source: sources[i % sources.length],
    image_url: "",
    synced_at: scannedAt,
    verified_label: verified ? (i % 9 === 0 ? secondLabel : label) : null,
    verified_by: verified ? "Olivia Officer" : null,
    verified_at: verified ? scannedAt : null,
    notes: i % 4 === 0 ? "Leaves look dry near the base." : null,
  });
}

export const mockScans = USE_SAMPLE_DATA ? sampleScans : [];
