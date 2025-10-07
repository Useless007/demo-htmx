# data-model.md

Date: 2025-10-08
Feature: ระบบการจัดการสต็อกสินค้าอย่างง่าย

## Entities

### Product

- id: integer PK (autoincrement)
- name: string (required)
- sku: string (required, unique)
- quantity: integer (≥ 0)
- location: string (optional)
- low_stock_threshold: integer (optional, default 5)

Validation rules:

- `sku` unique constraint enforced at DB level
- `quantity` must be integer ≥ 0; negative adjustments create reservations instead of decrementing below zero

### StockTransaction

- id: integer PK
- product_id: integer FK -> Product.id (indexed)
- delta: integer (positive for inbound, negative for outbound)
- timestamp: ISO8601 / stored as integer epoch
- user: string (user id or name) — REQUIRED
- note: string (optional)

Constraints & behavior:

- Transactions are append-only; `quantity` is derived by summing inbound/outbound transactions or maintained as a cached `Product.quantity` updated inside the same transaction.

### StockReservation

- id: integer PK
- product_id: integer FK -> Product.id
- qty_requested: integer (>0)
- timestamp: ISO8601
- user: string
- fulfilled: boolean (default false)
- fulfilled_at: timestamp (nullable)
- note: string (optional)
- requires_approval: boolean (derived)

Reservation behavior:

- When an outbound would exceed current on-hand, create a StockReservation with `fulfilled=false`. `Product.quantity` remains unchanged.
- Auto-fulfill logic: when inbound transactions are recorded, attempt to allocate to pending reservations FIFO for reservations where `qty_requested` <= `auto_fulfill_threshold` (configurable). Larger reservations remain pending for manual approval (Inventory Manager).

### Fulfillment semantics (decision)

- Decision: On allocation/fulfillment of a `StockReservation`, implementation WILL create a corresponding outbound `StockTransaction` (delta = -allocated_qty) and mark the reservation `fulfilled=true` with `fulfilled_at` timestamp. `Product.quantity` is updated as part of the same DB transaction that records the inbound and outbound transactions to preserve atomicity and a clear audit trail.

Rationale: Explicit outbound transactions make audit/reconciliation simpler (every change is an append-only transaction) and supports replaying transactions to compute current on-hand. This choice avoids ambiguous dual-state (reservation-only vs transaction-based) and aligns with the constitution's reconciliation requirement.

## State transitions / Workflows

- Outbound attempt when qty >= requested: create StockTransaction(delta = -N), update Product.quantity atomically.
- Outbound attempt when qty < requested: create StockReservation(pending); notify user; do not create negative transaction.
- Inbound arrival: create StockTransaction(delta = +N); after commit, attempt to allocate to pending reservations (FIFO) up to the inbound qty; for auto-fulfillable reservations, mark fulfilled and create corresponding StockTransaction entries reflecting the outbound allocation (or mark reservation fulfilled and decrement Product.quantity if reservations are allocated by decrement).
