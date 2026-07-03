-- Cockpit per-node settings. One row per client; the background jobs read it so
-- the toggles/inputs in each node's settings menu actually control the machine.
CREATE TABLE IF NOT EXISTS machine_config (
  client_id             uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  source_enabled        boolean     NOT NULL DEFAULT true,
  source_daily_limit    integer     NOT NULL DEFAULT 15,
  source_follower_floor integer     NOT NULL DEFAULT 30000,
  build_enabled         boolean     NOT NULL DEFAULT true,
  send_enabled          boolean     NOT NULL DEFAULT false,  -- auto-send OFF by default (safety)
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Seed SmartFlow's row.
INSERT INTO machine_config (client_id)
VALUES ('69acf7e9-557e-4ca3-85bd-a785ef39e351')
ON CONFLICT (client_id) DO NOTHING;
