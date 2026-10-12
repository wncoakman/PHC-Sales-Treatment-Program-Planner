// Esri World Imagery tiles on a canvas: a loader shared with the report map, and the fine-tune map, where the
// user drags or pinches the imagery under a fixed centre crosshair (the pin itself never moves under a finger).
// Tiles are fetched straight from Esri with no key; they stay in memory only (the service worker skips them).

import { TILE_URL, MAX_VIEW_ZOOM, viewTiles, toWorld, fromWorld, toScreen, metersPerPixel } from "./geo.js";

const tiles = new Map(); // "z/x/y" -> { img, ok: true | false | undefined (loading), failedAt }
const RETRY_MS = 30000; // a failed tile (offline) is asked for again only after this

/**
 * A tile, loading it on first ask (or retrying a failure after RETRY_MS). onSettle(ok) runs when a pending
 * tile loads or fails; it is not called for a tile that has already settled (check .ok).
 */
export function tile(z, x, y, onSettle) {
  const key = `${z}/${x}/${y}`;
  let t = tiles.get(key);
  if (!t || (t.ok === false && Date.now() - t.failedAt > RETRY_MS)) {
    t = { img: new Image(), ok: undefined, waiters: [] };
    tiles.set(key, t);
    t.img.crossOrigin = "anonymous";
    const settle = (ok) => { t.ok = ok; if (!ok) t.failedAt = Date.now(); t.waiters.splice(0).forEach((f) => f(ok)); };
    t.img.onload = () => settle(true);
    t.img.onerror = () => settle(false);
    t.img.src = TILE_URL(z, x, y);
  }
  if (onSettle && t.ok === undefined) t.waiters.push(onSettle);
  return t;
}

/** Loads every tile of a view; resolves true when all arrived, false if any failed or timeoutMs passed. */
export function loadViewTiles(view, timeoutMs = 12000) {
  const list = viewTiles(view);
  return new Promise((resolve) => {
    let left = list.length, failed = false;
    const timer = setTimeout(() => resolve(false), timeoutMs);
    if (!left) { clearTimeout(timer); resolve(true); return; }
    const settled = (ok) => {
      failed ||= !ok;
      if (--left === 0) { clearTimeout(timer); resolve(!failed); }
    };
    for (const t of list) {
      const got = tile(t.z, t.x, t.y, settled);
      if (got.ok !== undefined) settled(got.ok);
    }
  });
}

/** Draws the loaded tiles of a view: { loaded, missing (still loading), failed }. */
export function drawTiles(g, view) {
  let loaded = 0, missing = 0, failed = 0;
  for (const t of viewTiles(view)) {
    const got = tiles.get(`${t.z}/${t.x}/${t.y}`);
    if (got?.ok) { g.drawImage(got.img, t.left, t.top, t.size + 0.5, t.size + 0.5); loaded++; } // +0.5 hides seams
    else if (got?.ok === false) failed++;
    else missing++;
  }
  return { loaded, missing, failed };
}

/** A numbered map pin with its label drawn beside it in outlined text. */
export function drawPin(g, x, y, n, label, scale = 1) {
  const r = 13 * scale;
  g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI);
  g.fillStyle = "#2f6b3a"; g.fill();
  g.lineWidth = 2.5 * scale; g.strokeStyle = "#fff"; g.stroke();
  g.fillStyle = "#fff"; g.font = `bold ${14 * scale}px Helvetica, Arial, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(String(n), x, y + 0.5 * scale);
  if (!label) return;
  g.font = `bold ${13 * scale}px Helvetica, Arial, sans-serif`; g.textAlign = "left";
  g.lineJoin = "round"; g.lineWidth = 4 * scale; g.strokeStyle = "rgba(0,0,0,.85)";
  g.strokeText(label, x + r + 4 * scale, y);
  g.fillStyle = "#fff"; g.fillText(label, x + r + 4 * scale, y);
}

/**
 * The fine-tune map on a canvas. start: { lat, lng }; gps: { lat, lng, acc } for the dashed accuracy ring;
 * pins: other trees [{ lat, lng, n, label }]. onTiles({ loaded, missing, failed }) reports imagery state after each draw.
 * Returns { center() → { lat, lng }, zoomBy(d), backToGps(), destroy() }.
 */
export function fineTuneMap(canvas, { start, zoom = 20, gps, pins = [], onTiles = () => {} }) {
  const g = canvas.getContext("2d");
  let { x: cx, y: cy } = toWorld(start.lat, start.lng);
  let frame = 0;
  const dpr = () => window.devicePixelRatio || 1;
  const view = () => ({ cx, cy, zoom, width: canvas.width / dpr(), height: canvas.height / dpr() });

  const draw = () => {
    frame = 0;
    const v = view();
    g.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    g.fillStyle = "#1f2a1f"; g.fillRect(0, 0, v.width, v.height);
    // Ask for every tile; redraw as each pending one arrives or fails.
    for (const t of viewTiles(v)) tile(t.z, t.x, t.y, schedule);
    const state = drawTiles(g, v);
    if (gps?.acc) {
      const p = toScreen(v, gps.lat, gps.lng), r = gps.acc / metersPerPixel(gps.lat, zoom);
      g.setLineDash([8, 6]); g.lineWidth = 2; g.strokeStyle = "#8ab4f8";
      g.beginPath(); g.arc(p.x, p.y, Math.max(r, 4), 0, 2 * Math.PI); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#8ab4f8"; g.beginPath(); g.arc(p.x, p.y, 4, 0, 2 * Math.PI); g.fill();
    }
    for (const p of pins) { const s = toScreen(v, p.lat, p.lng); drawPin(g, s.x, s.y, p.n, p.label); }
    onTiles(state);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr()); canvas.height = Math.round(r.height * dpr());
    schedule();
  };

  // Gestures: one finger drags the map; two fingers pinch-zoom about the crosshair.
  const pointers = new Map();
  let pinch = null;
  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const down = (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) pinch = { d: spread(), zoom };
  };
  const move = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 1) {
      const world = 256 * 2 ** zoom;
      cx -= (e.clientX - p.x) / world; cy -= (e.clientY - p.y) / world;
      cy = Math.max(0, Math.min(1, cy));
    }
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2 && pinch) setZoom(pinch.zoom + Math.log2(spread() / pinch.d));
    schedule();
  };
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
  const wheel = (e) => { e.preventDefault(); setZoom(zoom - e.deltaY / 300); };
  const setZoom = (z) => { zoom = Math.max(15, Math.min(MAX_VIEW_ZOOM, z)); schedule(); };

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  addEventListener("resize", resize);
  resize();

  return {
    center: () => fromWorld(cx, cy),
    zoomBy: (d) => setZoom(Math.round(zoom + d)),
    backToGps: () => { if (gps) ({ x: cx, y: cy } = toWorld(gps.lat, gps.lng)); schedule(); },
    destroy: () => {
      removeEventListener("resize", resize);
      if (frame) cancelAnimationFrame(frame);
    },
  };
}
