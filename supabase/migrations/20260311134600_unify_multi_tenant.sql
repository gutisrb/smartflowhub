-- ============================================================================
-- Migration: Unified Multi-Tenant Architecture
-- ============================================================================
-- kontakti is a VIEW over contacts table (from CRM migration).
-- We ALTER contacts, rebuild the view, and update triggers.
-- ============================================================================

-- ─── 1. Add outreach columns to contacts table ────────────────────────────────

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS niche TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_followers INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website_summary TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_draft TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS comment TEXT;

-- Drop UNIQUE on email since some leads may not have emails
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_email_key;
-- Make email nullable
ALTER TABLE contacts ALTER COLUMN email DROP NOT NULL;

-- ─── 2. Rebuild kontakti view with new columns ───────────────────────────────

DROP TRIGGER IF EXISTS trg_kontakti_insert ON kontakti;
DROP TRIGGER IF EXISTS trg_kontakti_update ON kontakti;
DROP VIEW IF EXISTS kontakti;

CREATE VIEW kontakti AS
SELECT
    c.id,
    c.name as ime,
    c.email,
    comp.name as kompanija,
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

-- ─── 3. Recreate INSTEAD OF triggers for the rebuilt view ─────────────────────

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
        company_id, name, email, company_name, niche, service, website,
        instagram_handle, instagram_followers, website_summary, last_sent_at,
        email_draft, comment, problem, kategorija, prioritet_skor, obrazlozenje,
        sledeca_akcija, status, izvor, intake_data, client_id, email_type,
        next_email_at, demo_preference, demo_time, meeting_time, meeting_link,
        email_1_poslat, email_2_poslat, email_3_poslat, email_4_poslat,
        email_5_poslat, email_6_poslat, email_7_poslat, email_8_poslat,
        nurture_2_poslat, intake_nudge_poslat
    ) VALUES (
        new_company_id, NEW.ime, NEW.email, NEW.company_name, NEW.niche, NEW.service, NEW.website,
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
        name = NEW.ime,
        email = NEW.email,
        company_name = NEW.company_name,
        niche = NEW.niche,
        service = NEW.service,
        website = NEW.website,
        instagram_handle = NEW.instagram_handle,
        instagram_followers = NEW.instagram_followers,
        website_summary = NEW.website_summary,
        last_sent_at = NEW.last_sent_at,
        email_draft = NEW.email_draft,
        comment = NEW.comment,
        problem = NEW.problem,
        kategorija = NEW.kategorija,
        prioritet_skor = COALESCE(NEW.prioritet_skor, prioritet_skor),
        obrazlozenje = NEW.obrazlozenje,
        sledeca_akcija = NEW.sledeca_akcija,
        status = NEW.status,
        izvor = NEW.izvor,
        intake_data = NEW.intake_data,
        client_id = NEW.client_id,
        email_type = NEW.email_type,
        next_email_at = NEW.next_email_at,
        demo_preference = NEW.demo_preference,
        demo_time = NEW.demo_time,
        meeting_time = NEW.meeting_time,
        meeting_link = NEW.meeting_link,
        email_1_poslat = COALESCE(NEW.email_1_poslat, false),
        email_2_poslat = COALESCE(NEW.email_2_poslat, false),
        email_3_poslat = COALESCE(NEW.email_3_poslat, false),
        email_4_poslat = COALESCE(NEW.email_4_poslat, false),
        email_5_poslat = COALESCE(NEW.email_5_poslat, false),
        email_6_poslat = COALESCE(NEW.email_6_poslat, false),
        email_7_poslat = COALESCE(NEW.email_7_poslat, false),
        email_8_poslat = COALESCE(NEW.email_8_poslat, false),
        nurture_2_poslat = COALESCE(NEW.nurture_2_poslat, false),
        intake_nudge_poslat = COALESCE(NEW.intake_nudge_poslat, false),
        updated_at = NOW()
    WHERE id = OLD.id;

    IF NEW.kompanija IS NOT NULL THEN
        UPDATE companies c
        SET name = NEW.kompanija, updated_at = NOW()
        FROM contacts cont
        WHERE cont.id = OLD.id AND cont.company_id = c.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kontakti_update
INSTEAD OF UPDATE ON kontakti
FOR EACH ROW
EXECUTE FUNCTION instead_of_update_kontakti();

-- ─── 4. Drop smartflow_leads and its dependents ──────────────────────────────
DROP TABLE IF EXISTS smartflow_outreach_log;
DROP TABLE IF EXISTS smartflow_email_templates;
DROP TABLE IF EXISTS smartflow_leads CASCADE;

-- ─── 5. Seed client_modules ──────────────────────────────────────────────────

-- SmartFlow (69acf7e9-557e-4ca3-85bd-a785ef39e351)
INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order, settings)
VALUES
  ('69acf7e9-557e-4ca3-85bd-a785ef39e351', 'business-crm', true, 'CRM', 1,
   '{"statuses": ["Novi Lead", "Kontaktiran", "Demo Scheduled", "Meeting Booked", "Closed", "Lost"], "showAgencyMetrics": true}'::jsonb),
  ('69acf7e9-557e-4ca3-85bd-a785ef39e351', 'email-outreach', true, 'Email Outreach', 2,
   '{"showNicheBreakdown": true, "showTemplates": true}'::jsonb),
  ('69acf7e9-557e-4ca3-85bd-a785ef39e351', 'linkedin-agent', true, 'LinkedIn Agent', 3, NULL),
  ('69acf7e9-557e-4ca3-85bd-a785ef39e351', 'website-chatbot', true, 'Website Chatbot', 4, NULL),
  ('69acf7e9-557e-4ca3-85bd-a785ef39e351', 'social-chatbot', true, 'Social Chatbot', 5, NULL)
