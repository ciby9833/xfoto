-- xfoto database schema — v1
-- Run via: npm run migrate
-- All timestamps are stored as UTC.

-- ── Devices ──────────────────────────────────────────────────────────────────
-- One row per physical kiosk machine.
-- config_override is a JSONB blob that merges on top of the default session
-- config in the Electron app (shootMode, totalShots, countdownSeconds, price…).
CREATE TABLE IF NOT EXISTS devices (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name          TEXT        NOT NULL,                      -- human label, e.g. "Mall Taman Anggrek #1"
  location      TEXT,                                      -- free-text location
  secret_hash   TEXT        NOT NULL,                      -- bcrypt hash used to issue JWT tokens
  config_override JSONB     NOT NULL DEFAULT '{}',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Frames ───────────────────────────────────────────────────────────────────
-- Frame templates uploaded via admin panel.
-- slot_definitions: JSON array of {x,y,w,h} objects (canvas coordinates).
-- price_override: if set, overrides the device default price for this frame.
CREATE TABLE IF NOT EXISTS frames (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name             TEXT        NOT NULL,
  file_key         TEXT        NOT NULL,   -- storage key (path on disk or S3 key)
  thumbnail_key    TEXT,                   -- smaller preview image key
  canvas_width     INTEGER     NOT NULL DEFAULT 887,
  canvas_height    INTEGER     NOT NULL DEFAULT 1774,
  slot_definitions JSONB       NOT NULL DEFAULT '[]',
  price_override   INTEGER,               -- NULL = use device config price
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Device ↔ Frame assignment ──────────────────────────────────────────────
-- Which frames are available on which device (many-to-many).
-- If no rows exist for a device, ALL active frames are shown.
CREATE TABLE IF NOT EXISTS device_frames (
  device_id   TEXT        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  frame_id    TEXT        NOT NULL REFERENCES frames(id)  ON DELETE CASCADE,
  PRIMARY KEY (device_id, frame_id)
);

-- ── Coupons ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code             TEXT        NOT NULL UNIQUE,   -- uppercase, e.g. HALF50
  label            TEXT        NOT NULL,
  discount_percent INTEGER     NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  max_uses         INTEGER,                       -- NULL = unlimited
  uses_count       INTEGER     NOT NULL DEFAULT 0,
  valid_from       TIMESTAMPTZ,
  valid_until      TIMESTAMPTZ,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  device_id        TEXT        REFERENCES devices(id),
  frame_id         TEXT        REFERENCES frames(id),
  coupon_id        TEXT        REFERENCES coupons(id),
  base_amount      INTEGER     NOT NULL,   -- original price (IDR)
  final_amount     INTEGER     NOT NULL,   -- after discount
  currency         TEXT        NOT NULL DEFAULT 'IDR',
  status           TEXT        NOT NULL DEFAULT 'CREATED',
                               -- CREATED | PAID | SHOOTING | DONE | FAILED
  payment_provider TEXT,                   -- xendit | midtrans | mock
  payment_ref      TEXT,                   -- provider order/invoice ID
  photo_paths      JSONB,                  -- array of captured photo keys
  final_photo_key  TEXT,                   -- composited output key
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Download codes ────────────────────────────────────────────────────────────
-- Short alphanumeric code shown on the kiosk Done screen as a QR code.
-- User scans → GET /api/downloads/:code → redirect to signed S3 URL.
CREATE TABLE IF NOT EXISTS download_codes (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code        TEXT        NOT NULL UNIQUE,   -- 8-char alphanumeric, uppercase
  order_id    TEXT        NOT NULL REFERENCES orders(id),
  photo_key   TEXT        NOT NULL,          -- storage key of the composited image
  expires_at  TIMESTAMPTZ NOT NULL,
  used_count  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS orders_device_id_idx      ON orders(device_id);
CREATE INDEX IF NOT EXISTS orders_status_idx         ON orders(status);
CREATE INDEX IF NOT EXISTS download_codes_code_idx   ON download_codes(code);
CREATE INDEX IF NOT EXISTS coupons_code_idx          ON coupons(code);
