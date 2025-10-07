# demo-htmx — HTMX + Bun + SQLite (simple inventory)

This small demo shows a minimal inventory web app using an HTMX front-end, a Bun HTTP backend, and SQLite for persistence. It was built incrementally for exploration and teaching purposes.

Key ideas

- Server-rendered HTML fragments drive the UI (no SPA JS framework).
- State-changing endpoints return the `#products-list` HTML fragment. HTMX swaps that fragment into the page.
- The server can include two helpful attributes on the fragment to enable targeted UI feedback:
  - `data-message` — a short success or info string.
  - `data-message-id` — the product id to target for an inline per-item message.
- The client-side HTMX hooks placed in `public/index.html` prefer to show `data-message` text inside the per-product container `#msg-<id>` when `data-message-id` is set; otherwise the message is shown in the global `#message` area.
- Per-button spinners use `hx-indicator` tied to spinner elements with ids like `spinner-tx-<id>` and `spinner-res-<id>` so only the active form shows a loading state.

Quick start (example)

- Start the server with Bun (this repo's server entry is `index.js`):

  bun index.js

  or use whatever command you already use to run the project. The server in this workspace listens on port 3001 in my test environment.

- Open http://localhost:3001/ in your browser.

Files of interest

- `index.js` — main server, routes, and `renderProductsList()` that returns the fragment used by HTMX.
- `public/index.html` — the HTMX-enabled page and client hooks that consume `data-message` / `data-message-id` and handle errors.
- `public/style.css` — spinner and message styles.
- `src/validators/inputs.js` — server-side input validation for create/transaction/reserve forms.
- `src/db/` and `src/models/` — database migration runner and data access code (SQLite-backed).
- `tests/` — unit tests (validators and acceptance tests).

Notes & next steps

- Integration tests that assert fragment attributes (`data-message`, `data-message-id`) can be added under `tests/` to lock UX behavior.
- Concurrency tests for transactions/reservations are recommended to validate allocator behavior under contention.

If you want, I can add a small integration test that posts to `/products/:id/transactions` and asserts the returned fragment contains `data-message-id` and the expected message text.

# Demo HTMX + Bun + SQLite

Lightweight demo showing HTMX frontend with a Bun backend and SQLite storage.

Requirements: Bun (https://bun.sh)

Run:

1. Start the server (default port 3000):

   bun run index.js

2. Or set a custom port with PORT, e.g.:

   PORT=3001 bun run index.js

3. Open http://localhost:3000 (or the port you set)

Notes:

- Uses Bun's built-in sqlite binding `bun:sqlite`.
- Database file is created under `data/app.db` relative to the server file.
- This is a minimal demo for local development only.
