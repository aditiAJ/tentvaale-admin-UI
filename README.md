# Tentvaale Admin UI

Back office for the Tentvaale event rental business. Consumes the `/api/admin/*`
surface of the Spring Boot backend in [`../tentvaale-backend`](../tentvaale-backend).

Sibling to [`../tentvaale-storefront-UI`](../tentvaale-storefront-UI), and
deliberately built on the same stack and the same feature-sliced layout so the
two stay navigable by the same people. It does **not** share the storefront's
visual theme — see [Design](#design).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4, with a hand-rolled primitive set in `components/ui`
- TanStack Query for server state
- react-hook-form + zod for forms

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then <http://localhost:3000>. **No backend is required** — the app ships in mock
mode and runs entirely on seeded data held in your browser. Sign in with any of
the demo accounts listed on the login screen (password `tentvaale`); each role
sees a different back office, which is the quickest way to see the permission
model working.

`npm run typecheck` and `npm run lint` both run clean; `npm run build` is the
one that catches everything, since it runs TypeScript and the React Compiler
lint rules together.

### Heads-up on port 8080

On at least one dev machine here, `:8080` is already taken by EnterpriseDB's
bundled Apache, which answers every `/api/admin/*` path with a 404 that looks
exactly like a backend bug. Check with `curl -s http://localhost:8080/` — if you
get an EnterpriseDB page rather than a connection refused, start the backend on
another port and point `API_ORIGIN` at it.

## Mock mode

`NEXT_PUBLIC_DATA_SOURCE` decides where data comes from: `mock` (the default)
or `api`. Nothing else in the app changes between them.

The seam is one line at the top of each feature's `api/` function:

```ts
export function listProducts(signal?: AbortSignal): Promise<ProductView[]> {
  if (IS_MOCK) return mockListProducts();
  return apiFetch<ProductView[]>("/admin/master-data/products", { signal });
}
```

So the real API layer is still here, still typed against the Spring endpoints,
and switching to it is an env var plus a restart — not a rewrite. Components,
hooks, query keys and types are shared by both paths and never branch.

**The mock reproduces rules, not just shapes.** `src/mock-data/store.ts` stands
in for the backend and enforces what the backend enforces: duplicate SKUs are
refused, the last active ADMIN cannot be demoted or deactivated, you cannot
change your own role or deactivate yourself, deposits only move where
`DepositStatus.allowedNext()` allows, and the product list returns active
products only. Failures are thrown as the same `ApiError` with the same status
codes, so the UI's error handling is exercised rather than bypassed — a
duplicate SKU really does surface a 422 with the backend's own wording.

It is faithful where being faithful is uncomfortable, too: `confirmRefunded`
does **not** check the amount against what is held, because the real
`recordRefund` does not either. Hiding that in the mock would hide a genuine
gap.

Auth is mocked at the token, not around it. `mintMockToken` issues a real-shaped
JWT carrying the same claims (`cid`, `role`, `auth[]`) with an unverified
signature, so storage, cross-tab sign-out, expiry and permission gating all run
the real code path. That works precisely because nothing in this app ever
verified a signature — the backend is what authorises.

State lives in `localStorage`, so edits survive a reload. The topbar carries a
**Demo data** badge and a reset control that restores the seed.

### Switching to the real backend

1. Set `NEXT_PUBLIC_DATA_SOURCE=api` and `API_ORIGIN` to wherever Spring is
   listening.
2. Restart the dev server.
3. Create the first admin by hand — see the backend README's "Creating the first
   administrator".

Only the screens in the table below will work; the rest of the menu is waiting
on endpoints either way.

## How it talks to the backend

Every browser request is same-origin against this app's own `/api/*`, which
`next.config.ts` rewrites server-side to `API_ORIGIN`.

That is not incidental. `SecurityConfig` on the backend calls
`.cors(Customizer.withDefaults())` but publishes no `CorsConfigurationSource`
bean, so it sends no `Access-Control-Allow-Origin` header and a browser on
`:3000` cannot call `:8080` directly. Proxying server-side sidesteps CORS
entirely rather than requiring a backend change, and it keeps the API origin out
of the client bundle. If CORS is configured on the backend later, this can be
swapped for direct calls by changing `services/env.ts` and deleting the rewrite.

**The response contract is not the storefront's.** The legacy .NET admin wrapped
everything in `ApiResponse<T>`/`SaveResult`, and the storefront's `api-client`
still unwraps that. Spring returns domain payloads bare — success is the HTTP
status, the body *is* the data — with errors shaped by `GlobalExceptionHandler`
as `{ timestamp, status, error, detail }`. A 422 is a
`BusinessRuleViolationException` whose `detail` is written for the user, so it is
shown verbatim; 401 and 403 come back with empty bodies and get generic copy.

Note that a failed login is a **422**, not a 401 — `loginAdmin` throws a business
rule violation for bad credentials.

## Auth

`POST /api/admin/auth/login` returns only `{ accessToken }`. There is no user
object and no company selector: the company is bound to the account server-side
and rides along as the `cid` claim. Everything the UI knows about the current
user is decoded from the token in `services/jwt.ts`.

The token is read with `useSyncExternalStore` over `localStorage`
(`services/auth-token.ts`), which makes sign-out propagate across tabs.

Authorisation is by **permission**, never by role — the same rule the backend
follows for `@PreAuthorize`. The token's `auth` claim carries the resolved
permission set, so the role→permission mapping is deliberately not duplicated
here. Gating is presentation only: the sidebar hides what you cannot open and
`RequirePermission` explains a deep link you cannot use, but the backend
re-checks every request.

## Structure

```
src/
  app/                  route segments. (admin) is the guarded group; pages are
                        thin and delegate to the matching feature.
  components/ui/        primitives (button, input, table, dialog, field, …)
  components/           providers, page-header, require-permission
  layouts/              AdminShell, Sidebar, Topbar, navigation.ts
  features/<name>/      one folder per domain — auth, master-data, users
    types.ts            the domain types this feature owns
    api/                typed fetch wrappers + query keys
    components/         feature-specific UI
    index.ts            the feature's public surface — import from here
  services/             cross-cutting: api-client, auth-token, jwt, permissions
  lib/                  cn(), money and date formatting
```

## Design

The storefront's dark-luxury gold theme is wrong for this application. A back
office is a dense, high-contrast reading surface someone stares at for a whole
shift, so the admin has its own palette: neutral slate ground, one restrained
amber accent that nods to the brand without the glow, and tabular figures
wherever money or counts are columnised. Light is the default; dark is a
complete companion palette, not an afterthought.

## What is actually wired

The backend's admin surface is an early skeleton, so most of the back office
described in `../Contexts/Tentvaale-Admin_Codebase_Documentation.md.txt` has no
endpoint to talk to yet. The sidebar shows the **whole** information
architecture anyway, with unavailable modules rendered as disabled rows carrying
the reason — see `layouts/navigation.ts`. That is deliberate: the shape of the
finished system stays visible, and the gap between it and today stays impossible
to mistake for a bug.

Every module in the sidebar now has a screen, but they are not all backed
equally. Three tiers:

| Screen | Endpoints | State |
|---|---|---|
| Login | `POST /admin/auth/login` | Working |
| Dashboard | `GET /admin/reporting/dashboard` | Working |
| Products | `GET`/`POST /admin/master-data/products` | List and create work; edit, variants and media are **mock only** |
| Deposits | `GET /admin/deposits/by-order/{id}` + request-refund / confirm-refunded / forfeit | Working |
| Notifications | `GET /admin/notifications/log`, `…/log/by-subject` | Working |
| Users | `GET`/`POST /admin/users`, `…/role`, `…/deactivate`, `…/reset-password` | Working |
| Quotations | `GET`/`POST /admin/quotations` | Create works; edit is **mock only**; reading is lookup-only — no list endpoint |
| Orders | `GET /admin/orders/{id}`, `POST /admin/orders/from-quotation` | Convert works; cancel, complete and by-customer listing are **mock only**; reading is lookup-only |
| Stock movement | `GET /admin/inventory/stock-movements/by-order/{id}`, `POST /admin/inventory/stock-movements` | Recording works; the order-flow rules and stock effects are **mock only**; reading is per-order only |
| Credit notes | `GET /admin/credit-notes/by-customer/{id}`, `…/balance`, `POST /admin/credit-notes` | Per-customer only; apply, cancel and reverse are **mock only** |
| Categories | none | **Mock only** — add, edit and deactivate, with sub-categories; md_category exists, no controller |
| Customers | none | **Mock only** — add and edit, invented; StorefrontAccount exists, no admin endpoint |
| Bundles | none | **Mock only** — full CRUD, all of it invented; no entity or table |
| Featured collections | none | **Mock only** — add, edit, activate and deactivate; no entity or table |
| Warehouses | none | **Mock only** — full CRUD plus per-warehouse stock, all of it invented; no entity or table |
| Trucks | none | **Mock only** — full CRUD, all of it invented; no entity or table |
| Availability | none | **Mock only** — derived, and the real derivation is unread |

The middle tier works against the real backend: those four modules expose a
record by id but have no query that lists them, so each screen looks one up
the way Deposits already did rather than pretending to browse.

The bottom tier has nothing to call at all, and renders seeded mock data.

**None of this is said on screen.** The screens carried explanatory notes until
they were removed by request, so this table is now the only record of which of
them are real. Nothing in the running app distinguishes a figure the backend
produced from one the mock invented, and nothing tells a user that editing a
product, cancelling an order or applying credit works only in mock mode, that a
quotation's status never moves except to converted, or that the availability
numbers are this UI's own calculation. Keep this table current: it
is load-bearing in a way a README does not normally have to be.

### Known gaps

These are backend limits. They used to be surfaced in the UI; they are now
recorded only here, so someone using the app will meet each of them as a
surprise rather than as an explanation:

- **Products are list-and-create only on the backend.** `listActiveProducts`
  returns active products, and there is no update, deactivate or get-by-id
  endpoint exposed. The back office edits products anyway — name, rates,
  category, media, variants and warehouse stock — but every one of those writes
  is mock-only and 404s in api mode. There is still no way to retire a product.
- **Categories have no endpoint.** `md_category` exists and `ProductView`
  resolves a `categoryName`, but nothing lists, creates or edits categories, so
  the Categories screen and the product form's category and sub-category
  pickers are mock-only. `category_id` is also not a foreign key by design (the
  legacy data has orphans), so a product with an unresolvable category renders
  as "Uncategorised" rather than as an error.
- **The master-data CRUD is a proposal, not a mirror.** Categories can be added,
  edited and deactivated; bundles, warehouses and trucks added, edited and
  removed; customers and featured collections added and edited, and collections
  switched on and off; product variants added, edited and removed; stock added
  to a warehouse. Every one of those calls points at a path no controller
  serves — they work in mock mode and 404 in api mode. The rules they enforce
  were invented here rather than copied from anywhere: names unique per company
  (case-insensitive), a warehouse refusing to be deleted while a stock movement
  refers to it, a category deactivating rather than being deleted because
  products point at it, no delete at all for a customer, whose account is what
  quotations and orders were raised against, and for variants — Has variants
  cannot be switched off while a product has variants, or on while any of it is
  held or out on rent without one, and a variant cannot be deleted while any of
  it is in a warehouse or on rent. `mock-data/store.ts` states each one and why.
  When the backend defines these modules it may decide differently, and the
  point of writing them down is that the disagreement is visible.
- **Product editing is mock-only by request.** The real controller exposes `GET`
  and `POST` and nothing else. Editing was added anyway, as a PUT following the
  other master-data writes, so it is exactly the thing this arrangement warns
  about: a demo that does something the real app cannot yet.
- **Users cannot be reactivated.** Deactivation is one-way from here.
- **The dashboard is six scalars.** Reporting owns no tables and assembles them
  from other modules' APIs. The counts cover four of the six quotation statuses
  — rejected and expired are not returned — so a true win rate cannot be shown,
  and order value is a lifetime total with no period to compare against. It
  counts every order, cancelled ones included, and says nothing about dispatch,
  return or completion.
- **Deposits are per-order only.** There is no list, so the back office cannot
  answer "which deposits are waiting to be refunded?"; you look one up by order
  id, or open it from its order. Note also that `recordRefund`/`recordForfeit`
  do **not** check the amount against what is held, so the settle dialog warns
  when you exceed it — that warning is the only guard there is. What happens to
  the rest of a deposit that is only partly forfeited is not defined. In mock
  mode a HELD deposit is opened when an order is converted; whether the real
  conversion does the same has not been checked.
- **No quotation or order list endpoints.** Both screens therefore look a
  record up by id rather than browsing, the same shape Deposits settled on.
  This is still the main thing blocking the back office: the counts on the
  dashboard are the only company-wide view of either. It bites hardest now that
  quotations can be raised here — a quotation is reachable straight after
  creation, because the response carries its id, and effectively unreachable
  the next morning unless someone kept the id. The credit-notes screen lists one
  customer's orders through a proposed `by-customer` path that is mock-only.
- **A quotation's customer comes from a mock-only list.** A quotation references
  an existing customer by id, chosen from the Customers list, and copies the
  name and email from that record. But nothing lists storefront accounts on the
  real backend, so in api mode the picker has nothing to offer.
- **Quotation status barely moves.** The enum has no state machine in code — the
  transition rules live in stored procedures that have not been read. A
  quotation has exactly one transition, DRAFT/SENT/ACCEPTED → CONVERTED, and
  only as a side effect of creating an order from it. There is no way to mark a
  quotation sent, accepted, rejected or expired from the back office, so those
  statuses are only ever reached by seeded data. Until it is converted, a
  quotation can be edited in mock mode.
- **Order status follows the flow in mock mode only.** The real `OrderStatus`
  has no state machine either, so against the backend an order still sits at
  CONFIRMED however far it gets, and cancel and complete 404. In mock mode an
  outward movement makes it DISPATCHED, the inward movement that brings the
  last of it back makes it RETURNED, completing needs RETURNED and a refunded or
  forfeited deposit, and only a CONFIRMED order can be cancelled — which moves a
  HELD deposit to REFUND_PENDING and no stock. Nothing sets a status directly.
- **Conversion cannot be undone.** `createOrderFromQuotation` creates the order
  and marks the quotation converted in one transaction, and nothing reverses
  the quotation half — cancelling the order does not reopen it. The
  confirmation dialog on the quotation screen is the only thing between a
  misclick and a converted quotation, which is why it is a dialog rather than a
  button that just fires.
- **Stock movements cannot be browsed**, only read per order. A movement also
  carries no sub-event id, so a multi-event order cannot attribute stock.
- **Movement validation is the mock's, not the backend's.** The real
  `recordMovement` checks three things: at least one line, an order that exists
  in this company, and each quantity at least 1 — its own TODO says the rest is
  in unread stored procedures. In mock mode a movement must also name a
  warehouse; its lines must be products on the order, with the variant named for
  a product that has variants; an outward one may not send more than was
  ordered or more than that warehouse holds; an inward one may only bring back
  what is still out from that same warehouse. A refused movement changes
  nothing. Outward takes stock off the shelf, inward puts it back. None of this
  applies against the real backend. Adjustment, write-off, transfers between
  warehouses, reservation and reversing a movement do not exist, and there is no
  way to close an order whose goods never all come back — it stays DISPATCHED.
- **Availability is this UI's own calculation.** The real derivation is unread.
  In mock mode "in stock" is the warehouse shelf counts and "on rent" is outward
  minus inward; since a return can never exceed what went out, on rent cannot go
  negative. Nothing is reserved for confirmed orders, dates are not considered,
  and inactive products are left out even when some of one is on rent.
- **Credit notes are applied, cancelled and reversed in mock mode only.** The real
  controller issues and reads them and nothing else. In mock mode a note must
  name an existing customer and, optionally, one of that customer's orders; it
  can be applied in parts to any of the customer's orders that is not
  cancelled, never beyond what remains, and becomes APPLIED when nothing does;
  it can be cancelled only while nothing has been applied; and reversing it
  voids only the unapplied remainder. A reversed note counts nothing toward the
  balance, where the backend's `LIVE_STATUSES` still lists REVERSED. Applying
  credit changes no order, stock or deposit, and whether it should be capped at
  an order's total, expire, or relate to deposits is not defined.
- **Customers, bundles, featured collections, product variants, warehouses and
  their stock, trucks and availability have no backend at all.** Customers do
  at least have a real entity — identity's `StorefrontAccount`, which notably has
  no `companyId` — but no admin endpoint reaches it. The others have neither
  entity nor table, and availability is derived rather than stored. Those
  screens exist as mock-only sketches — editable ones now, which makes them a
  more useful sketch and no less of one.

Business rules the backend enforces are also pre-empted in the UI so a refusal
is explained before it is attempted rather than arriving as a 422: you cannot
change your own role, deactivate your own account, or demote the last active
ADMIN. The deposit screen does the same with the deposit state machine, offering
only the transitions `DepositStatus.allowedNext()` permits. The server still
checks all of them.

## On the one chart

The dashboard's quotation pipeline is the only chart in the app, and it is a
single part-to-whole bar. The four counts beside it already give the numbers;
the bar exists only for the shape — whether work is piling up in draft or moving
through to converted.

Its colour is one blue hue stepped light→dark, not four hues, because the stages
are **ordinal** (draft → sent → accepted → converted), not four separate
identities. Both the light steps (250/400/550/700) and the dark ones
(150/300/450/600) were run through a palette validator for monotone lightness,
adjacent-step separation, and contrast against their own card surface — the dark
set is its own selection, not an inversion of the light one. Every stage is also
named and counted in the legend, so nothing is carried by colour alone.

## Verification

Build, typecheck and lint are clean. There is deliberately **no automated test
suite**: the Vitest suite that once covered `mock-data/store.ts` was removed, so
`npm run build` is the only gate, and the flows below were checked by hand rather
than pinned by assertions. Re-adding tests means re-adding `vitest` and a config;
nothing in the app depends on them.

The figures quoted below — order and movement numbers, counts, which seeded
quotation already had an order — come from the seed as it stood when each flow
was driven. The seed has changed since, so they will not all reproduce. The
order flow past conversion, the inventory rules, variant stock and credit-note
application came later and are not described here.

In **mock mode**, the flows were driven in headless Chrome: signing in as each
role and confirming the menu narrows accordingly (WAREHOUSE loses the dashboard
entirely and lands on Products instead), creating a product and confirming it
survives a reload, a duplicate SKU surfacing the backend's own 422 wording, the
inactive seed product staying hidden, and a deposit moving through the state
machine with only the permitted next action offered.

Raising a quotation was driven the same way: an empty submit refused
client-side, a two-line quotation priced on screen and then created, the stored
total agreeing with the estimate to the rupee, the record surviving a reload,
the dashboard's draft count moving with it, and `/quotations/new` refused to a
WAREHOUSE user by `RequirePermission`.

Conversion was driven the same way: a quotation that already had an order
refused with the backend's own wording (`An order already exists for quotation
QT-2026-200`) and the screen left as it was, a draft converted to an order whose
total matched the quotation to the rupee, the quotation then reading CONVERTED
with the action disabled, the dashboard moving on all four figures it should
(draft 14 → 13, converted 31 → 32, orders 31 → 32, order value up by exactly the
quotation's total), and the action shown to SALES but not to ACCOUNTS, which has
no `ORDER_WRITE`.

Recording a movement was driven as WAREHOUSE, the role it is for: the action
disabled until an order is found, the form pre-filled from that order's lines, a
blank quantity refused without closing the dialog, an outward dispatch recorded
as `SM-2026-0053` and appearing in the list behind it, availability moving with
it (White Folding Chair "In store" → "150 out"), the movement surviving a
reload, and ACCOUNTS blocked from the screen entirely by `RequirePermission`.

The master-data CRUD was driven across all five screens: add, edit and delete on
warehouses, trucks and bundles; add, rename and deactivate on categories; add
and edit on customers. The invented rules were checked rather than assumed — a
duplicate warehouse name refused case-insensitively, a duplicate customer email
likewise, and `Andheri Main Store` refusing to be deleted with "2 stock
movements refer to it" while an unreferenced warehouse deleted cleanly. Edits
came back pre-filled, everything survived a reload, and a WAREHOUSE user, who
has no `MASTER_DATA_WRITE`, saw neither the add buttons nor the actions column.

In **api mode**, the proxy and response contract were exercised end to end
against a stub speaking the backend's exact shapes — login success and 422
failure, bearer-authenticated list, 401 without a token, and a duplicate-SKU 422
carrying the backend's message.

Nothing here has been run against the real Spring backend yet; it was not
running on this machine (see the port note above).
