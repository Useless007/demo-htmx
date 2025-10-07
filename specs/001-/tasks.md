# tasks.md — Implementation tasks for "ระบบการจัดการสต็อกสินค้าอย่างง่าย"

Feature branch: `001-`
Generated: 2025-10-08

Overview: prioritized, dependency-ordered tasks to implement the spec. Tasks are grouped by phase: Setup, Foundational, User Stories (P1,P2,P3), and Polish/Integration. Each task is specific and includes the target file(s). [P] marks tasks that can run in parallel (different files).

TOTAL TASKS: 18

PHASE 1 — Setup (project-level prerequisites)

T001 — Create `data/` and migration scaffolding (blocking)

- Goal: Ensure migrations and data dir exist for SQLite and that migrations can be run locally.
- Actions:
  - Add directory `src/db/` and create SQL migration `src/db/migrations/001-init.sql` with CREATE TABLE statements for `products`, `stock_transactions`, `stock_reservations`.
  - Add a small migration runner `src/db/migrate.js` using `bun:sqlite` that runs migrations in order and records applied migrations in `migrations` table.
  - Files: `src/db/migrations/001-init.sql`, `src/db/migrate.js`
  - Status: COMPLETED (migration created)

T002 — Add DB helper and model stubs (blocking)

- Goal: Provide a single DB connection and simple model APIs for use by endpoints.
- Actions:
  - Create `src/db/db.js` exporting a singleton DB connection and helper `withTransaction(fn)` to run code inside a transaction.
  - Create model stubs: `src/models/product.js`, `src/models/stockTransaction.js`, `src/models/stockReservation.js` each exporting CRUD helpers.
  - Files: `src/db/db.js`, `src/models/*.js`
  - Status: COMPLETED (db helper and model stubs added)

T003 — Add test harness & test utilities [P]

