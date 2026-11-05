// Run with `npm test`. Node's own test runner reads the TypeScript module directly.
import assert from "node:assert/strict";
import { test } from "node:test";
import { VEHICLE_TYPES, makeAndModel, truckStatus, vehicleTypeLabel } from "./trucks.ts";

test("a truck's status: inactive wins, then the workshop, otherwise available", () => {
  assert.equal(truckStatus({ active: true }), "available");
  assert.equal(truckStatus({}), "available", "an old record with no flags is available");
  assert.equal(truckStatus({ active: true, inMaintenance: true }), "maintenance");
  assert.equal(truckStatus({ active: false, inMaintenance: true }), "inactive");
  assert.equal(truckStatus({ active: false }), "inactive");
});

test("vehicle types have names, and an unknown code is shown as it is", () => {
  assert.equal(vehicleTypeLabel("TRUCK_407"), "Medium truck (407)");
  assert.equal(vehicleTypeLabel("HOVERCRAFT"), "HOVERCRAFT");
  assert.equal(vehicleTypeLabel(null), null);
  assert.equal(new Set(VEHICLE_TYPES.map((t) => t.code)).size, VEHICLE_TYPES.length, "codes are unique");
});

test("make and model read as one name", () => {
  assert.equal(makeAndModel({ make: "Tata", model: "Ace" }), "Tata Ace");
  assert.equal(makeAndModel({ make: "Tata", model: null }), "Tata");
  assert.equal(makeAndModel({ make: " ", model: "Ace" }), "Ace");
  assert.equal(makeAndModel({}), null);
});
