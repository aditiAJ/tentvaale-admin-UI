// Run with `npm test`. Node's own test runner, so no new dependency: it reads the TypeScript module directly.
import assert from "node:assert/strict";
import { test } from "node:test";
import { choosableVariants, isPlainDefault } from "./variants.ts";

const variant = (id, name, extra = {}) => ({ id, name, stock: 0, active: true, ...extra });
const standard = (stock = 0) => variant("1", "Standard", { isDefault: true, hasAttributes: false, stock });
const real = (id, name, extra = {}) => variant(id, name, { hasAttributes: true, ...extra });
const product = (...variants) => ({ variants });
const names = (list) => list.map((v) => v.name);

test("the plain default is the product itself; a variant someone added never is", () => {
  assert.equal(isPlainDefault(standard()), true);
  assert.equal(isPlainDefault(real("2", "Dark Glass")), false);
  // A real variant that was once handed the default (before migration V324) is still a real variant.
  assert.equal(isPlainDefault(real("2", "Dark Glass", { isDefault: true })), false);
});

test("a plain product offers its one variant", () => {
  assert.deepEqual(names(choosableVariants(product(standard()))), ["Standard"]);
});

test("beside real variants, a Standard with no stock is not a choice", () => {
  assert.deepEqual(names(choosableVariants(product(standard(0), real("2", "Dark Glass"), real("3", "Amber Glass")))), [
    "Dark Glass",
    "Amber Glass",
  ]);
});

test("beside real variants, a Standard with stock of its own is a choice", () => {
  assert.deepEqual(names(choosableVariants(product(standard(8), real("2", "Walnut")))), ["Standard", "Walnut"]);
});

test("switched-off variants are left out, unless the line already names one", () => {
  const sofa = product(standard(), real("2", "Velvet"), real("3", "Linen", { active: false }));
  assert.deepEqual(names(choosableVariants(sofa)), ["Velvet"]);
  assert.deepEqual(names(choosableVariants(sofa, "3")), ["Velvet", "Linen"]);
  // A line saved on the plain default keeps showing it.
  assert.deepEqual(names(choosableVariants(sofa, "1")), ["Standard", "Velvet"]);
});
