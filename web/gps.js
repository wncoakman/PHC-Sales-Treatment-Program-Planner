// Averaged GPS capture with the browser Geolocation API. Works offline: GPS needs no data connection.
// Call startGpsCapture directly inside the button tap so iOS shows its permission prompt.

import { averageReadings } from "./geo.js";

const SAMPLE_MS = 15000; // collect for this long after the first fix
const FIRST_FIX_MS = 60000; // offline cold starts can take a while

/** Why a capture failed, in words for the field. */
export const GPS_ERRORS = {
  insecure: "Location needs a secure (https) page. Open the app from its published address.",
  unsupported: "This device or browser has no location service.",
  denied: "Location permission is off. On iPhone: Settings › Privacy & Security › Location Services › Safari Websites (or PHC Planner) › While Using the App, then try again.",
  unavailable: "No GPS signal. Move into the open, away from buildings and heavy canopy, and try again.",
  timeout: "No GPS fix after 60 seconds. Move into the open and try again, or enter coordinates manually.",
  stopped: "Stopped before any reading came in.",
};

/**
 * Starts a capture. onProgress({ readings, best }) fires on each reading (readings 0 while waiting for the
 * first fix). Returns { done, stop }: done resolves to { lat, lng, acc, best, n, total, weak } or rejects with
 * an Error whose code is a GPS_ERRORS key; stop() ends sampling early and saves what has come in.
 */
export function startGpsCapture({ onProgress = () => {} } = {}) {
  let finish, fail;
  const done = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
  const error = (code) => Object.assign(new Error(GPS_ERRORS[code]), { code });
  if (!globalThis.isSecureContext) { fail(error("insecure")); return { done, stop() {} }; }
  if (!navigator.geolocation) { fail(error("unsupported")); return { done, stop() {} }; }

  const readings = [];
  let watchId = null, sampleTimer = null, settled = false, fallingBack = false;
  const cleanup = () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    clearTimeout(sampleTimer); clearTimeout(firstFixTimer);
    watchId = null;
  };
  const settle = () => {
    if (settled) return;
    settled = true;
    cleanup();
    const avg = averageReadings(readings);
    if (avg) finish({ ...avg, weak: false }); else fail(error("stopped"));
  };
  // High accuracy gave nothing: one low-accuracy try (accepts a cached position up to a minute old).
  const fallback = (code) => {
    if (settled || fallingBack) return;
    fallingBack = true;
    cleanup();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        finish({ lat, lng, acc, best: acc, n: 1, total: 1, weak: true });
      },
      (err) => {
        if (settled) return;
        settled = true;
        fail(error(err.code === err.PERMISSION_DENIED ? "denied" : code));
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 },
    );
  };

  const firstFixTimer = setTimeout(() => { if (!readings.length) fallback("timeout"); }, FIRST_FIX_MS);
  onProgress({ readings: 0, best: null });
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (settled || fallingBack) return;
      const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
      readings.push({ lat, lng, acc });
      if (readings.length === 1) sampleTimer = setTimeout(settle, SAMPLE_MS);
      onProgress({ readings: readings.length, best: Math.min(...readings.map((r) => r.acc)) });
    },
    (err) => {
      if (settled || fallingBack) return;
      if (err.code === err.PERMISSION_DENIED) { settled = true; cleanup(); fail(error("denied")); return; }
      if (!readings.length) fallback(err.code === err.TIMEOUT ? "timeout" : "unavailable");
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: FIRST_FIX_MS },
  );
  return {
    done,
    stop() {
      if (settled || fallingBack) return;
      if (readings.length) settle(); else { settled = true; cleanup(); fail(error("stopped")); }
    },
  };
}
