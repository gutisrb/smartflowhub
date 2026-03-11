-- Phase 1 CRM Migration: Relational Schema & Backward-Compatible View

-- 1. Create pipeline_stages table
CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default stages based on existing kontakti statuses
INSERT INTO pipeline_stages (name, sort_order) VALUES
    ('Lead', 10),
    ('Contacted', 20),
    ('Qualified', 30),
    ('Nurturing', 40),
    ('Meeting Booked', 50),
    ('Closed Won', 60),
    ('Closed Lost', 70);

-- 2. Create companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    industry TEXT,
    location TEXT,
    size TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    linkedin_url TEXT,
    role TEXT,
    status TEXT DEFAULT 'Lead', -- Can be linked to pipeline_stages name for simplicity or use stage_id
    email_type TEXT,
    next_email_at TIMESTAMP WITH TIME ZONE,
    demo_preference TEXT,
    demo_time TIMESTAMP WITH TIME ZONE,
    meeting_time TIMESTAMP WITH TIME ZONE,
    meeting_link TEXT,
    intake_data JSONB,
    problem TEXT,
    kategorija TEXT,
    prioritet_skor INTEGER,
    obrazlozenje TEXT,
    sledeca_akcija TEXT,
    izvor TEXT,
    client_id TEXT,
    -- Email tracking flags (legacy n8n fields)
    email_1_poslat BOOLEAN DEFAULT false,
    email_2_poslat BOOLEAN DEFAULT false,
    email_3_poslat BOOLEAN DEFAULT false,
    email_4_poslat BOOLEAN DEFAULT false,
    email_5_poslat BOOLEAN DEFAULT false,
    email_6_poslat BOOLEAN DEFAULT false,
    email_7_poslat BOOLEAN DEFAULT false,
    email_8_poslat BOOLEAN DEFAULT false,
    nurture_2_poslat BOOLEAN DEFAULT false,
    intake_nudge_poslat BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create interactions table
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'Email Sent', 'Note', 'Meeting Booked'
    description TEXT,
    interaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Rename legacy table to preserve data during transition
ALTER TABLE kontakti RENAME TO kontakti_legacy;

-- 6. Create the backward-compatible View for n8n
-- This view exposes the contacts table exactly as the old kontakti table looked.
CREATE VIEW kontakti AS
SELECT
    c.id,
    c.name as ime,
    c.email,
    comp.name as kompanija,
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

-- 7. Create INSTEAD OF triggers so n8n can INSERT/UPDATE the view

-- Function to handle inserts into the kontakti view
CREATE OR REPLACE FUNCTION instead_of_insert_kontakti()
RETURNS TRIGGER AS $$
DECLARE
    new_company_id UUID;
    existing_contact_id UUID;
BEGIN
    -- Only create a company if a name is provided and we are actually creating a new contact
    IF NEW.kompanija IS NOT NULL THEN
        INSERT INTO companies (name) VALUES (NEW.kompanija)
        RETURNING id INTO new_company_id;
    END IF;

    -- Upsert contact logic (n8n might insert the same email twice, which is bad, but we handle it)
    INSERT INTO contacts (
        company_id, name, email, problem, kategorija, prioritet_skor, obrazlozenje, sledeca_akcija,
        status, izvor, intake_data, client_id, email_type, next_email_at, demo_preference,
        demo_time, meeting_time, meeting_link, email_1_poslat, email_2_poslat, email_3_poslat,
        email_4_poslat, email_5_poslat, email_6_poslat, email_7_poslat, email_8_poslat,
        nurture_2_poslat, intake_nudge_poslat
    ) VALUES (
        new_company_id, NEW.ime, NEW.email, NEW.problem, NEW.kategorija, COALESCE(NEW.prioritet_skor, 0), NEW.obrazlozenje, NEW.sledeca_akcija,
        COALESCE(NEW.status, 'Lead'), NEW.izvor, NEW.intake_data, NEW.client_id, NEW.email_type, NEW.next_email_at, NEW.demo_preference,
        NEW.demo_time, NEW.meeting_time, NEW.meeting_link, COALESCE(NEW.email_1_poslat, false), COALESCE(NEW.email_2_poslat, false), COALESCE(NEW.email_3_poslat, false),
        COALESCE(NEW.email_4_poslat, false), COALESCE(NEW.email_5_poslat, false), COALESCE(NEW.email_6_poslat, false), COALESCE(NEW.email_7_poslat, false), COALESCE(NEW.email_8_poslat, false),
        COALESCE(NEW.nurture_2_poslat, false), COALESCE(NEW.intake_nudge_poslat, false)
    )
    ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        problem = EXCLUDED.problem,
        kategorija = EXCLUDED.kategorija,
        prioritet_skor = EXCLUDED.prioritet_skor,
        obrazlozenje = EXCLUDED.obrazlozenje,
        sledeca_akcija = EXCLUDED.sledeca_akcija,
        status = EXCLUDED.status,
        email_type = EXCLUDED.email_type,
        next_email_at = EXCLUDED.next_email_at,
        demo_preference = EXCLUDED.demo_preference,
        demo_time = EXCLUDED.demo_time,
        meeting_time = EXCLUDED.meeting_time,
        meeting_link = EXCLUDED.meeting_link,
        email_1_poslat = EXCLUDED.email_1_poslat,
        email_2_poslat = EXCLUDED.email_2_poslat,
        email_3_poslat = EXCLUDED.email_3_poslat,
        email_4_poslat = EXCLUDED.email_4_poslat,
        email_5_poslat = EXCLUDED.email_5_poslat,
        email_6_poslat = EXCLUDED.email_6_poslat,
        email_7_poslat = EXCLUDED.email_7_poslat,
        email_8_poslat = EXCLUDED.email_8_poslat,
        nurture_2_poslat = EXCLUDED.nurture_2_poslat,
        intake_nudge_poslat = EXCLUDED.intake_nudge_poslat,
        updated_at = NOW();

    -- In a real scenario, returning NEW is required for INSTEAD OF INSERT triggers
    -- We need to fetch the actual generated ID if it was an insert
    SELECT id INTO NEW.id FROM contacts WHERE email = NEW.email;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kontakti_insert
INSTEAD OF INSERT ON kontakti
FOR EACH ROW
EXECUTE FUNCTION instead_of_insert_kontakti();

-- Function to handle updates to the kontakti view (mostly n8n updating status/email_type by email)
CREATE OR REPLACE FUNCTION instead_of_update_kontakti()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contacts SET
        name = NEW.ime,
        email = NEW.email,
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

    -- Update company name if provided and linked
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

-- Allow users in Supabase Studio or frontend to fetch this view securely (assuming RLS is needed later)
-- Grant access to authenticated and anon (adjust based on your existing kontakti RLS policies)
-- GRANT SELECT, INSERT, UPDATE ON kontakti TO anon, authenticated, service_role;
