import { useEffect, useMemo, useRef } from "react";
import { Pane, Polygon, Tooltip, useMap } from "react-leaflet";
import { isabelaBounds, isabelaTowns } from "../data/isabela";
import { lockedTown, viewBounds } from "../utils/mapArea";

// one big rectangle that covers the whole world
const WORLD = [
  [-90, -360],
  [-90, 360],
  [90, 360],
  [90, -360],
];

// every ring of every town: together they are the shape of the province
const PROVINCE_RINGS = isabelaTowns.flatMap((t) => t.rings);

const OUTLINE = "#64748b";
const HIGHLIGHT = "#e5a000";

// Stops the map from zooming out past the view that fits the province (or the locked town).
function LockToArea() {
  const map = useMap();

  useEffect(() => {
    const lock = () => map.setMinZoom(map.getBoundsZoom(viewBounds));
    lock();
    map.on("resize", lock);
    return () => map.off("resize", lock);
  }, [map]);

  return null;
}

// Moves the map to the selected town, or back to the whole province when none is selected.
// The view also includes the town's scans, because some scan locations sit just over the border.
function FlyToTown({ town, scans }) {
  const map = useMap();
  const first = useRef(true);

  const target = useMemo(() => {
    if (!town) return isabelaBounds;
    let [[south, west], [north, east]] = town.bounds;
    scans.forEach((s) => {
      south = Math.min(south, s.latitude);
      north = Math.max(north, s.latitude);
      west = Math.min(west, s.longitude);
      east = Math.max(east, s.longitude);
    });
    return [[south, west], [north, east]];
  }, [town, scans]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (town) map.fitBounds(target, { padding: [24, 24], animate: false });
      return;
    }
    map.flyToBounds(target, { padding: [24, 24], duration: 0.8 });
  }, [map, target, town]);

  return null;
}

// Draws the borders of every city and municipality in Isabela. Put it inside a <MapContainer>.
//   selected  name of the town to focus on ("" = whole province)
//   onSelect  if given, towns can be hovered and clicked, and the map zooms to the selected one
//   scans     the scans on the map ({ latitude, longitude }), so the zoom keeps them all in view
function IsabelaLayer({ selected = "", onSelect, scans = [] }) {
  // with a locked town, only that town exists on the map: nothing to hover, click or fly to
  const interactive = Boolean(onSelect) && !lockedTown;
  const town = lockedTown || isabelaTowns.find((t) => t.name === selected) || null;

  return (
    <>
      <LockToArea />
      {interactive && <FlyToTown town={town} scans={scans} />}

      <Pane name="town-mask" style={{ zIndex: 250 }}>
        {/* everything outside Isabela (or outside the locked town) is hidden completely */}
        <Polygon
          positions={[WORLD, ...(lockedTown ? lockedTown.rings : PROVINCE_RINGS)]}
          pathOptions={{ className: "province-mask", stroke: false, interactive: false }}
        />
        {/* with a town selected, the rest of Isabela is only faded so it stays as context */}
        {town && !lockedTown && (
          <Polygon
            positions={[WORLD, ...town.rings]}
            pathOptions={{ className: "town-mask", stroke: false, interactive: false }}
          />
        )}
      </Pane>

      {town ? (
        <>
          {town.rings.map((ring, index) => (
            <Polygon
              key={index}
              positions={ring}
              pathOptions={{ color: HIGHLIGHT, weight: 3, fill: false, interactive: false }}
            />
          ))}
        </>
      ) : (
        isabelaTowns.map((t) =>
          t.rings.map((ring, index) => (
            <Polygon
              key={t.name + index}
              positions={ring}
              pathOptions={{
                color: OUTLINE,
                weight: 1,
                fill: interactive,
                fillOpacity: 0,
                interactive,
              }}
              eventHandlers={
                interactive
                  ? {
                      mouseover: (e) => e.target.setStyle({ color: HIGHLIGHT, weight: 2, fillColor: HIGHLIGHT, fillOpacity: 0.12 }),
                      mouseout: (e) => e.target.setStyle({ color: OUTLINE, weight: 1, fillOpacity: 0 }),
                      click: () => onSelect(t.name),
                    }
                  : undefined
              }
            >
              {interactive && (
                <Tooltip sticky>{t.name}</Tooltip>
              )}
            </Polygon>
          ))
        )
      )}
    </>
  );
}

export default IsabelaLayer;
