-- CRM table for Publik Praktikum
CREATE TABLE IF NOT EXISTS crm_publik (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     UUID NOT NULL REFERENCES clients(id),
  id_razgovora  TEXT,
  izvor         TEXT,
  full_name     TEXT,
  email         TEXT,
  telefon       TEXT,
  tema          TEXT,
  knjiga        TEXT,
  status        TEXT DEFAULT 'Novi',
  komentar      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_publik ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_publik_own_client" ON crm_publik
  USING (client_id IN (
    SELECT id FROM clients WHERE email = auth.email()
  ));

-- CRM table for Stela Knjige
CREATE TABLE IF NOT EXISTS crm_stela (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     UUID NOT NULL REFERENCES clients(id),
  id_razgovora  TEXT,
  izvor         TEXT,
  full_name     TEXT,
  email         TEXT,
  telefon       TEXT,
  tema          TEXT,
  knjiga        TEXT,
  status        TEXT DEFAULT 'Novi',
  komentar      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_stela ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_stela_own_client" ON crm_stela
  USING (client_id IN (
    SELECT id FROM clients WHERE email = auth.email()
  ));

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE crm_publik;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_stela;
