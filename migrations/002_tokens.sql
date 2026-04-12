ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS confirmation_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS confirmed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribe_token  TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_subscriptions_confirmation_token
  ON subscriptions (confirmation_token)
  WHERE confirmation_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_unsubscribe_token
  ON subscriptions (unsubscribe_token)
  WHERE unsubscribe_token IS NOT NULL;
