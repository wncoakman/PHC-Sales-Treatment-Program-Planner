// Job logistics (backstage): geocode the work address, find the closest operations base by drive time,
// and band the business-hours drive time. Needs a connection; the app retries when back online.
//
// Map data: OpenStreetMap via Nominatim (geocoding) and the public OSRM router (drive times).
// OSRM times are free-flow, so they are scaled by the bases file's business-hours traffic factor.

export const BANDS = [
  { id: "under15", label: "15 minutes or less", max: 15 },
  { id: "15to30", label: "15–30 minutes", max: 30 },
  { id: "over30", label: "Over 30 minutes", max: Infinity },
];

export const bandFor = (minutes) => (minutes == null ? null : BANDS.find((b) => minutes <= b.max).id);

const STATES = { Virginia: "VA", Maryland: "MD", "District of Columbia": "DC" };

export async function geocode(address, fetchFn = fetch) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=us&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetchFn(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const [hit] = await res.json();
  if (!hit) return null;
  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    display: hit.display_name,
    jurisdiction: STATES[hit.address?.state] || null,
  };
}

/** Free-flow drive minutes from the job to each base, in base order (null where no route). */
export async function driveMinutes(job, bases, fetchFn = fetch) {
  const coords = [job, ...bases].map((p) => `${p.lon},${p.lat}`).join(";");
  const res = await fetchFn(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=duration`);
  if (!res.ok) throw new Error(`route ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error(`route ${data.code}`);
  return data.durations[0].slice(1).map((s) => (s == null ? null : s / 60));
}

/** Straight-line fallback: miles × road-winding factor at a typical suburban speed. */
function estimateMinutes(a, b) {
  const R = 3958.8, rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  const miles = 2 * R * Math.asin(Math.sqrt(h));
  return (miles * 1.3 / 30) * 60;
}

/**
 * Full assessment for a work address. config: { trafficFactor, bases: [{ id, name, address, lat, lon }] }.
 * Returns { address, lat, lon, display, jurisdiction, baseId, baseName, freeFlowMinutes, minutes, band, method, perBase, computedAt }.
 */
export async function assessAddress(address, config, fetchFn = fetch) {
  const place = await geocode(address, fetchFn);
  if (!place) return { address, error: "Address not found", computedAt: new Date().toISOString() };
  const bases = (config?.bases || []).filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lon));
  const out = { address, ...place, computedAt: new Date().toISOString() };
  if (!bases.length) return { ...out, error: "No operations bases configured" };

  let free, method = "osrm";
  try { free = await driveMinutes(place, bases, fetchFn); }
  catch { free = bases.map((b) => estimateMinutes(place, b)); method = "straight-line estimate"; }
  const factor = config.trafficFactor || 1;
  const perBase = bases.map((b, i) => ({ baseId: b.id, freeFlowMinutes: free[i], minutes: free[i] == null ? null : free[i] * factor }));
  const best = perBase.filter((p) => p.minutes != null).sort((a, b) => a.minutes - b.minutes)[0];
  if (!best) return { ...out, error: "No route to any base", perBase };
  const base = bases.find((b) => b.id === best.baseId);
  return {
    ...out,
    baseId: base.id,
    baseName: base.name,
    freeFlowMinutes: Math.round(best.freeFlowMinutes),
    minutes: Math.round(best.minutes),
    band: bandFor(best.minutes),
    method: `${method}${factor !== 1 ? ` × ${factor} business-hours traffic factor` : ""}`,
    perBase: perBase.map((p) => ({ ...p, freeFlowMinutes: p.freeFlowMinutes && Math.round(p.freeFlowMinutes), minutes: p.minutes && Math.round(p.minutes) })),
  };
}
