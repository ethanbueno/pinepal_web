import { isabelaBounds, isabelaMaxBounds, isabelaTowns } from "../data/isabela";
import { LOCKED_MUNICIPALITY } from "./diseases";

// The town the maps are locked to (null = no lock, show all of Isabela).
export const lockedTown = LOCKED_MUNICIPALITY
  ? isabelaTowns.find((t) => t.name === LOCKED_MUNICIPALITY) || null
  : null;

// where the maps start, and the only area they can be moved around in
export const viewBounds = lockedTown ? lockedTown.bounds : isabelaBounds;
export const viewMaxBounds = lockedTown ? lockedTown.bounds : isabelaMaxBounds;

// Is [lat, lng] inside the town the maps are locked to (Echague)? Pinned locations must be,
// and the server checks it too (backend/echague_area.py, same outline). No lock = anywhere.
export function insideLockedTown(lat, lng) {
  if (!lockedTown) return true
  if (lat == null || lng == null) return false
  let inside = false
  for (const ring of lockedTown.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [latI, lngI] = ring[i]
      const [latJ, lngJ] = ring[j]
      if (latI > lat !== latJ > lat && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI) {
        inside = !inside
      }
    }
  }
  return inside
}

export const OUTSIDE_TOWN = `Pin a spot inside ${LOCKED_MUNICIPALITY || "the area"}. PinePal only covers ${
  LOCKED_MUNICIPALITY || "this area"
} for now.`
