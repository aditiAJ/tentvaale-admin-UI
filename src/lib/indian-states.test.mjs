// Run with `npm test`. Node's own test runner, so no new dependency: it reads the TypeScript module directly.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { INDIAN_STATES, isStateName, matchState } from "./indian-states.ts";

const NAMES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

test("the list is exactly the 28 states and 8 union territories", () => {
  assert.deepEqual(INDIAN_STATES.map((s) => s.name), NAMES);
  assert.equal(INDIAN_STATES.filter((s) => s.unionTerritory).length, 8);
  assert.equal(new Set(INDIAN_STATES.map((s) => s.gstCode)).size, 36);
  assert.equal(new Set(INDIAN_STATES.map((s) => s.abbreviation)).size, 36);
});

test("every entry finds itself by name, abbreviation and GST code", () => {
  for (const s of INDIAN_STATES) {
    assert.equal(matchState(s.name), s);
    assert.equal(matchState(s.abbreviation), s);
    assert.equal(matchState(s.gstCode), s);
    assert.equal(isStateName(s.name), true);
  }
});

test("case, spacing, ampersand, abbreviation, code and old-name variants find the current entry", () => {
  const name = (raw) => matchState(raw)?.name;
  assert.equal(name("  GUJARAT "), "Gujarat");
  assert.equal(name("gj"), "Gujarat");
  assert.equal(name("24"), "Gujarat");
  assert.equal(name("tamil    nadu"), "Tamil Nadu");
  assert.equal(name("Jammu & Kashmir"), "Jammu and Kashmir");
  assert.equal(name("Orissa"), "Odisha");
  assert.equal(name("Pondicherry"), "Puducherry");
  assert.equal(name("NCT of Delhi"), "Delhi");
  assert.equal(name("Daman & Diu"), "Dadra and Nagar Haveli and Daman and Diu");
  assert.equal(name("TS"), "Telangana");
});

test("look-alikes, unknown values and blanks are not matched, never guessed", () => {
  for (const raw of ["Gujrat", "Maharastra", "Tamilnadu", "Chattisgarh", "Bombay", "India", "28", "XX", "", "  ", null, undefined]) {
    assert.equal(matchState(raw), null, String(raw));
  }
  assert.equal(isStateName("gujarat"), false);
  assert.equal(isStateName("GJ"), false);
});

// Drift check: when the backend source is in the workspace, this list must be exactly its list.
const backend = fileURLToPath(
  new URL("../../../tentvaale-backend/app/src/main/java/com/tentvaale/shared/IndianState.java", import.meta.url),
);
test("matches the backend registry", { skip: !existsSync(backend) && "backend source not in this workspace" }, () => {
  const rows = [...readFileSync(backend, "utf8").matchAll(/^\s+[A-Z_]+\("([^"]+)", "([A-Z]{2})", "(\d{2})", (true|false)\)/gm)]
    .map(([, name, abbreviation, gstCode, ut]) => ({ name, abbreviation, gstCode, unionTerritory: ut === "true" }));
  assert.deepEqual(INDIAN_STATES.map((s) => ({ ...s })), rows);
});
