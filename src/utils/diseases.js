// One place for disease names and colors so a class always looks the same.
export const DISEASES = [
  { label: "Crown_Rot", name: "Crown Rot", color: "#D97706" },
  { label: "Fruit_Rot", name: "Fruit Rot", color: "#B91C1C" },
  { label: "Mealybug_Wilt", name: "Mealybug Wilt", color: "#7C3AED" },
  { label: "Fruit_Fasciation", name: "Fruit Fasciation", color: "#2563EB" },
  { label: "Multiple_Crown", name: "Multiple Crown", color: "#0891B2" },
  { label: "No_Disease", name: "No Disease", color: "#16A34A" },
];

export const LOW_CONFIDENCE = 0.6;
// at or above this a scan is in the Dashboard's "Highest confidence" list (HIGH_CONFIDENCE in backend/mobile_scans.py)
export const HIGH_CONFIDENCE = 0.9;

// All 3 cities and 34 municipalities of Isabela, A to Z. The names match the municipality column
// in the scans data (and data/isabela.js).
export const MUNICIPALITIES = [
  "Alicia",
  "Angadanan",
  "Aurora",
  "Benito Soliven",
  "Burgos",
  "Cabagan",
  "Cabatuan",
  "Cauayan City",
  "Cordon",
  "Delfin Albano",
  "Dinapigue",
  "Divilacan",
  "Echague",
  "Gamu",
  "Ilagan City",
  "Jones",
  "Luna",
  "Maconacon",
  "Mallig",
  "Naguilian",
  "Palanan",
  "Quezon",
  "Quirino",
  "Ramon",
  "Reina Mercedes",
  "Roxas",
  "San Agustin",
  "San Guillermo",
  "San Isidro",
  "San Manuel",
  "San Mariano",
  "San Mateo",
  "San Pablo",
  "Santa Maria",
  "Santiago City",
  "Santo Tomas",
  "Tumauini",
];

export const DEFAULT_MUNICIPALITY = "Echague";

// TEMPORARY: the maps are locked to this one municipality (view, borders and scans).
// Set it to "" to show all of Isabela again.
export const LOCKED_MUNICIPALITY = "Echague";

export const MAP_CENTER = [16.7083, 121.6833]; // Echague, Isabela
export const MAP_ZOOM = 12;

export function getDisease(label) {
  return DISEASES.find((d) => d.label === label);
}
