// Satellite site map for the report: stitches Esri World Imagery tiles at the highest zoom where every located
// item fits, then draws numbered pins with outlined labels (ID + species), m/ft scale bars, a north arrow and
// the attribution. Offline (or if any tile fails) it draws the same pins to scale on a plain background.

import { fitView, toScreen, metersPerPixel, scaleBar, fromWorld, ATTRIBUTION } from "./geo.js";
import { loadViewTiles, drawTiles, drawPin } from "./mapview.js";

/**
 * points: [{ n, lat, lng, label }]. Returns { dataUrl, width, height, imagery, note } or null for no points.
 * imagery is false when the diagram fallback was drawn.
 */
export async function drawSiteMap(points, { width = 1200, height = 750, timeoutMs = 12000 } = {}) {
  const view = fitView(points, { width, height, maxZoom: 20 });
  if (!view) return null;
  const imagery = navigator.onLine !== false && await loadViewTiles(view, timeoutMs);
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const g = canvas.getContext("2d");
  const mpp = metersPerPixel(fromWorld(view.cx, view.cy).lat, view.zoom);

  if (imagery) drawTiles(g, view);
  else {
    // Diagram: a plain background with a grid at the metric scale-bar spacing.
    g.fillStyle = "#f3f5f0"; g.fillRect(0, 0, width, height);
    const step = scaleBar(mpp, width / 8).px;
    g.strokeStyle = "#dde3d7"; g.lineWidth = 1;
    for (let x = (width / 2) % step; x < width; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, height); g.stroke(); }
    for (let y = (height / 2) % step; y < height; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(width, y); g.stroke(); }
  }
  for (const p of points) { const s = toScreen(view, p.lat, p.lng); drawPin(g, s.x, s.y, p.n, p.label, 1.5); }

  // Scale bars, metric over imperial, on a white plate (bottom left).
  const m = scaleBar(mpp, width / 5, "m"), ft = scaleBar(mpp, width / 5, "ft");
  const plateW = Math.max(m.px, ft.px) + 90;
  g.fillStyle = "rgba(255,255,255,.88)"; g.fillRect(14, height - 74, plateW, 60);
  g.fillStyle = "#1b1b1b"; g.font = "bold 15px Helvetica, Arial, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
  g.fillRect(26, height - 56, m.px, 5); g.fillText(`${m.value} m`, 34 + m.px, height - 53);
  g.fillRect(26, height - 32, ft.px, 5); g.fillText(`${ft.value} ft`, 34 + ft.px, height - 29);
  // North arrow (top right).
  g.fillStyle = "rgba(255,255,255,.88)"; g.fillRect(width - 58, 14, 44, 58);
  g.fillStyle = "#1b1b1b";
  g.beginPath(); g.moveTo(width - 36, 22); g.lineTo(width - 47, 46); g.lineTo(width - 25, 46); g.closePath(); g.fill();
  g.textAlign = "center"; g.fillText("N", width - 36, 60);
  // Attribution (bottom right), always shown.
  const credit = imagery ? ATTRIBUTION : "Diagram: relative positions (satellite imagery unavailable)";
  g.font = "12px Helvetica, Arial, sans-serif"; g.textAlign = "right";
  const cw = g.measureText(credit).width;
  g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(width - cw - 22, height - 24, cw + 12, 18);
  g.fillStyle = "#333"; g.fillText(credit, width - 16, height - 15);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.88), width, height, imagery,
    note: imagery ? ATTRIBUTION
      : "Satellite imagery could not load (offline or unavailable): pins are drawn to scale on a plain background. Export again with signal for the satellite map.",
  };
}
