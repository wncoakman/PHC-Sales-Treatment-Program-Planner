// Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { assessAddress, bandFor } from "../web/logistics.js";

const config = {
  trafficFactor: 1.25,
  bases: [
    { id: "north", name: "North yard", address: "x", lat: 39.0, lon: -77.2 },
    { id: "south", name: "South yard", address: "y", lat: 38.7, lon: -77.3 },
  ],
};

// Fake map services: geocode to a fixed point; OSRM table returns 30 and 10 free-flow minutes.
const fakeFetch = (route = true) => async (url) => {
  if (url.includes("nominatim")) {
    return { ok: true, json: async () => [{ lat: "38.8", lon: "-77.25", display_name: "Job", address: { state: "Virginia" } }] };
  }
  if (!route) return { ok: false, status: 503 };
  return { ok: true, json: async () => ({ code: "Ok", durations: [[0, 30 * 60, 10 * 60]] }) };
};

test("bands", () => {
  assert.equal(bandFor(15), "under15");
  assert.equal(bandFor(15.5), "15to30");
  assert.equal(bandFor(30), "15to30");
  assert.equal(bandFor(31), "over30");
});

test("closest base by business-hours drive time", async () => {
  const r = await assessAddress("123 Main St", config, fakeFetch());
  assert.equal(r.baseId, "south");
  assert.equal(r.minutes, 13); // 10 free-flow × 1.25
  assert.equal(r.band, "under15");
  assert.equal(r.jurisdiction, "VA");
  assert.equal(r.perBase.length, 2);
});

test("falls back to a straight-line estimate when routing fails", async () => {
  const r = await assessAddress("123 Main St", config, fakeFetch(false));
  assert.ok(r.method.startsWith("straight-line") && r.baseId && r.band);
});

test("no bases configured", async () => {
  const r = await assessAddress("123 Main St", { bases: [] }, fakeFetch());
  assert.equal(r.error, "No operations bases configured");
  assert.equal(r.lat, 38.8);
});

test("geocode falls back to street, then ZIP", async () => {
  const { geocode } = await import("../web/logistics.js");
  const calls = [];
  const f = async (url) => {
    calls.push(url);
    const hit = url.includes("postalcode=20175") ? [{ lat: "39.1", lon: "-77.56", display_name: "20175", address: { state: "Virginia" } }] : [];
    return { ok: true, json: async () => hit };
  };
  const r = await geocode("10 Courthouse Square, Leesburg, VA 20175", f);
  assert.equal(r.precision, "zip");
  assert.equal(calls.length, 3);
  assert.ok(!decodeURIComponent(calls[1]).includes("10 Courthouse"));
});
