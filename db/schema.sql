-- Waitlist storage schema for Cloudflare D1.
-- Apply with:
--   npx wrangler d1 execute floriente-waitlist-preview --local  --file=db/schema.sql
--   npx wrangler d1 execute floriente-waitlist-preview --remote --file=db/schema.sql
--   npx wrangler d1 execute floriente-waitlist-prod    --remote --file=db/schema.sql
-- Idempotent (IF NOT EXISTS) so re-running is safe.

CREATE TABLE IF NOT EXISTS waitlist (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at        TEXT    NOT NULL,            -- ISO 8601 timestamp
  locale            TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  email             TEXT    NOT NULL,
  preferred_channel TEXT    NOT NULL,
  contact_value     TEXT    NOT NULL,
  country           TEXT    NOT NULL,
  city              TEXT    NOT NULL DEFAULT '',
  interest_class    TEXT    NOT NULL,
  breed_preference  TEXT    NOT NULL DEFAULT '',
  sex_preference    TEXT    NOT NULL DEFAULT '',
  color_preference  TEXT    NOT NULL DEFAULT '',
  timing            TEXT    NOT NULL DEFAULT '',
  video_call_ready  INTEGER NOT NULL DEFAULT 0,  -- 0/1
  source_channel    TEXT    NOT NULL DEFAULT '',
  home_experience   TEXT    NOT NULL DEFAULT '',
  wishes            TEXT    NOT NULL DEFAULT '',
  gdpr_consent      INTEGER NOT NULL DEFAULT 1,  -- 0/1
  status            TEXT    NOT NULL DEFAULT 'new',
  notes             TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_status     ON waitlist(status);
