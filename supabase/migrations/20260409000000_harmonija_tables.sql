-- knjige table for Harmonija Knjige book catalog
CREATE TABLE IF NOT EXISTS knjige (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   UUID NOT NULL REFERENCES clients(id),
  knjiga_id   TEXT NOT NULL,
  naslov      TEXT NOT NULL,
  autor       TEXT NOT NULL,
  kategorije  TEXT[],
  opis        TEXT,
  url         TEXT NOT NULL,
  status      TEXT DEFAULT 'Aktivan',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- crm_harmonija table for tracking interested buyers
CREATE TABLE IF NOT EXISTS crm_harmonija (
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