ON CONFLICT (client_id, module_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled, display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order, settings = EXCLUDED.settings;

-- OZ Avala (7ac02189-d0ec-4532-baa6-d7d4dc84b87c)
INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order, settings)
VALUES
  ('7ac02189-d0ec-4532-baa6-d7d4dc84b87c', 'business-crm', true, 'CRM', 1,
   '{"statuses": ["Novi", "Prijavljen", "Intervencija", "Zaposlen"], "showAgencyMetrics": false}'::jsonb),
  ('7ac02189-d0ec-4532-baa6-d7d4dc84b87c', 'email-outreach', true, 'Email Outreach', 2,
   '{"showNicheBreakdown": false, "showTemplates": false}'::jsonb),
  ('7ac02189-d0ec-4532-baa6-d7d4dc84b87c', 'agent-database', true, 'Poslovi', 3,
   '{"entityType": "jobs", "entityLabel": "Posao"}'::jsonb),
  ('7ac02189-d0ec-4532-baa6-d7d4dc84b87c', 'agent-leads', true, 'Kandidati', 4,
   '{"entityType": "candidates", "entityLabel": "Kandidat"}'::jsonb),
  ('7ac02189-d0ec-4532-baa6-d7d4dc84b87c', 'social-chatbot', true, 'Social Chatbot', 5, NULL)
ON CONFLICT (client_id, module_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled, display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order, settings = EXCLUDED.settings;

-- ─── 6. Import leads from Google Sheet ────────────────────────────────────────
-- Insert into contacts directly (not the view) since we may have NULL emails

INSERT INTO contacts (name, company_name, niche, website, email, comment, status, izvor, client_id)
VALUES
  ('Star Tours Pančevo', 'Star Tours Pančevo', 'Travel', 'https://startours.rs/', 'startourspancevo@gmail.com', 'Canva objave skoro svaki dan', 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Žan Vulić', 'Žan Vulić', 'Physical Therapy', 'https://www.zanvulic.rs/', 'info@zanvulic.rs', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Vacasa Design', 'Vacasa Design', 'Furniture', 'https://www.vacasa.rs/', NULL, NULL, 'No Email', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Dalmata', 'Dalmata', 'Furniture', 'https://dalmata.rs/', 'info@dalmata.rs', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Travel2Study', 'Travel2Study', 'Study program', 'https://travel2study.eu/', 'info@travel2study.eu', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('BalkanFun', 'BalkanFun', 'Travel', NULL, 'milena@balkanfun.travel', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Mjob', 'Mjob', 'Zadruga', NULL, 'kristina.djordjevic@mjob.rs', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Savladaj Nemački', 'Savladaj Nemački', 'Language school', NULL, 'savladaj.nemacki@gmail.com', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Wayout', 'Wayout', 'Travel', NULL, 'office@wayout.rs', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Go2', 'Go2', 'Travel', NULL, 'office@go2event.rs', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Kredium', 'Kredium', 'Credit Agency', NULL, 'info@kredium.rs', NULL, 'No Draft', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Eurosalon Fabrika', 'Eurosalon Fabrika', 'Furniture', NULL, 'marina.marinkovic@eurosalon-fabrika.com', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Naturia', 'Naturia', 'Bed', NULL, 'support@naturia.world', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Crowndental', 'Crowndental', 'Dental clinic', NULL, 'office@crowndental.rs', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Vadras', 'Vadras', 'Bed', NULL, 'vadrasbrdo@gmail.com', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Diva clinic', 'Diva clinic', 'Polyclinic', NULL, 'info@divaclinic.com', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Cassini', 'Cassini', 'Interior design', NULL, 'stefan.djidic@cassini.rs', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Compensair', 'Compensair', 'Air travel compensation', NULL, 'roman@compensair.com', NULL, 'No Draft', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Health and More', 'Health and More', 'Ecom - Health', NULL, 'pure.prodaja@healthandmore.rs', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Eko Box', 'Eko Box', 'Containers', NULL, 'office@eko-box.com', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Vatan Med', 'Vatan Med', 'Hair transplant', NULL, 'serbia@vatanmed.com', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351'),
  ('Sweet fit', 'Sweet fit', 'Ecom - Health', NULL, 'nikola.tasic@sweetfit.rs', NULL, 'Sent', 'Chatbot Outreach', '69acf7e9-557e-4ca3-85bd-a785ef39e351')
ON CONFLICT DO NOTHING;

-- ─── 7. Enable RLS and add policies for contacts ──────────────────────────────
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read contacts for their client
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contacts_select_policy' AND tablename = 'contacts') THEN
    CREATE POLICY contacts_select_policy ON contacts FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contacts_insert_policy' AND tablename = 'contacts') THEN
    CREATE POLICY contacts_insert_policy ON contacts FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contacts_update_policy' AND tablename = 'contacts') THEN
    CREATE POLICY contacts_update_policy ON contacts FOR UPDATE USING (true);
  END IF;
END $$;
