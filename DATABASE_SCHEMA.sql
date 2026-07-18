-- Arena Stars 3D — schemat v6.
-- Normalnie NIE uruchamiaj ręcznie: server.py tworzy i aktualizuje te tabele automatycznie.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS server_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS players (
  player_id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(18) NOT NULL,
  points BIGINT NOT NULL DEFAULT 0,
  trophies BIGINT NOT NULL DEFAULT 0,
  coins BIGINT NOT NULL DEFAULT 0,
  move_level INTEGER NOT NULL DEFAULT 0,
  fire_level INTEGER NOT NULL DEFAULT 0,
  hp_level INTEGER NOT NULL DEFAULT 0,
  skin VARCHAR(16) NOT NULL DEFAULT 'classic',
  cosmic_owned BOOLEAN NOT NULL DEFAULT FALSE,
  hero_version1 BOOLEAN NOT NULL DEFAULT FALSE,
  admin_revision BIGINT NOT NULL DEFAULT 0,
  revision BIGINT NOT NULL DEFAULT 1,
  data_version INTEGER NOT NULL DEFAULT 1,
  profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_client_version VARCHAR(40) NOT NULL DEFAULT '',
  last_seen TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS game_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS accounts (
  account_id VARCHAR(80) PRIMARY KEY,
  username VARCHAR(24) NOT NULL,
  username_key VARCHAR(24) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  banned_until TIMESTAMPTZ,
  ban_reason VARCHAR(240) NOT NULL DEFAULT '',
  ban_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  account_id VARCHAR(80) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(80) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  recipient_id VARCHAR(80) REFERENCES accounts(account_id) ON DELETE CASCADE,
  body VARCHAR(300) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_broadcast BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS match_results (
  id BIGSERIAL PRIMARY KEY,
  account_id VARCHAR(80) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  mode VARCHAR(32) NOT NULL,
  result VARCHAR(24) NOT NULL,
  points_delta BIGINT NOT NULL DEFAULT 0,
  trophies_delta BIGINT NOT NULL DEFAULT 0,
  coins_delta BIGINT NOT NULL DEFAULT 0,
  duration_seconds NUMERIC(12,3) NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_version VARCHAR(40) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
