-- Add starred and facebook_page_id to kontakti view
-- DROP CASCADE required because CREATE OR REPLACE can't change column list
-- All INSTEAD OF triggers are recreated below unchanged except:
--   UPDATE trigger now also propagates starred and facebook_page_id

DROP VIEW IF EXISTS kontakti CASCADE;

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
    c.intake_nudge_poslat,
    c.starred,
    c.facebook_page_id
FROM contacts c
LEFT JOIN companies comp ON c.company_id = comp.id;

-- ─── INSTEAD OF INSERT ────────────────────────────────────────────────────────
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

-- ─── INSTEAD OF UPDATE ────────────────────────────────────────────────────────
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
        starred             = NEW.starred,
        facebook_page_id    = NEW.facebook_page_id,
        updated_at          = NOW()
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kontakti_update
INSTEAD OF UPDATE ON kontakti
FOR EACH ROW
EXECUTE FUNCTION instead_of_update_kontakti();