- Goal: Prepare a place for integration/unit tests and DB reset utilities for tests.
- Actions:
  - Create `tests/` directory and `tests/_utils.js` with helper to reset `data/app.db` or re-run migrations before each test.
  - Create `package.json`/`bunfig` test script if missing (ensure `bun test` runs tests). If `package.json` exists, add `
    - Create `package.json`/`bunfig` test script if missing (ensure `bun test` runs tests). If `package.json` exists, add `test` script that runs `bun test`.
  - Files: `tests/_utils.js`, `package.json` (modified as needed)
  - Status: COMPLETED (test harness added)

T003a — Author P1 acceptance test(s) (blocking)

T003a — Author P1 acceptance test(s) (blocking)

- Goal: Implement the P1 acceptance test(s) before product create endpoint is implemented (test-first per constitution).
- Actions:

  - Create `tests/p1-create-product.test.js` that uses `tests/_utils.js` to run migrations, start a test server (or call handlers directly), and assert that creating a product results in a visible product in the list.
  - If full automation is not feasible immediately, create `tests/p1-create-product.manual.md` with exact manual steps and verification checks. Mark automated test preferred.
  - Files: `tests/p1-create-product.test.js` OR `tests/p1-create-product.manual.md`
  - Status: COMPLETED (automated P1 acceptance test added)

  PHASE 2 — Foundational (blocking prerequisites before stories)

  T004 — Implement migrations (SQL) for initial schema (blocking)

  - Goal: Populate `src/db/migrations/001-init.sql` with the schema derived from `data-model.md`.
  - Actions:
    - Create tables: `products`, `stock_transactions`, `stock_reservations`, and `migrations` table. Add indexes on `products.sku` and `stock_transactions.product_id`.
    - Files: `src/db/migrations/001-init.sql`

  T005 — Implement models: Product, StockTransaction, StockReservation (blocking)

  - Goal: Implement model functions used by endpoints.
  - Actions:
    - Implement `src/models/product.js` with: createProduct, getProductById, listProducts(query, paging), updateProduct, changeQuantityAtomic (internal) that uses `withTransaction`.
    - Implement `src/models/stockTransaction.js` with: recordTransaction(productId, delta, user, note).
    - Implement `src/models/stockReservation.js` with: createReservation, listPendingReservations(productId), markFulfilled.
    - Files: `src/models/product.js`, `src/models/stockTransaction.js`, `src/models/stockReservation.js`

  T006 — Add role/identity middleware (demo header-based) [P]

  - Goal: Provide a lightweight identity/role enforcement layer for tests and demo.
  - Actions:
    - Create `src/middleware/auth.js` which reads `X-User-Id` and `X-User-Role` headers and populates `request.user`.
    - Enforce Inventory Manager role in endpoints that modify data.
    - Files: `src/middleware/auth.js`

  PHASE 3 — User Story P1: Add and view products (independently testable)

  T007 — Implement product create endpoint & UI form (blocking)

  - Goal: Allow Inventory Manager to create a new product via HTMX form and API.
  - Actions:
    - Endpoint: POST `/products` — server validates payload, checks unique SKU, creates Product record, returns product list fragment or redirect. File: `index.js` (add route) or `src/api/products.js` if splitting routes.
    - UI: Add form fragment in `public/index.html` or `public/products.html` with HTMX attributes to POST to `/products` and swap `#products-list` outerHTML. File: `public/index.html` (edit)
    - Test: Manual/automated check to create product and verify it appears in list.
    - Parallelizable: UI and endpoint can be developed in parallel if contract is agreed. Mark [P].
    - Status: COMPLETED (POST `/products` endpoint and HTMX form implemented)

  T008 — Implement product list view & pagination (blocking)

  - Goal: Render product list server-side and support >20 items paging/scrolling.
  - Actions:
    - Endpoint: GET `/products` (or `/`) returns HTML page with `#products-list` fragment.
    - Implement server-side paging or simple `limit/offset` query in `src/models/product.js`.
    - Files: `index.js` (route), `src/models/product.js`, `public/products.html` or `public/index.html`.
    - Status: COMPLETED (product listing implemented)

  PHASE 4 — User Story P2: Adjust stock in/out (independently testable)

  T009 — Implement transaction recording endpoint (blocking)

  - Goal: Record inbound/outbound transactions and update Product.quantity atomically.
  - Actions:
    - Endpoint: POST `/products/{id}/transactions` accepting `{delta, note}`. Validate user role, call `withTransaction` to record `stock_transactions` and update `products.quantity` when allowed.
    - Handle outbound exceeding qty by creating `stock_reservations` instead of decrementing below zero (per FR-004).
    - Files: `index.js` (route) or `src/api/transactions.js`, `src/models/stockTransaction.js`, `src/models/product.js`.

  T010 — Implement reservation creation & listing UI (blocking)

  - Goal: When outbound can't be fulfilled, create StockReservation and surface it in the UI.
  - Actions:
    - Endpoint: POST `/products/{id}/reserve` to explicitly create reservations (used by UI when user chooses to reserve). Also ensure automatic creation when transaction outbound > qty.
    - UI: Add reservation list or marker in product detail/list (e.g., link to view pending reservations). Files: `index.js` or `src/api/reservations.js`, `public/*` updates.

  T011 — Implement audit log & reconciliation helper (blocking)

  - Goal: Ensure transactions are append-only and provide a script to replay transactions to compute balance.
  - Actions:
    - Implement `scripts/reconcile.js` reading `stock_transactions` and computing balances for verification. Add CLI usage to `package.json` scripts.
    - Files: `scripts/reconcile.js`

  PHASE 5 — User Story P3: Edit product & search (independently testable)

  T012 — Implement product update endpoint & UI (blocking)

  - Goal: Allow Inventory Manager to edit product metadata and enforce unique SKU.
  - Actions:
    - Endpoint: PUT `/products/{id}` handling updates and SKU uniqueness checks.
    - UI: Edit form and HTMX swap to show updated product line in list.
    - Files: `index.js` or `src/api/products.js`, `public/*` updates.

  T013 — Implement basic search & sorting (optional) [P]

  - Goal: Support case-insensitive substring search by name or SKU and sorting by name/quantity.
  - Actions:
    - Add `q` query param in GET `/products` to filter results; implement SQL `LIKE` query with lowercased comparison.
    - Files: `src/models/product.js`, `index.js`

  PHASE 6 — Polish & Cross-cutting

  T014 — Auto-fulfill reservations (post-inbound allocation) [P]

  - Goal: When inbound transactions arrive, auto-allocate to pending reservations up to `auto_fulfill_threshold`.
  - Actions:
    - Implement allocation logic in `src/services/reservationAllocator.js` called after inbound commits.
    - Update reservations to `fulfilled=true` and create corresponding outbound `stock_transactions` or marking reservation as allocated depending on chosen approach.
    - Files: `src/services/reservationAllocator.js`, `src/models/stockReservation.js`, `src/models/stockTransaction.js`

  T015 — Concurrency tests & DB-level serialization check (blocking)

  - Goal: Validate FR-011 by running concurrent update simulations and ensuring no double-decrement.
  - Actions:
    - Add test `tests/concurrency.test.js` that spawns multiple parallel requests performing outbound operations against same product, assert final balance is correct and no negative quantities.
    - Files: `tests/concurrency.test.js`

  T016 — Add error handling, input validation, and user messages [P]

  - Split: make endpoint validation blocking for state-changing endpoints and keep polish validation tasks separate.

