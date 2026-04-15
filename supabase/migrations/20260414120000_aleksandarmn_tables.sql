-- Aleksandar MN — product catalog and CRM tables
-- Run after inserting the client row into the clients table

-- ─── Product catalog ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proizvodi (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    UUID NOT NULL REFERENCES clients(id),
  proizvod_id  TEXT NOT NULL,
  naziv        TEXT NOT NULL,
  kategorija   TEXT NOT NULL,
  brend        TEXT,
  opis         TEXT,
  url          TEXT NOT NULL,
  cena         INTEGER,           -- price in RSD
  status       TEXT DEFAULT 'Aktivan',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE proizvodi ENABLE ROW LEVEL SECURITY;
CREATE POLICY proizvodi_select ON proizvodi FOR SELECT USING (true);
CREATE POLICY proizvodi_insert ON proizvodi FOR INSERT WITH CHECK (true);
CREATE POLICY proizvodi_update ON proizvodi FOR UPDATE USING (true);

-- ─── CRM ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_aleksandarmn (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id        UUID NOT NULL REFERENCES clients(id),
  id_razgovora     TEXT,
  izvor            TEXT,
  full_name        TEXT,
  email            TEXT,
  telefon          TEXT,
  zdravstveni_cilj TEXT,    -- health goal/concern mentioned by the customer
  proizvod         TEXT,    -- specific product they asked about
  status           TEXT DEFAULT 'Novi',
  komentar         TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_aleksandarmn ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_amn_select ON crm_aleksandarmn FOR SELECT USING (true);
CREATE POLICY crm_amn_insert ON crm_aleksandarmn FOR INSERT WITH CHECK (true);
CREATE POLICY crm_amn_update ON crm_aleksandarmn FOR UPDATE USING (true);

-- Enable realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE crm_aleksandarmn;
