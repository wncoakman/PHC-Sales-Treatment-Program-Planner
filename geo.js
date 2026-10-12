// Position math for GPS capture, the map screens and the report: reading averaging, coordinate parsing,
// Web Mercator tiles, zoom fitting, scale bars and coordinate exports. Pure (no page code), so tests run it.

const R = 6378137; // Web Mercator sphere radius, meters
export const TILE = 256;
export const MAX_TILE_ZOOM = 19; // Esri World Imagery is sharp to z19; deeper views scale z19 tiles
export const MAX_VIEW_ZOOM = 21;
export const TILE_URL = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
export const ATTRIBUTION = "Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
export const WEAK_ACCURACY = 25; // meters: warn when a position is worse than this

/**
 * Averages GPS readings [{ lat, lng, acc }]: drops readings worse than max(2 × best, best + 5 m), then weights
 * the rest by 1/accuracy². acc of the result is the kept readings' RMS accuracy. null for no readings.
 */
export function averageReadings(readings) {
  const rs = readings.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.acc > 0);
  if (!rs.length) return null;
  const best = Math.min(...rs.map((r) => r.acc));
  const limit = Math.max(2 * best, best + 5);
  const kept = rs.filter((r) => r.acc <= limit);
  let sw = 0, lat = 0, lng = 0;
  for (const r of kept) {
    const w = 1 / (r.acc * r.acc);
    sw += w; lat += w * r.lat; lng += w * r.lng;
  }
  return { lat: lat / sw, lng: lng / sw, acc: Math.sqrt(kept.length / sw), best, n: kept.length, total: rs.length };
}

/**
 * Reads typed or pasted coordinates: "39.1079, -77.5564", "39.1079 N 77.5564 W", "N39.1079 W77.5564", or
 * longitude first when its E/W letter says so. Returns { lat, lng } or null when it isn't a valid pair.
 */
export function parseCoords(text) {
  const s = String(text || "").toUpperCase().replace(/[°º]/g, " ").trim();
  // Letters go either before every number ("N39 W77") or after; reading one style stops a trailing letter
  // from being taken as the next number's prefix.
  const before = /^[NSEW]\s*[-+]?\d/.test(s);
  const re = before ? /([NSEW])\s*([-+]?\d+(?:\.\d+)?)/g : /([-+]?\d+(?:\.\d+)?)\s*([NSEW])?/g;
  const parts = [...s.matchAll(re)].map((m) => (before ? { h: m[1], v: Number(m[2]) } : { h: m[2], v: Number(m[1]) }));
  if (parts.length !== 2) return null;
  const signed = ({ h, v }) => (h === "S" || h === "W" ? -Math.abs(v) : v);
  let [a, b] = parts;
  if ((a.h === "E" || a.h === "W") && (!b.h || b.h === "N" || b.h === "S")) [a, b] = [b, a];
  if ((a.h === "E" || a.h === "W") || (b.h === "N" || b.h === "S")) return null;
  const lat = signed(a), lng = signed(b);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
  return { lat, lng };
}

/** Web Mercator world position, 0–1 on each axis (x east, y south). */
export function toWorld(lat, lng) {
  const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return { x: (lng + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) };
}

export function fromWorld(x, y) {
  return { lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI, lng: x * 360 - 180 };
}

/** Ground meters per screen pixel at a (fractional) view zoom. */
export const metersPerPixel = (lat, zoom) => (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * R) / (TILE * 2 ** zoom);

/**
 * The tiles covering a W×H view centred on world point (cx, cy) at a fractional view zoom: tile zoom is the
 * view zoom rounded and capped at 19, each tile scaled to fit. [{ z, x, y, left, top, size }] in screen pixels.
 */
export function viewTiles({ cx, cy, zoom, width, height }) {
  const z = Math.max(0, Math.min(MAX_TILE_ZOOM, Math.round(zoom)));
  const n = 2 ** z, size = TILE * 2 ** (zoom - z), world = TILE * 2 ** zoom;
  const left0 = cx * world - width / 2, top0 = cy * world - height / 2;
  const out = [];
  for (let ty = Math.floor(top0 / size); ty * size < top0 + height; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(left0 / size); tx * size < left0 + width; tx++) {
      out.push({ z, x: ((tx % n) + n) % n, y: ty, left: tx * size - left0, top: ty * size - top0, size });
    }
  }
  return out;
}

/** Screen position of a lat/lng in a view (same arguments as viewTiles). */
export function toScreen(view, lat, lng) {
  const w = toWorld(lat, lng), world = TILE * 2 ** view.zoom;
  return { x: (w.x - view.cx) * world + view.width / 2, y: (w.y - view.cy) * world + view.height / 2 };
}

/**
 * The view that fits every point in W×H with padding: centred on their bounds at the highest half-step zoom
 * where all fit, up to maxZoom (single points and tight groups get maxZoom). null for no points.
 */
export function fitView(points, { width, height, pad = 0.15, maxZoom = 20, minZoom = 3 }) {
  if (!points.length) return null;
  const ws = points.map((p) => toWorld(p.lat, p.lng));
  const xs = ws.map((w) => w.x), ys = ws.map((w) => w.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const fit = Math.log2(Math.min((width * (1 - 2 * pad)) / ((x1 - x0) * TILE || 1e-12), (height * (1 - 2 * pad)) / ((y1 - y0) * TILE || 1e-12)));
  const zoom = Math.max(minZoom, Math.min(maxZoom, Math.floor(fit * 2) / 2));
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, zoom, width, height };
}

/** A round scale-bar length in meters or feet, and its pixel length, no wider than maxPx. */
export function scaleBar(metersPerPx, maxPx, unit = "m") {
  const perPx = unit === "ft" ? metersPerPx * 3.28084 : metersPerPx;
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const value = steps.filter((v) => v / perPx <= maxPx).pop() || 1;
  return { value, unit, px: value / perPx };
}

const csvCell = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));

/**
 * Coordinates for the zip export. items: [{ id, n, species, location, qty, dbh, crownLoss, problems, gps }].
 * GeoJSON holds the located items; the CSV lists every item, with blank coordinates where none was recorded.
 */
export function coordinateExports(items) {
  const geojson = {
    type: "FeatureCollection",
    features: items.filter((it) => it.gps).map((it) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [it.gps.lng, it.gps.lat] },
      properties: {
        id: it.id, number: it.n, species: it.species, location: it.location || "", qty: it.qty,
        dbh_in: it.dbh || null, crown_loss_pct: it.crownLoss || null, problems: it.problems,
        accuracy_m: it.gps.acc ?? null, source: it.gps.source || "gps", recorded: it.gps.at || null,
      },
    })),
  };
  const head = ["id", "number", "species", "location", "latitude", "longitude", "accuracy_m", "source", "qty", "dbh_in", "crown_loss_pct", "problems"];
  const rows = items.map((it) => [it.id, it.n, it.species, it.location, it.gps?.lat ?? "", it.gps?.lng ?? "", it.gps?.acc ?? "",
    it.gps ? it.gps.source || "gps" : "", it.qty, it.dbh, it.crownLoss, it.problems]);
  return { geojson: JSON.stringify(geojson, null, 2), csv: [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n" };
}
