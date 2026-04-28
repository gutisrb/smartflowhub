-- Maguna Dizajn — CRM table for folding furniture B2C customers

CREATE TABLE IF NOT EXISTS crm_maguna (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         UUID NOT NULL REFERENCES clients(id),
  id_razgovora      TEXT,
  izvor             TEXT,
  full_name         TEXT,
  email             TEXT,
  telefon           TEXT,
  zdravstveni_cilj  TEXT,   -- repurposed: product category of interest (Kategorija)
  proizvod          TEXT,   -- specific product they enquired about
  status            TEXT DEFAULT 'Novi',
  razlog            TEXT,
  status_porudzbine TEXT,
  komentar          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_maguna ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='crm_maguna_select' AND tablename='crm_maguna') THEN
    CREATE POLICY crm_maguna_select ON crm_maguna FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='crm_maguna_insert' AND tablename='crm_maguna') THEN
    CREATE POLICY crm_maguna_insert ON crm_maguna FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='crm_maguna_update' AND tablename='crm_maguna') THEN
    CREATE POLICY crm_maguna_update ON crm_maguna FOR UPDATE USING (true);
  END IF;
END $$;
