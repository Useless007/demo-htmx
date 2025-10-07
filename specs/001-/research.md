# research.md

Date: 2025-10-08
Feature: ระบบการจัดการสต็อกสินค้าอย่างง่าย

## Purpose

Resolve technical unknowns and record decisions, rationale, and alternatives so Phase 1 design can proceed without open clarifications.

## Decisions

- Decision: Runtime & Language

  - Chosen: Bun (JavaScript), run-time: Bun v1.x compatible, codebase: ES2022+ JavaScript
  - Rationale: The repository already contains a Bun-based demo server using Bun's sqlite support and the user requested Bun earlier. Choosing Bun minimizes friction and leverages existing code and developer environment.
  - Alternatives considered: Node.js with sqlite3 (more conventional), Deno (requires migration). Rejected for this project to stay consistent with existing workspace.

- Decision: Storage

  - Chosen: SQLite (file-based) stored at `data/app.db` with transactional semantics.
  - Rationale: Small, embeddable, supports transactions and is already used by the demo scaffold. Meets the constitution requirement for reconcilable audit logs.
  - Alternatives: PostgreSQL (better for scale), rejected for MVP demo complexity.

- Decision: Frontend integration

  - Chosen: HTMX (client-side progressive enhancement via CDN) and server-rendered fragments for CRUD operations.
  - Rationale: Matches existing scaffold and user request; small and easy to implement without heavy JavaScript frameworks.

- Decision: Authentication / Authorization (resolve FR-006)

  - Chosen for MVP: Lightweight role simulation via request header (e.g., `X-User-Id` and `X-User-Role`) used by server to record `StockTransaction.user` and enforce Inventory Manager role checks.
  - Rationale: Spec explicitly treats authentication as out-of-scope for MVP but requires actor identity in transactions; this approach provides identity/role support for tests and demo without adding an external auth dependency.
  - Alternatives: Implement full OAuth/SSO or JWT — deferred to future phases.

- Decision: Data retention (resolve FR-007)

  - Chosen: Default retention policy for MVP: keep transaction/ reservation records indefinitely for reconciliation; optionally truncate or archive older records via a periodic maintenance task. For demo/testing, no automatic purge will be implemented; retention policy configuration is noted for future work.
  - Rationale: The constitution requires auditability and the ability to replay transactions; deleting transactions by default conflicts with that requirement. Keeping records simplifies reconciliation and testing.
  - Alternatives: 90/180/365 day retention with archive — deferred.

- Decision: Testing

  - Chosen: `bun test` for unit tests and small integration scripts using curl or node for smoke tests. Optional: add Playwright or similar for end-to-end testing later if UI automation is required.
  - Rationale: `bun test` is lightweight and available in the chosen runtime; avoids adding heavy dependencies for the demo.

- Decision: Performance & Scale
  - Chosen: MVP targets a single-instance Linux host with expected load <100 concurrent users and dataset up to 10k products. Performance goal for UI interactions: p95 <500ms.
  - Rationale: Practical for a demo using SQLite and a single Bun process. If higher scale is needed, migrate to Postgres and scale horizontally.

## Resolved Unknowns → Research Tasks

- Auth method: resolved (header-based test stub)
- Retention policy: resolved (keep audit log indefinitely for demo)
- Runtime & dependencies: resolved (Bun + sqlite + htmx)

## Next steps from research

- Phase 1: derive data-model.md and OpenAPI contracts based on the entities in `spec.md`.
- Implement quickstart and migration steps for SQLite.
