-- 001-init.sql: initial schema for inventory demo
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  low_stock_threshold INTEGER DEFAULT 5
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  user TEXT NOT NULL,
  note TEXT,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_product_id ON stock_transactions(product_id);

CREATE TABLE IF NOT EXISTS stock_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  qty_requested INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  user TEXT NOT NULL,
  fulfilled INTEGER NOT NULL DEFAULT 0,
  fulfilled_at INTEGER,
  note TEXT,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

COMMIT;
