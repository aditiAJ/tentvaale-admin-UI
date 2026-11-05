// Run with `npm test`. Node's own test runner reads the TypeScript module directly.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GSTIN_PATTERN,
  confirmedLabel,
  daysSince,
  parseStockTable,
  telUrl,
  whatsappUrl,
} from "./supplierUtils.ts";

test("a GSTIN is 15 characters in the official shape", () => {
  assert.equal(GSTIN_PATTERN.test("27AAAAA0000A1Z5"), true);
  assert.equal(GSTIN_PATTERN.test("27aaaaa0000a1z5"), false, "capitals only: the form upper-cases before testing");
  assert.equal(GSTIN_PATTERN.test("27AAAAA0000A1Z"), false);
  assert.equal(GSTIN_PATTERN.test("NOT-A-GSTIN"), false);
});

test("a phone number becomes a dial link and a WhatsApp link", () => {
  assert.equal(telUrl("+91 98200 11223"), "tel:+919820011223");
  assert.equal(telUrl(""), null);
  assert.equal(telUrl("call me"), null);
  assert.equal(whatsappUrl("+91 98200 11223"), "https://wa.me/919820011223");
  assert.equal(whatsappUrl("98200 11223"), "https://wa.me/919820011223", "a bare 10-digit number is Indian");
  assert.equal(whatsappUrl("098200 11223"), "https://wa.me/919820011223", "a leading 0 is dropped");
  assert.equal(whatsappUrl("022 4455"), null, "too short to be a mobile number");
  assert.equal(whatsappUrl(null), null);
});

test("how old a supplier's answer is", () => {
  const now = new Date("2026-11-04T12:00:00Z").getTime();
  const ago = (days) => new Date(now - days * 86_400_000).toISOString();
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince("garbage", now), null);
  assert.deepEqual(confirmedLabel(ago(0), now), { text: "Today", stale: false });
  assert.deepEqual(confirmedLabel(ago(1), now), { text: "Yesterday", stale: false });
  assert.deepEqual(confirmedLabel(ago(12), now), { text: "12 days ago", stale: false });
  assert.deepEqual(confirmedLabel(ago(30), now), { text: "30 days ago", stale: true });
  assert.deepEqual(confirmedLabel(ago(95), now), { text: "3 months ago", stale: true });
  assert.deepEqual(confirmedLabel(null, now), { text: "Not confirmed", stale: true });
});

test("rows pasted from Excel are read by their header, in any column order", () => {
  const rows = parseStockTable("Rate\tSKU\tQty\n₹1,250.50\tFUR-001\t20\n\n80\tFUR-002\t0\n");
  assert.deepEqual(
    rows.map((r) => [r.line, r.sku, r.quantity, r.rate, r.problem]),
    [
      [2, "FUR-001", 20, 1250.5, undefined],
      [4, "FUR-002", 0, 80, undefined],
    ],
  );
});

test("without a header the order is SKU, quantity, rate; a rate may be left empty", () => {
  const rows = parseStockTable("FUR-001,20,125\nFUR-002,5,\n");
  assert.deepEqual(
    rows.map((r) => [r.sku, r.quantity, r.rate]),
    [
      ["FUR-001", 20, 125],
      ["FUR-002", 5, null],
    ],
  );
});

test("semicolons and quoted cells are read too", () => {
  const rows = parseStockTable('sku;quantity;rate\n"FUR;001";3;10\n');
  assert.equal(rows[0].sku, "FUR;001");
  assert.equal(rows[0].quantity, 3);
});

test("a bad row says what is wrong with it and the rest are still read", () => {
  const rows = parseStockTable("SKU,Quantity,Rate\n,5,10\nFUR-001,abc,10\nFUR-002,5,12.345\nFUR-003,5,10\n");
  assert.deepEqual(
    rows.map((r) => r.problem),
    ["No SKU", "Quantity must be a whole number, 0 or more", "Rate must be an amount like 125 or 125.50", undefined],
  );
  assert.deepEqual(parseStockTable("   \n\n"), []);
});
