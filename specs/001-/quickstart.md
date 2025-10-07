# quickstart.md

Date: 2025-10-08
Feature: ระบบการจัดการสต็อกสินค้าอย่างง่าย

## Prerequisites

- Bun installed (https://bun.sh)
- Clone repository and run from repo root

## Setup (local demo)

1. Install dependencies (if any) — for this demo, none required beyond Bun runtime.
2. Ensure `data/` exists and is writable. The demo uses `data/app.db` as SQLite file.

## Run server

Start the Bun server (from repo root):

```bash
PORT=3001 bun run index.js
```

The app serves a simple HTMX-based UI at `http://localhost:3001`.

## Manual test scenarios

- Create product: use UI form or POST `/products` (see `openapi.yaml`). Include header `X-User-Id: demo-user` and `X-User-Role: inventory_manager` for role enforcement.
- Record outbound larger than on-hand: POST `/products/{id}/transactions` with `{"delta": -N}`; when insufficient, the server will create a reservation instead of making `quantity` negative.
- Seed multiple items and verify list pagination and low-stock indicator by adjusting `low_stock_threshold` on items.
