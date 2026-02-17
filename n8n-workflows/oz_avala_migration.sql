-- =====================================================
-- OZ AVALA LINKEDIN + EMAIL OUTREACH - DATABASE MIGRATION
-- =====================================================
-- Client: Omladinska zadruga Avala (Miloš Mitić)
-- Purpose: LinkedIn content + connections + cold email outreach
-- Date: February 16, 2026
-- =====================================================

-- =====================================================
-- 1. CREATE LINKEDIN CONTENT TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS linkedin_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content
  post_text TEXT NOT NULL,
  post_theme TEXT, -- e.g. "gen z workers", "construction hiring", "youth employment"
  post_type TEXT DEFAULT 'original' CHECK (post_type IN ('original', 'inspired', 'trending')),
  source_url TEXT, -- if inspired by another post

  -- AI Metadata
  engagement_score INTEGER, -- 1-10 rating from Gemini
  target_audience TEXT, -- "company owners", "HR managers", etc.

  -- Workflow Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'failed')),
  scheduled_for TIMESTAMP,
  published_at TIMESTAMP,

  -- Metadata
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_linkedin_content_status ON linkedin_content(status, client_id);
CREATE INDEX idx_linkedin_content_scheduled ON linkedin_content(scheduled_for) WHERE status = 'scheduled';

COMMENT ON TABLE linkedin_content IS 'Generated LinkedIn posts for OZ Avala - 2x per week';

-- =====================================================
-- 2. CREATE POSTED TOPICS TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS linkedin_posted_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Topic Tracking
  topic_keyword TEXT NOT NULL, -- main theme/keyword
  topic_variations TEXT[], -- similar topics to avoid
  post_id UUID REFERENCES linkedin_content(id) ON DELETE CASCADE,

  -- Metadata
  posted_at TIMESTAMP DEFAULT NOW(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX idx_posted_topics_keyword ON linkedin_posted_topics(topic_keyword, client_id);
CREATE INDEX idx_posted_topics_date ON linkedin_posted_topics(posted_at DESC);

COMMENT ON TABLE linkedin_posted_topics IS 'Prevents duplicate content themes';

-- =====================================================
-- 3. EXTEND KONTAKTI TABLE FOR LINKEDIN + EMAIL
-- =====================================================

-- Lead Source & Outreach Type
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS lead_source TEXT
  CHECK (lead_source IN ('linkedin_connection', 'cold_email', 'inbound_dm', 'post_engagement', 'apollo', 'phantombuster'));

ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS outreach_channel TEXT
  CHECK (outreach_channel IN ('email', 'linkedin', 'both'));

-- LinkedIn Data
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS linkedin_profile_json JSONB;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS linkedin_recent_posts TEXT; -- summary of last 3 posts
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS connection_message TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS connection_sent_at TIMESTAMP;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS connection_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS connection_reply TEXT;

-- Cold Email Data
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS cold_email_subject TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS cold_email_body TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_opened BOOLEAN DEFAULT FALSE;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_replied BOOLEAN DEFAULT FALSE;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_reply_text TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_reply_sentiment TEXT
  CHECK (email_reply_sentiment IN ('positive', 'negative', 'neutral'));

-- Enrichment Data
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS company_industry TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS decision_maker_score INTEGER; -- 1-10 relevance
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS enrichment_source TEXT; -- 'apollo', 'linkfinder', 'phantombuster'

-- Campaign Tracking
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS campaign_name TEXT; -- e.g. "Construction Q1 2026"
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS instantly_campaign_id TEXT; -- Instantly.ai campaign ID

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_kontakti_lead_source ON kontakti(lead_source, client_id);
CREATE INDEX IF NOT EXISTS idx_kontakti_outreach ON kontakti(outreach_channel, status, client_id);
CREATE INDEX IF NOT EXISTS idx_kontakti_email_sent ON kontakti(email_sent_at DESC) WHERE email_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kontakti_connection_sent ON kontakti(connection_sent_at DESC) WHERE connection_sent_at IS NOT NULL;

-- =====================================================
-- 4. CREATE EMAIL OUTREACH STATS VIEW
-- =====================================================

CREATE OR REPLACE VIEW email_outreach_stats AS
SELECT
  client_id,
  COUNT(*) FILTER (WHERE email_sent_at IS NOT NULL) as total_sent,
  COUNT(*) FILTER (WHERE email_opened = TRUE) as total_opened,
  COUNT(*) FILTER (WHERE email_replied = TRUE) as total_replied,
  COUNT(*) FILTER (WHERE email_reply_sentiment = 'positive') as positive_replies,
  COUNT(*) FILTER (WHERE status = 'Zainteresovan') as meetings_booked,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE email_opened = TRUE) /
    NULLIF(COUNT(*) FILTER (WHERE email_sent_at IS NOT NULL), 0),
    2
  ) as open_rate_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE email_replied = TRUE) /
    NULLIF(COUNT(*) FILTER (WHERE email_sent_at IS NOT NULL), 0),
    2
  ) as reply_rate_pct,
  DATE_TRUNC('day', email_sent_at) as date
