CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tracked_repos (
  id               SERIAL      PRIMARY KEY,
  owner            TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  last_seen_tag    TEXT,
  last_checked_at  TIMESTAMPTZ,
  UNIQUE (owner, name)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  repo_id    INTEGER     NOT NULL REFERENCES tracked_repos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, repo_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_repo_id ON subscriptions(repo_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_email   ON subscriptions(email);
