// leaflet.heat is an old plugin that adds itself to a global L, so it is given one.
// HeatLayer imports this file before leaflet.heat, so L exists when the plugin runs.
import L from "leaflet"

window.L = L
