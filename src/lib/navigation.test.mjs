// Run with `npm test`. Node's own test runner, so no new dependency: it reads the TypeScript module directly.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { canGoBackInApp, isPlainClick, safeInternalPath } from "./navigation.ts";

test("paths on this site are kept as they are, query and hash included", () => {
  for (const path of ["/", "/orders", "/orders?status=open&id=42", "/catalog/sofa#reviews", "/plans/join?token=a%20b"]) {
    assert.equal(safeInternalPath(path), path);
  }
});

test("anything that could leave the site is refused", () => {
  const refused = [
    null,
    undefined,
    "",
    "orders",
    "https://evil.example",
    "javascript:alert(1)",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    " /orders",
    "/orders ",
    "\u0000/orders",
  ];
  for (const value of refused) assert.equal(safeInternalPath(value), null, JSON.stringify(value));
});

test("going back stays in the app only when the Navigation API shows one of our pages behind this one", () => {
  assert.equal(canGoBackInApp({ currentEntry: { index: 3 } }), true);
  assert.equal(canGoBackInApp({ currentEntry: { index: 1 } }), true);
  // First page of ours in this tab: a shared link, a new tab, or arriving from another site.
  assert.equal(canGoBackInApp({ currentEntry: { index: 0 } }), false);
  // A browser without the Navigation API: never guess, use the fallback link.
  assert.equal(canGoBackInApp(undefined), false);
  assert.equal(canGoBackInApp(null), false);
  assert.equal(canGoBackInApp({ currentEntry: null }), false);
  assert.equal(canGoBackInApp({}), false);
});

test("only a plain left click is taken over; the rest is left to the browser", () => {
  const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
  assert.equal(isPlainClick(plain), true);
  assert.equal(isPlainClick({ ...plain, button: 1 }), false, "middle click opens a new tab");
  assert.equal(isPlainClick({ ...plain, metaKey: true }), false);
  assert.equal(isPlainClick({ ...plain, ctrlKey: true }), false);
  assert.equal(isPlainClick({ ...plain, shiftKey: true }), false);
  assert.equal(isPlainClick({ ...plain, altKey: true }), false);
  assert.equal(isPlainClick({ ...plain, defaultPrevented: true }), false);
});

test("the Admin and Storefront copies are the same file", (t) => {
  const here = fileURLToPath(new URL("./navigation.ts", import.meta.url));
  const otherApp = here.includes("tentvaale-admin-UI") ? "tentvaale-storefront-UI" : "tentvaale-admin-UI";
  const other = fileURLToPath(new URL(`../../../${otherApp}/src/lib/navigation.ts`, import.meta.url));
  if (!existsSync(other)) {
    t.skip(`${otherApp} is not checked out next to this app`);
    return;
  }
  assert.equal(readFileSync(here, "utf8"), readFileSync(other, "utf8"));
});
