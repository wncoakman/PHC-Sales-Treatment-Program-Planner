// Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  averageReadings, parseCoords, toWorld, fromWorld, viewTiles, toScreen, fitView, metersPerPixel, scaleBar, TILE_URL,
} from "../web/geo.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test("GPS averaging: drops poor readings, weights the rest by 1/accuracy²", () => {
  assert.equal(averageReadings([]), null);
  // Best ±4 m → keep readings up to max(8, 9) = 9 m; the ±12 and ±40 m readings are dropped.
  const r = averageReadings([
    { lat: 39.0001, lng: -77.0001, acc: 4 }, { lat: 39.0003, lng: -77.0003, acc: 8 },
    { lat: 39.01, lng: -77.01, acc: 12 }, { lat: 39.05, lng: -77.05, acc: 40 },
  ]);
  assert.equal(r.n, 2); assert.equal(r.total, 4); assert.equal(r.best, 4);
  // Weights 1/16 and 1/64: the ±4 m reading counts four times as much.
  near(r.lat, (39.0001 * 4 + 39.0003) / 5); near(r.lng, (-77.0001 * 4 - 77.0003) / 5);
  near(r.acc, Math.sqrt(2 / (1 / 16 + 1 / 64)));
  // With a poor best reading the +5 m rule is looser than doubling: best 2 m keeps up to 7 m.
  assert.equal(averageReadings([{ lat: 1, lng: 1, acc: 2 }, { lat: 1, lng: 1, acc: 7 }, { lat: 1, lng: 1, acc: 7.5 }]).n, 2);
});

test("coordinate entry: decimal pairs, N/S/E/W letters before or after, longitude first", () => {
  assert.deepEqual(parseCoords("39.10790, -77.55640"), { lat: 39.1079, lng: -77.5564 });
  assert.deepEqual(parseCoords(" 39.1079 N, 77.5564 W "), { lat: 39.1079, lng: -77.5564 });
  assert.deepEqual(parseCoords("39.1079N 77.5564W"), { lat: 39.1079, lng: -77.5564 });
  assert.deepEqual(parseCoords("N39.1079 W77.5564"), { lat: 39.1079, lng: -77.5564 });
  assert.deepEqual(parseCoords("77.5564 W, 39.1079 N"), { lat: 39.1079, lng: -77.5564 });
  assert.deepEqual(parseCoords("33.9°S 151.2°E"), { lat: -33.9, lng: 151.2 });
  for (const bad of ["", "39.1", "1 2 3", "95, 10", "39 N, 77 N", "hello"]) assert.equal(parseCoords(bad), null, bad);
});

test("Web Mercator: world round trip, tiles cover the view, z19 tiles scaled beyond z19", () => {
  const w = toWorld(39.1079, -77.5564), back = fromWorld(w.x, w.y);
  near(back.lat, 39.1079, 1e-9); near(back.lng, -77.5564, 1e-9);
  const view = { cx: w.x, cy: w.y, zoom: 19, width: 800, height: 600 };
  const ts = viewTiles(view);
  assert.ok(ts.every((t) => t.z === 19 && t.size === 256));
  const covers = (x, y) => ts.some((t) => x >= t.left && x < t.left + t.size && y >= t.top && y < t.top + t.size);
  assert.ok(covers(0, 0) && covers(799, 599) && covers(400, 300));
  // The tile under the centre is the one holding the point.
  const mid = ts.find((t) => 400 >= t.left && 400 < t.left + 256 && 300 >= t.top && 300 < t.top + 256);
  assert.deepEqual([mid.x, mid.y], [Math.floor(w.x * 2 ** 19), Math.floor(w.y * 2 ** 19)]);
  assert.ok(viewTiles({ ...view, zoom: 21 }).every((t) => t.z === 19 && t.size === 1024));
  const s = toScreen(view, 39.1079, -77.5564);
  near(s.x, 400, 1e-6); near(s.y, 300, 1e-6);
  assert.equal(TILE_URL(19, 10, 20), "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/19/20/10");
});

test("report map zoom: highest zoom where every point fits; one point gets the cap", () => {
  const pts = [{ lat: 39.1079, lng: -77.5564 }, { lat: 39.1085, lng: -77.5552 }, { lat: 39.1074, lng: -77.5571 }];
  const v = fitView(pts, { width: 1200, height: 750 });
  const inside = (view) => pts.every((p) => { const s = toScreen(view, p.lat, p.lng); return s.x > 0 && s.x < 1200 && s.y > 0 && s.y < 750; });
  assert.ok(inside(v));
  // Zoom moves in half steps with 15% padding, so 1.5 steps closer always crops a point.
  assert.ok(!inside({ ...v, zoom: v.zoom + 1.5 }), "closer zoom should crop a point");
  assert.equal(fitView([pts[0]], { width: 1200, height: 750 }).zoom, 20);
  assert.equal(fitView([], { width: 10, height: 10 }), null);
});

test("scale bars: round lengths in meters and feet", () => {
  const mpp = metersPerPixel(39, 20); // ≈ 0.116 m per pixel
  near(mpp, 0.1161, 1e-3);
  assert.deepEqual(scaleBar(mpp, 240, "m"), { value: 25, unit: "m", px: 25 / mpp });
  assert.equal(scaleBar(mpp, 200, "m").value, 20);
  assert.equal(scaleBar(mpp, 240, "ft").value, 50);
});