FROM kontakti
WHERE lead_source = 'cold_email'
GROUP BY client_id, DATE_TRUNC('day', email_sent_at)
ORDER BY date DESC;

COMMENT ON VIEW email_outreach_stats IS 'Daily email outreach performance metrics';

-- =====================================================
-- 5. CREATE LINKEDIN OUTREACH STATS VIEW
-- =====================================================

CREATE OR REPLACE VIEW linkedin_outreach_stats AS
SELECT
  client_id,
  COUNT(*) FILTER (WHERE connection_sent_at IS NOT NULL) as total_connections_sent,
  COUNT(*) FILTER (WHERE connection_accepted = TRUE) as total_accepted,
  COUNT(*) FILTER (WHERE connection_reply IS NOT NULL) as total_replies,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE connection_accepted = TRUE) /
    NULLIF(COUNT(*) FILTER (WHERE connection_sent_at IS NOT NULL), 0),
    2
  ) as acceptance_rate_pct,
  DATE_TRUNC('day', connection_sent_at) as date
FROM kontakti
WHERE lead_source = 'linkedin_connection'
GROUP BY client_id, DATE_TRUNC('day', connection_sent_at)
ORDER BY date DESC;

COMMENT ON VIEW linkedin_outreach_stats IS 'Daily LinkedIn connection performance metrics';

-- =====================================================
-- 6. CREATE LEAD PIPELINE VIEW (FOR DASHBOARD)
-- =====================================================

CREATE OR REPLACE VIEW oz_avala_lead_pipeline AS
SELECT
  k.id,
  k.ime || ' ' || COALESCE(k.prezime, '') as full_name,
  k.email,
  k.telefon,
  k.kompanija as company,
  k.linkedin_url,
  k.lead_source,
  k.outreach_channel,
  k.status,
  k.decision_maker_score,

  -- LinkedIn specific
  k.connection_message,
  k.connection_sent_at,
  k.connection_accepted,

  -- Email specific
  k.cold_email_subject,
  k.email_sent_at,
  k.email_opened,
  k.email_replied,
  k.email_reply_sentiment,

  -- Metadata
  k.created_at,
  k.updated_at,
  k.client_id
FROM kontakti k
WHERE k.lead_source IN ('linkedin_connection', 'cold_email', 'phantombuster', 'apollo')
ORDER BY k.created_at DESC;

COMMENT ON VIEW oz_avala_lead_pipeline IS 'Unified lead pipeline for OZ Avala dashboard';

-- =====================================================
-- 7. GET OZ AVALA CLIENT ID
-- =====================================================

-- Find or create OZ Avala client
DO $$
DECLARE
  oz_avala_client_id UUID;
  oz_avala_email TEXT := 'milos@ozavala.rs'; -- Update with actual email
BEGIN
  -- Try to find existing client
  SELECT id INTO oz_avala_client_id
  FROM clients
  WHERE email = oz_avala_email;

  -- If not found, check by name
  IF oz_avala_client_id IS NULL THEN
    SELECT id INTO oz_avala_client_id
    FROM clients
    WHERE ime ILIKE '%avala%' OR ime ILIKE '%miloš%mitić%';
  END IF;

  -- If still not found, create
  IF oz_avala_client_id IS NULL THEN
    INSERT INTO clients (ime, email, created_at)
    VALUES ('Omladinska zadruga Avala', oz_avala_email, NOW())
    RETURNING id INTO oz_avala_client_id;

    RAISE NOTICE 'Created new OZ Avala client with ID: %', oz_avala_client_id;
  ELSE
    RAISE NOTICE 'Found existing OZ Avala client with ID: %', oz_avala_client_id;
  END IF;
