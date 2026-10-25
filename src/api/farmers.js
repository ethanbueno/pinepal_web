import { mockFarmers } from "../mock/farmers";
import { countScans } from "./scans";
import { DISEASES } from "../utils/diseases";

// MOCK VERSION. Changes only last until the page is refreshed.

const farmers = [...mockFarmers];

const wait = (data) =>
  new Promise((resolve) => setTimeout(() => resolve(data), 300));

// the scan count now comes from the Flask API
const withTotal = async (farmer) => ({
  ...farmer,
  total_scans: await countScans({ farmer_id: farmer.farmer_id }),
});

export function getFarmers({ search = "", municipality = "", status = "" } = {}) {
  const result = farmers.filter((f) => {
    if (municipality && f.municipality !== municipality) return false;
    if (status === "active" && !f.is_active) return false;
    if (status === "inactive" && f.is_active) return false;
    if (search) {
      const text = (f.full_name + " " + f.farm_name).toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }
    return true;
  });
  return wait(result).then((list) => Promise.all(list.map(withTotal)));
}

// MOCK: finds the farm that belongs to the logged in farmer account by name.
// Real version: the backend knows which farmer the account is (GET /api/farmers/me).
export function getMyFarmer(user) {
  const found = farmers.find((f) => f.full_name === user.full_name);
  return wait(found ? withTotal(found) : null);
}

export function getFarmer(id) {
  const found = farmers.find((f) => f.farmer_id === id);
  if (!found) {
    return Promise.reject({ response: { status: 404, data: { error: "Farmer not found" } } });
  }

  return Promise.all([
    withTotal(found),
    ...DISEASES.map((d) => countScans({ farmer_id: id, diseases: [d.label] })),
  ]).then(([farmer, ...counts]) =>
    wait({
      ...farmer,
      scans_by_disease: DISEASES.map((d, i) => ({ label: d.label, count: counts[i] })),
    }),
  );
}

export function createFarmer(data) {
  const newFarmer = {
    ...data,
    farmer_id: "F" + String(farmers.length + 1).padStart(3, "0"),
    is_active: true,
    registered_at: new Date().toISOString().slice(0, 19),
  };
  delete newFarmer.password; // the real backend hashes it
  farmers.push(newFarmer);
  return wait(withTotal(newFarmer));
}

export function updateFarmer(id, data) {
  const found = farmers.find((f) => f.farmer_id === id);
  const changes = { ...data };
  delete changes.password;
  Object.assign(found, changes);
  return wait(withTotal(found));
}

export function setFarmerStatus(id, isActive) {
  const found = farmers.find((f) => f.farmer_id === id);
  found.is_active = isActive;
  return wait(withTotal(found));
}
