// Run: npm test
// startGpsCapture against a fake Geolocation API and a fake clock.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const { startGpsCapture } = await import("../web/gps.js");
const CODES = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };

/** A fake navigator.geolocation; push(acc) delivers a reading to the watcher. */
function fakeGeo({ current } = {}) {
  const geo = {
    watcher: null, cleared: 0, currentCalls: [],
    watchPosition(ok, err, opts) { geo.watcher = { ok, err, opts }; return 7; },
    clearWatch() { geo.cleared++; },
    getCurrentPosition(ok, err, opts) { geo.currentCalls.push(opts); current?.(ok, err); },
    push(acc, lat = 39, lng = -77) { geo.watcher.ok({ coords: { latitude: lat, longitude: lng, accuracy: acc } }); },
    fail(code) { geo.watcher.err({ code, ...CODES }); },
  };
  Object.defineProperty(globalThis, "navigator", { value: { geolocation: geo }, configurable: true });
  globalThis.isSecureContext = true;
  return geo;
}

test("collects for 15 s from the first fix, then averages", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const geo = fakeGeo(), progress = [];
    const cap = startGpsCapture({ onProgress: (p) => progress.push(p) });
    assert.deepEqual(geo.watcher.opts, { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
    mock.timers.tick(20000); // slow first fix is fine
    geo.push(10, 39.0002); geo.push(4, 39.0001);
    mock.timers.tick(14000);
    geo.push(30, 39.01); // dropped: worse than max(8, 9) m
    mock.timers.tick(1000);
    const r = await cap.done;
    assert.equal(r.n, 1); assert.equal(r.total, 3); assert.equal(r.weak, false); assert.equal(r.lat, 39.0001);
    assert.deepEqual(progress.map((p) => p.readings), [0, 1, 2, 3]);
    assert.equal(progress[2].best, 4);
    assert.equal(geo.cleared, 1);
  } finally { mock.timers.reset(); }
});

test("Stop & save ends early with what came in", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const geo = fakeGeo();
    const cap = startGpsCapture();
    geo.push(5); geo.push(6);
    cap.stop();
    const r = await cap.done;
    assert.equal(r.total, 2);
  } finally { mock.timers.reset(); }
});

test("no fix in 60 s: one low-accuracy retry, flagged weak", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const geo = fakeGeo({ current: (ok) => ok({ coords: { latitude: 39.5, longitude: -77.5, accuracy: 60 } }) });
    const cap = startGpsCapture();
    mock.timers.tick(60000);
    const r = await cap.done;
    assert.deepEqual(geo.currentCalls[0], { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 });
    assert.equal(r.weak, true); assert.equal(r.acc, 60);
  } finally { mock.timers.reset(); }
});

test("errors: permission denied, no signal after retry, insecure page", async () => {
  let geo = fakeGeo();
  let cap = startGpsCapture();
  geo.fail(CODES.PERMISSION_DENIED);
  await assert.rejects(cap.done, (e) => e.code === "denied" && /Settings/.test(e.message));
  assert.equal(geo.currentCalls.length, 0);

  geo = fakeGeo({ current: (ok, err) => err({ code: CODES.POSITION_UNAVAILABLE, ...CODES }) });
  cap = startGpsCapture();
  geo.fail(CODES.POSITION_UNAVAILABLE);
  await assert.rejects(cap.done, (e) => e.code === "unavailable");
  assert.equal(geo.currentCalls.length, 1);

  fakeGeo();
  globalThis.isSecureContext = false;
  await assert.rejects(startGpsCapture().done, (e) => e.code === "insecure" && /https/.test(e.message));
});