END $$;

-- =====================================================
-- 8. CREATE HELPER FUNCTIONS
-- =====================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for linkedin_content
DROP TRIGGER IF EXISTS update_linkedin_content_updated_at ON linkedin_content;
CREATE TRIGGER update_linkedin_content_updated_at
  BEFORE UPDATE ON linkedin_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. SAMPLE QUERIES FOR DASHBOARD
-- =====================================================

-- Get OZ Avala client ID (run this first, save the UUID)
-- SELECT id, ime, email FROM clients WHERE ime ILIKE '%avala%' OR email ILIKE '%milos%';

-- Email outreach stats (last 7 days)
-- SELECT * FROM email_outreach_stats
-- WHERE client_id = '[OZ_AVALA_UUID]'
-- AND date > NOW() - INTERVAL '7 days';

-- LinkedIn connection stats (last 7 days)
-- SELECT * FROM linkedin_outreach_stats
-- WHERE client_id = '[OZ_AVALA_UUID]'
-- AND date > NOW() - INTERVAL '7 days';

-- All leads in pipeline
-- SELECT * FROM oz_avala_lead_pipeline
-- WHERE client_id = '[OZ_AVALA_UUID]'
-- ORDER BY created_at DESC
-- LIMIT 50;

-- Recent cold email leads awaiting response
-- SELECT full_name, company, email_sent_at, email_opened, status
-- FROM oz_avala_lead_pipeline
-- WHERE client_id = '[OZ_AVALA_UUID]'
-- AND lead_source = 'cold_email'
-- AND email_replied = FALSE
-- AND email_sent_at > NOW() - INTERVAL '7 days'
-- ORDER BY email_sent_at DESC;

-- LinkedIn connection acceptance rate (this month)
-- SELECT
--   COUNT(*) FILTER (WHERE connection_sent_at IS NOT NULL) as sent,
--   COUNT(*) FILTER (WHERE connection_accepted = TRUE) as accepted,
--   ROUND(100.0 * COUNT(*) FILTER (WHERE connection_accepted = TRUE) /
--         NULLIF(COUNT(*) FILTER (WHERE connection_sent_at IS NOT NULL), 0), 2) as rate
-- FROM kontakti
-- WHERE client_id = '[OZ_AVALA_UUID]'
-- AND lead_source = 'linkedin_connection'
-- AND connection_sent_at > DATE_TRUNC('month', NOW());

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON linkedin_content TO authenticated;
GRANT SELECT, INSERT, UPDATE ON linkedin_posted_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON kontakti TO authenticated;

GRANT ALL ON linkedin_content TO service_role;
GRANT ALL ON linkedin_posted_topics TO service_role;
GRANT ALL ON kontakti TO service_role;

GRANT SELECT ON email_outreach_stats TO authenticated;
GRANT SELECT ON linkedin_outreach_stats TO authenticated;
GRANT SELECT ON oz_avala_lead_pipeline TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify setup:
SELECT
  'linkedin_content' as table_name,
  COUNT(*) as record_count
FROM linkedin_content
WHERE client_id IN (SELECT id FROM clients WHERE ime ILIKE '%avala%')

UNION ALL

SELECT
  'kontakti (linkedin/email leads)' as table_name,
  COUNT(*) as record_count
FROM kontakti
WHERE lead_source IN ('linkedin_connection', 'cold_email')
AND client_id IN (SELECT id FROM clients WHERE ime ILIKE '%avala%');

-- Expected output: Both should show 0 records initially
-- After workflows run, you'll see data populate

RAISE NOTICE '✅ OZ Avala database migration complete!';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Save OZ Avala client_id UUID from clients table';
RAISE NOTICE '2. Import n8n workflows';
RAISE NOTICE '3. Update workflow nodes with client_id';
RAISE NOTICE '4. Deploy frontend components';