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
| Products | `GET`/`POST /admin/master-data/products` | Working |
| Deposits | `GET /admin/deposits/by-order/{id}` + request-refund / confirm-refunded / forfeit | Working |
| Notifications | `GET /admin/notifications/log`, `…/log/by-subject` | Working |
| Users | `GET`/`POST /admin/users`, `…/role`, `…/deactivate`, `…/reset-password` | Working |
| Quotations | `GET /admin/quotations/{id}` | Lookup only — no list endpoint |
| Orders | `GET /admin/orders/{id}` | Lookup only — no list endpoint |
| Stock movement | `GET /admin/inventory/stock-movements/by-order/{id}` | Per-order only — cannot be browsed |
| Credit notes | `GET /admin/credit-notes/by-customer/{id}`, `…/balance`, `POST /admin/credit-notes` | Per-customer only — no company-wide list |
| Categories | none | **Mock only** — md_category exists, no controller |
| Customers | none | **Mock only** — StorefrontAccount exists, no admin endpoint |
| Bundles | none | **Mock only** — no entity or table |
| Warehouses | none | **Mock only** — no entity or table |
| Trucks | none | **Mock only** — no entity or table |
| Availability | none | **Mock only** — derived, and the derivation is unread |

The middle tier works against the real backend: those four modules expose a
record by id but have no query that lists them, so each screen looks one up
the way Deposits already did rather than pretending to browse.

The bottom tier has nothing to call at all, and renders seeded mock data.

**None of this is said on screen.** The screens carried explanatory notes until
they were removed by request, so this table is now the only record of which of
them are real. Nothing in the running app distinguishes a figure the backend
produced from one the mock invented, and nothing tells a user that a product
cannot be edited, that a quotation's status will never move, or that the
availability numbers are a placeholder calculation. Keep this table current: it
is load-bearing in a way a README does not normally have to be.

### Known gaps

These are backend limits. They used to be surfaced in the UI; they are now
recorded only here, so someone using the app will meet each of them as a
surprise rather than as an explanation:

- **Products are list-and-create only.** `listActiveProducts` returns active
  products, and there is no update, deactivate or get-by-id endpoint exposed. A
  product cannot be corrected or retired from the back office.
- **Categories have no endpoint.** `md_category` exists and `ProductView`
  resolves a `categoryName`, but nothing lists or creates categories, so the
  Categories screen is mock-only and the product create form still takes a
  category **id** rather than offering a picker. `category_id` is also not a
  foreign key by design (the legacy data has orphans), so a product with an
  unresolvable category renders as "Uncategorised" rather than as an error.
- **Users cannot be reactivated.** Deactivation is one-way from here.
- **The dashboard is six scalars.** Reporting owns no tables and assembles them
  from other modules' APIs. The counts cover four of the six quotation statuses
  — rejected and expired are not returned — so a true win rate cannot be shown,
  and order value is a lifetime total with no period to compare against.
- **Deposits are per-order only.** There is no list, so the back office cannot
  answer "which deposits are waiting to be refunded?"; you look one up by order
  id. Note also that `recordRefund`/`recordForfeit` do **not** check the amount
  against what is held, so the settle dialog warns when you exceed it — that
  warning is the only guard there is.
- **No quotation or order list endpoints.** Both screens therefore look a
  record up by id rather than browsing, the same shape Deposits settled on.
  This is still the main thing blocking the back office: the counts on the
  dashboard are the only company-wide view of either.
- **Quotation and order status do not move.** Neither enum has a state machine
  in code — the transition rules live in stored procedures that have not been
  read — so both screens show status without offering a single transition, and
  an order sits at CONFIRMED even once it has been dispatched and returned.
- **Stock movements cannot be browsed**, only read per order, and nothing
  validates a movement's quantities against what the order contains. A movement
  also carries no sub-event id, so a multi-event order cannot attribute stock.
- **Credit notes are never applied.** `appliedAmount` is initialised to zero
  and nothing moves it: apply, cancel and reverse are unimplemented, so a
  customer's balance only ever grows and three of the four statuses are
  unreachable.
- **Customers, bundles, warehouses, trucks and availability have no backend at
  all.** Customers do at least have a real entity — identity's
  `StorefrontAccount`, which notably has no `companyId` — but no admin endpoint
  reaches it. The other four have neither entity nor table, and availability is
  derived rather than stored, by a calculation nobody has read. Those five
  screens exist as mock-only sketches.

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

Build, typecheck and lint are clean.

In **mock mode**, the flows were driven in headless Chrome: signing in as each
role and confirming the menu narrows accordingly (WAREHOUSE loses the dashboard
entirely and lands on Products instead), creating a product and confirming it
survives a reload, a duplicate SKU surfacing the backend's own 422 wording, the
inactive seed product staying hidden, and a deposit moving through the state
machine with only the permitted next action offered.

In **api mode**, the proxy and response contract were exercised end to end
against a stub speaking the backend's exact shapes — login success and 422
failure, bearer-authenticated list, 401 without a token, and a duplicate-SKU 422
carrying the backend's message.

Nothing here has been run against the real Spring backend yet; it was not
running on this machine (see the port note above).
