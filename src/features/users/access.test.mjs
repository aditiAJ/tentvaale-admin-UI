// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { changesFromDefault, differsFromDefault, requiresOf, sortUsers, tick, untick } from "./access.ts";

test("the Admin is listed first, then each job title in order, and people switched off last", () => {
  const user = (username, role, active = true) => ({ username, role, active });
  const sorted = sortUsers([
    user("warehouse", "WAREHOUSE"), user("old-admin", "ADMIN", false), user("accountant", "ACCOUNTS"),
    user("zed", "SALES"), user("operations", "OPERATIONS"), user("admin", "ADMIN"), user("amit", "SALES"),
  ]);
  assert.deepEqual(sorted.map((u) => u.username),
    ["admin", "amit", "zed", "operations", "accountant", "warehouse", "old-admin"]);
});

test("changes from the role default are counted both ways", () => {
  assert.deepEqual(changesFromDefault(new Set(["ORDER_VIEW", "STOCK_MOVE"]), ["ORDER_VIEW", "TRUCK_VIEW"]),
    { added: 1, removed: 1 });
});

const box = (permission, ...requires) => ({ permission, requires });
const requires = requiresOf([
  { boxes: [box("QUOTATION_VIEW"), box("QUOTATION_EDIT_DRAFT", "QUOTATION_VIEW"),
      box("QUOTATION_EDIT_SENT", "QUOTATION_VIEW", "QUOTATION_EDIT_DRAFT")] },
  { boxes: [box("ORDER_VIEW"), box("STOCK_MOVE", "ORDER_VIEW")] },
]);

test("ticking a box ticks everything it requires", () => {
  assert.deepEqual([...tick(new Set(), ["QUOTATION_EDIT_SENT"], requires)].sort(),
    ["QUOTATION_EDIT_DRAFT", "QUOTATION_EDIT_SENT", "QUOTATION_VIEW"]);
});

test("unticking a box unticks whatever cannot stay without it", () => {
  const all = new Set(["QUOTATION_VIEW", "QUOTATION_EDIT_DRAFT", "QUOTATION_EDIT_SENT", "ORDER_VIEW", "STOCK_MOVE"]);
  assert.deepEqual([...untick(all, ["QUOTATION_VIEW"], requires)].sort(), ["ORDER_VIEW", "STOCK_MOVE"]);
  assert.deepEqual([...untick(all, ["QUOTATION_EDIT_SENT"], requires)].sort(),
    ["ORDER_VIEW", "QUOTATION_EDIT_DRAFT", "QUOTATION_VIEW", "STOCK_MOVE"]);
});

test("only tick boxes decide whether someone was changed from their role's default", () => {
  const boxes = new Set(["ORDER_VIEW", "STOCK_MOVE"]);
  assert.equal(differsFromDefault(["MASTER_DATA_READ", "ORDER_VIEW"], ["ORDER_VIEW"], boxes), false);
  assert.equal(differsFromDefault(["ORDER_VIEW", "STOCK_MOVE"], ["ORDER_VIEW"], boxes), true);
});
