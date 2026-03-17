-- ============================================================================
-- Migration: Separate B2C Candidates into dedicated kandidati table
-- ============================================================================
-- Problem: B2B leads (SmartFlow) and B2C youth candidates (OZ Avala) were
-- stored in the same contacts table, causing wrong columns, wrong queries,
-- and confusion in both the frontend and n8n chatbot workflows.
-- ============================================================================

-- ─── 1. Create kandidati table (B2C youth candidates only) ──────────────────

CREATE TABLE IF NOT EXISTS kandidati (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  id_razgovora    TEXT,
  full_name       TEXT,
  email           TEXT,
  telefon         TEXT,
  starost         TEXT,
  lokacija        TEXT,
  posao           TEXT,
  shift           TEXT,
  status          TEXT DEFAULT 'Novi',
  izvor           TEXT,
  komentar        TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE kandidati ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kandidati_open" ON kandidati;
CREATE POLICY "kandidati_open" ON kandidati
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_kandidati_id_razgovora ON kandidati(id_razgovora);
CREATE INDEX IF NOT EXISTS idx_kandidati_client_id   ON kandidati(client_id);

-- ─── 2. Migrate OZ Avala B2C records from contacts → kandidati ──────────────

INSERT INTO kandidati (
  client_id, full_name, email, telefon,
  starost, lokacija, posao, shift, status, izvor, created_at
)
SELECT
  client_id::uuid,
  name,
  email,
  phone,
  age,
  location,
  job_title,
  shift,
  COALESCE(status, 'Novi'),
  COALESCE(izvor, 'Instagram'),
  created_at
FROM contacts
WHERE client_id = '7ac02189-d0ec-4532-baa6-d7d4dc84b87c'
ON CONFLICT DO NOTHING;

-- ─── 3. Remove OZ Avala records from contacts (B2B-only going forward) ───────

DELETE FROM contacts WHERE client_id = '7ac02189-d0ec-4532-baa6-d7d4dc84b87c';

-- ─── 4. Drop dead FK on razgovori (pointed to kontakti_legacy, never valid) ──

ALTER TABLE razgovori DROP CONSTRAINT IF EXISTS razgovori_lead_id_fkey;

-- ─── 5. Drop empty dead tables ───────────────────────────────────────────────

DROP TABLE IF EXISTS kontakti_legacy CASCADE;
DROP TABLE IF EXISTS leads_emails_due CASCADE;
DROP TABLE IF EXISTS interactions   CASCADE;

-- ─── 6. Drop kontakti VIEW first (it depends on B2C columns we're removing) ──

DROP TRIGGER IF EXISTS trg_kontakti_insert ON kontakti;
DROP TRIGGER IF EXISTS trg_kontakti_update ON kontakti;
DROP VIEW IF EXISTS kontakti CASCADE;

-- ─── 7. Remove B2C columns from contacts (now B2B-only) ─────────────────────

ALTER TABLE contacts DROP COLUMN IF EXISTS age;
ALTER TABLE contacts DROP COLUMN IF EXISTS location;
ALTER TABLE contacts DROP COLUMN IF EXISTS shift;
ALTER TABLE contacts DROP COLUMN IF EXISTS job_title;

-- ─── 8. Rebuild kontakti VIEW (B2B-only, no B2C alias columns) ──────────────

CREATE VIEW kontakti AS
SELECT
    c.id,
    c.name              AS ime,
    c.name              AS full_name,
    c.email,
    c.phone             AS telefon,
    comp.name           AS kompanija,
    comp.name           AS company,
    c.company_name,
    c.niche,
    c.service,
    c.website,
    c.instagram_handle,
    c.instagram_followers,
    c.website_summary,
    c.last_sent_at,
    c.email_draft,
    c.comment,
    c.problem,
    c.kategorija,
    c.prioritet_skor,
    c.obrazlozenje,
    c.sledeca_akcija,
    c.status,
    c.izvor,
    c.intake_data,
    c.client_id,
    c.created_at,
    c.updated_at,
    c.email_type,
    c.next_email_at,
    c.demo_preference,
    c.demo_time,
    c.meeting_time,
    c.meeting_link,
    c.email_1_poslat,
    c.email_2_poslat,
    c.email_3_poslat,
    c.email_4_poslat,
    c.email_5_poslat,
    c.email_6_poslat,
    c.email_7_poslat,
    c.email_8_poslat,
    c.nurture_2_poslat,
    c.intake_nudge_poslat
FROM contacts c
LEFT JOIN companies comp ON c.company_id = comp.id;

-- ─── 9. Recreate INSTEAD OF triggers (B2B fields only) ──────────────────────

CREATE OR REPLACE FUNCTION instead_of_insert_kontakti()
RETURNS TRIGGER AS $$
DECLARE
    new_company_id UUID;
BEGIN
    IF NEW.kompanija IS NOT NULL THEN
        INSERT INTO companies (name) VALUES (NEW.kompanija)
        RETURNING id INTO new_company_id;
    END IF;

    INSERT INTO contacts (
        company_id, name, email, phone, company_name, niche, service, website,
        instagram_handle, instagram_followers, website_summary, last_sent_at,
        email_draft, comment, problem, kategorija, prioritet_skor, obrazlozenje,
        sledeca_akcija, status, izvor, intake_data, client_id, email_type,
        next_email_at, demo_preference, demo_time, meeting_time, meeting_link,
        email_1_poslat, email_2_poslat, email_3_poslat, email_4_poslat,
        email_5_poslat, email_6_poslat, email_7_poslat, email_8_poslat,
        nurture_2_poslat, intake_nudge_poslat
    ) VALUES (
        new_company_id, NEW.ime, NEW.email, NEW.telefon, NEW.company_name, NEW.niche, NEW.service, NEW.website,
        NEW.instagram_handle, NEW.instagram_followers, NEW.website_summary, NEW.last_sent_at,
        NEW.email_draft, NEW.comment, NEW.problem, NEW.kategorija, COALESCE(NEW.prioritet_skor, 0),
        NEW.obrazlozenje, NEW.sledeca_akcija, COALESCE(NEW.status, 'Lead'), NEW.izvor, NEW.intake_data,
        NEW.client_id, NEW.email_type, NEW.next_email_at, NEW.demo_preference, NEW.demo_time,
        NEW.meeting_time, NEW.meeting_link, COALESCE(NEW.email_1_poslat, false),
        COALESCE(NEW.email_2_poslat, false), COALESCE(NEW.email_3_poslat, false),
        COALESCE(NEW.email_4_poslat, false), COALESCE(NEW.email_5_poslat, false),
        COALESCE(NEW.email_6_poslat, false), COALESCE(NEW.email_7_poslat, false),
        COALESCE(NEW.email_8_poslat, false), COALESCE(NEW.nurture_2_poslat, false),
        COALESCE(NEW.intake_nudge_poslat, false)
    );

    SELECT id INTO NEW.id FROM contacts WHERE
        (email IS NOT NULL AND email = NEW.email)
        OR (email IS NULL AND name = NEW.ime AND client_id = NEW.client_id)
    LIMIT 1;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kontakti_insert
INSTEAD OF INSERT ON kontakti
FOR EACH ROW
EXECUTE FUNCTION instead_of_insert_kontakti();

CREATE OR REPLACE FUNCTION instead_of_update_kontakti()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contacts SET
        name                = NEW.ime,
        email               = NEW.email,
        phone               = NEW.telefon,
        company_name        = NEW.company_name,
        niche               = NEW.niche,
        service             = NEW.service,
        website             = NEW.website,
        instagram_handle    = NEW.instagram_handle,
        instagram_followers = NEW.instagram_followers,
        website_summary     = NEW.website_summary,
        last_sent_at        = NEW.last_sent_at,
        email_draft         = NEW.email_draft,
        comment             = NEW.comment,
        problem             = NEW.problem,
        kategorija          = NEW.kategorija,
        prioritet_skor      = COALESCE(NEW.prioritet_skor, prioritet_skor),
        obrazlozenje        = NEW.obrazlozenje,
        sledeca_akcija      = NEW.sledeca_akcija,
        status              = NEW.status,
        izvor               = NEW.izvor,
        intake_data         = NEW.intake_data,
        client_id           = NEW.client_id,
        email_type          = NEW.email_type,
        next_email_at       = NEW.next_email_at,
        demo_preference     = NEW.demo_preference,
        demo_time           = NEW.demo_time,
        meeting_time        = NEW.meeting_time,
        meeting_link        = NEW.meeting_link,
        email_1_poslat      = NEW.email_1_poslat,
        email_2_poslat      = NEW.email_2_poslat,
        email_3_poslat      = NEW.email_3_poslat,
        email_4_poslat      = NEW.email_4_poslat,
        email_5_poslat      = NEW.email_5_poslat,
        email_6_poslat      = NEW.email_6_poslat,
        email_7_poslat      = NEW.email_7_poslat,
        email_8_poslat      = NEW.email_8_poslat,
        nurture_2_poslat    = NEW.nurture_2_poslat,
        intake_nudge_poslat = NEW.intake_nudge_poslat,
        updated_at          = NOW()
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kontakti_update
INSTEAD OF UPDATE ON kontakti
FOR EACH ROW
EXECUTE FUNCTION instead_of_update_kontakti();
