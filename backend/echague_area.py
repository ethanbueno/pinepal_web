"""Is a point inside Echague? PinePal only covers Echague for now, so a pinned location
(a farm, or a scan saved on the web) must be inside the town's border.

echague_boundary.json is Echague's outline from src/data/isabela.js (GADM 4.1, simplified
to about 65 m), the same one the web maps draw, so the server and the maps agree.
"""
import json
import os

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "echague_boundary.json")) as f:
    _AREA = json.load(f)

_RINGS = _AREA["rings"]  # each ring is a list of [latitude, longitude]
(_SOUTH, _WEST), (_NORTH, _EAST) = _AREA["bounds"]

OUTSIDE_ECHAGUE = "The location must be inside Echague. Pin a spot within the Echague border."


def in_echague(latitude, longitude):
    """True when the point is inside Echague's border (ray casting over the outline)."""
    try:
        lat, lng = float(latitude), float(longitude)
    except (TypeError, ValueError):
        return False
    if not (_SOUTH <= lat <= _NORTH and _WEST <= lng <= _EAST):
        return False  # quick no: outside the box around the town
    inside = False
    for ring in _RINGS:
        j = len(ring) - 1
        for i in range(len(ring)):
            (lat_i, lng_i), (lat_j, lng_j) = ring[i], ring[j]
            if (lat_i > lat) != (lat_j > lat) and lng < (lng_j - lng_i) * (lat - lat_i) / (lat_j - lat_i) + lng_i:
                inside = not inside
            j = i
    return inside
