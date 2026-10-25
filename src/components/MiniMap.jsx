import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from "react-leaflet";
import { viewBounds, viewMaxBounds } from "../utils/mapArea";
import IsabelaLayer from "./IsabelaLayer";

// listens for clicks on the map (only used when onPick is given)
function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// A small map with colored dots.
// points = [{ id, lat, lng, color, text }]. If onPick is given, clicking the map picks a location.
function MiniMap({ points = [], center, zoom, height = 300, onPick }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10" style={{ height }}>
      <MapContainer
        {...(center ? { center, zoom: zoom || 12 } : { bounds: viewBounds })}
        maxBounds={viewMaxBounds}
        maxBoundsViscosity={1}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <IsabelaLayer />
        {onPick && <ClickHandler onPick={onPick} />}
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={8}
            pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.7 }}
          >
            {p.text && <Popup>{p.text}</Popup>}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default MiniMap;
