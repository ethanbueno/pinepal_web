import { isabelaBounds, isabelaMaxBounds, isabelaTowns } from "../data/isabela";
import { LOCKED_MUNICIPALITY } from "./diseases";

// The town the maps are locked to (null = no lock, show all of Isabela).
export const lockedTown = LOCKED_MUNICIPALITY
  ? isabelaTowns.find((t) => t.name === LOCKED_MUNICIPALITY) || null
  : null;

// where the maps start, and the only area they can be moved around in
export const viewBounds = lockedTown ? lockedTown.bounds : isabelaBounds;
export const viewMaxBounds = lockedTown ? lockedTown.bounds : isabelaMaxBounds;
