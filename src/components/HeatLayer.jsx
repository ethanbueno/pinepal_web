import { useEffect } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import "./leafletGlobal"
import "leaflet.heat"

// A heat map over a react-leaflet map: brighter where more points are close together.
// points = [[lat, lng], ...]
function HeatLayer({ points }) {
  const map = useMap()

  useEffect(() => {
    const layer = L.heatLayer(points, {
      radius: 25,
      blur: 18,
      maxZoom: 14,
      minOpacity: 0.35,
      gradient: { 0.2: "#2563EB", 0.4: "#16A34A", 0.6: "#EAB308", 0.8: "#F97316", 1: "#DC2626" },
    }).addTo(map)
    return () => {
      map.removeLayer(layer)
    }
  }, [map, points])

  return null
}

export default HeatLayer