T016a — Endpoint input validation & error messages (blocking)

- Goal: Implement input validation and clear error messages for create/update/transaction endpoints; must be in place before these endpoints are merged.
- Actions:
  - Create `src/validators/productValidator.js` and `src/validators/transactionValidator.js` with validation rules; wire them into endpoints for POST `/products`, PUT `/products/{id}`, POST `/products/{id}/transactions`.
  - Ensure validation errors render usable HTMX fragments and return appropriate HTTP codes.
  - Files: `src/validators/*.js`, route files.

T016b — General error/UX polish (non-blocking) [P]

- Goal: Improve error message wording, UX polish for HTMX responses, and client-side hints.
- Actions:

  - Copy edit messages, enhance HTMX fragments, and add small client-side helpers if needed.
  - Files: `public/*`, small JS helpers if required.

  T017 — Documentation: Update `README.md` and `specs/001-/quickstart.md` with run, test, and migration steps [P]

  - Goal: Ensure runnable instructions and test commands are present for developers.
  - Actions:
    - Update `README.md` with `PORT` usage, migration instructions, test commands.
    - Files: `README.md`, `specs/001-/quickstart.md` (minor updates)

  T018 — Final acceptance checklist & demo script (blocking)

  - Goal: Produce a short demo script to validate SC-001..SC-005 and mark feature done.
  - Actions:
    - Create `docs/demo-script.md` including manual steps to exercise create product, outbound/reservation, inbound allocation, reconciliation, and search.
    - Files: `docs/demo-script.md`

  ***

  Dependency Graph (high-level)

  - Setup: T001 -> T002 -> T003
  - Foundational: T004 -> T005 -> T006 (T006 parallel with T005)
  - P1: T007 -> T008 (can start after T005)
  - P2: T009 -> T010 -> T011 (T009 depends on T005)
  - P3: T012 -> T013 (depends on T005)
  - Polish: T014 (depends on T009 & T005), T015 (after T009/T014), T016 (parallel), T017 (parallel), T018 (final)

  Parallelization examples

  - While T005 (models) is in progress, UI design for T007 (form) and T008 (list markup) can be performed in parallel (different files) — mark [P].
  - Validation and docs (T016/T017) can run in parallel with business logic tasks.

  Counts & Summary

  - Total tasks: 18
  - Tasks per story/phase:
    - Setup & Foundational: 6 (T001..T006)
    - P1 (Add & view): 2 (T007..T008)
    - P2 (Adjust stock): 3 (T009..T011)
    - P3 (Edit & search): 2 (T012..T013)
    - Polish & Cross-cutting: 5 (T014..T018)

  Independent test criteria (per story)

  - P1: Create product via UI or POST `/products`, verify appears in GET `/products` and quantity equals provided value.
  - P2: Record inbound/outbound via POST `/products/{id}/transactions`. Outbound > qty should create reservation (verify `stock_reservations`), inbound should reduce pending reservations per auto-fulfill policy.
  - P3: Update product and verify GET `/products?q=...` returns updated entry.

  Suggested MVP scope

  - Implement only Setup/Foundational + P1 (T001..T008) for an MVP demo that satisfies SC-001 and basic listing/creation. Then iterate P2 (T009..T011) to close SC-002/SC-003 and P3 later.

  Ready artifacts & next command

  - `specs/001-/tasks.md` created at: `/home/useless007/Projects/test/demo-htmx/specs/001-/tasks.md`
  - Suggested next step: run `/speckit.tasks` consumer (or start implementing T001..T006).
