import mobileGuides from "../data/guides.json"

// The remediation guides, with the same content as the Guide tab in the mobile app.
// src/data/guides.json is a copy of assets/data/remediation_protocols.json from
// pinepal_mobile; copy it again when the mobile guide changes.

// "Crown Rot" -> "Crown_Rot", the model label
const toLabel = (key) => key.trim().replace(/[\s-]+/g, "_")

// Same three types as the mobile guide
export function guideType(label, cause) {
  const text = cause.toLowerCase()
  if (label === "No_Disease" || text.includes("no pathogen")) return "Healthy"
  if (text.includes("disorder")) return "Disorder"
  return "Disease"
}

// "assets/images/diseases/crown_rot.jpg" -> "/guides/crown_rot.jpg" (served from public/guides)
const toImageUrl = (path) => (path ? "/guides/" + path.split("/").pop() : null)

// The header photos as URLs: the "images" list, or just "image" when there is no list
const toImageUrls = (entry) => {
  const urls = (entry.images || []).map(toImageUrl).filter(Boolean)
  if (urls.length > 0) return urls
  const main = toImageUrl(entry.image)
  return main ? [main] : []
}

// Philippine sources first, then Southeast Asian, then international
export const TIER_ORDER = ["Philippines", "Southeast Asia", "International"]
const tierRank = (tier) => {
  const i = TIER_ORDER.indexOf(tier)
  return i === -1 ? TIER_ORDER.length : i
}
export const sortSources = (sources) => [...sources].sort((a, b) => tierRank(a.tier) - tierRank(b.tier))

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
    // all header photos, main photo first (falls back to the one image)
    image_urls: toImageUrls(entry),
    // who took each header photo: [{ file, title, author, license, url }]
    photo_credits: entry.photo_credits || [],
    about: entry.description || "",
    symptoms: (entry.symptoms || []).join(" "),
    immediate_action: (entry.remediation_steps || []).join("\n"),
    prevention: (entry.preventive_measures || []).join(" "),
    // the separate items, so the card can show bullets (symptoms/prevention also stay joined as text)
    symptom_items: entry.symptoms || [],
    prevention_items: entry.preventive_measures || [],
    look_alikes: entry.look_alikes || [],
    checks: entry.checks || [],
    scan_tips: entry.scan_tips || [],
    get_help: entry.get_help || [],
    sources: sortSources(entry.sources || []),
    reviewed: entry.reviewed || null,
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

// The photos a guide has, main photo first. Older saved guides only have image_url.
export const guidePhotos = (protocol) => {
  const urls = (protocol.image_urls || []).filter(Boolean)
  if (urls.length > 0) return urls
  return protocol.image_url ? [protocol.image_url] : []
}
