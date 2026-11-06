import mobileGuides from "../data/guides.json"

// The remediation guides, with the same content as the Guide tab in the mobile app.
// src/data/guides.json is a copy of assets/data/remediation_protocols.json from
// pinepal_mobile; copy it again when the mobile guide changes.

// "Crown Rot" -> "Crown_Rot", the model label
const toLabel = (key) => key.trim().replace(/[\s-]+/g, "_")

// Same three types as the mobile guide
function guideType(label, cause) {
  const text = cause.toLowerCase()
  if (label === "No_Disease" || text.includes("no pathogen")) return "Healthy"
  if (text.includes("disorder")) return "Disorder"
  return "Disease"
}

// "assets/images/diseases/crown_rot.jpg" -> "/guides/crown_rot.jpg" (served from public/guides)
const toImageUrl = (path) => (path ? "/guides/" + path.split("/").pop() : null)

// One mobile entry in the shape the Guide pages use. Steps are one per line,
// so the edit form can show them in a textarea and the card can number them.
function fromMobile(key, entry, index) {
  const label = toLabel(key)
  const cause = entry.pathogen_type || ""
  return {
    protocol_id: index + 1,
    label,
    display_name: entry.name || key,
    scientific_name: entry.scientific_name || "",
    cause,
    type: guideType(label, cause),
    severity: entry.severity || "Medium",
    image_url: toImageUrl(entry.image),
    about: entry.description || "",
    symptoms: (entry.symptoms || []).join(" "),
    immediate_action: (entry.remediation_steps || []).join("\n"),
    prevention: (entry.preventive_measures || []).join(" "),
    version: 1,
    updated_at: "2026-11-03T00:00:00",
  }
}

export const startingGuides = Object.entries(mobileGuides).map(([key, entry], index) =>
  fromMobile(key, entry, index)
)

// "1. ...", "2. ..." steps from the immediate action text, one step per line
export const actionSteps = (text) =>
  (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
