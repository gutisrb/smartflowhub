-- =====================================================
-- OZ AVALA LINKEDIN MEGA WORKFLOW - SUPABASE MIGRATION
-- =====================================================
-- Database: AI Growth Agency (ndazbdkytcksmhoabtgs)
-- Client: Omladinska zadruga Avala (OZ Avala)
-- Date: February 16, 2026
-- =====================================================

-- =====================================================
-- 1. CREATE JOBS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS oz_avala_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Job Information
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_url TEXT UNIQUE NOT NULL,
  location TEXT,
  posted_date TIMESTAMP,
  job_description TEXT,
  job_description_preview TEXT, -- First 1500 chars for display
  company_linkedin_url TEXT,
  salary_info TEXT,

  -- Workflow Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'processing', 'completed', 'failed')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Multi-tenancy
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON oz_avala_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON oz_avala_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON oz_avala_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON oz_avala_jobs(company_name);

-- Enable RLS (Row Level Security)
ALTER TABLE oz_avala_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their client's jobs
CREATE POLICY "Users can view their client's jobs"
  ON oz_avala_jobs
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
    )
  );

COMMENT ON TABLE oz_avala_jobs IS 'LinkedIn job postings scraped for OZ Avala lead generation';

-- =====================================================
-- 2. EXTEND KONTAKTI TABLE FOR LINKEDIN LEADS
-- =====================================================

-- Add LinkedIn-specific columns to existing kontakti table
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS job_url TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS linkedin_username TEXT;

-- Profile Enrichment Data
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS profile_about TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS profile_headline TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS profile_country TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS profile_language TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS profile_education TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS current_position TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS current_company TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS company_industry TEXT;

-- Recent Posts Summary
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS recent_posts_summary TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS last_post_date TIMESTAMP;

-- Psychographic Analysis
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS communication_style TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS personality_traits TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS key_motivators TEXT;

-- Outreach Data
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS personalized_message TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS message_language TEXT DEFAULT 'sr'; -- Serbian
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS relevance_score INTEGER;

-- Status Tracking
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'new'
  CHECK (enrichment_status IN ('new', 'enriching', 'enriched', 'ready_to_send', 'approved', 'sent', 'responded', 'failed'));
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS message_sent_at TIMESTAMP;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS message_responded_at TIMESTAMP;

-- Failure Handling
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS last_enrichment_error TEXT;

-- Indexes for LinkedIn workflow
CREATE INDEX IF NOT EXISTS idx_kontakti_enrichment_status ON kontakti(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_kontakti_linkedin_url ON kontakti(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_kontakti_email ON kontakti(email);
CREATE INDEX IF NOT EXISTS idx_kontakti_relevance_score ON kontakti(relevance_score DESC);

COMMENT ON COLUMN kontakti.enrichment_status IS 'LinkedIn enrichment pipeline status';
COMMENT ON COLUMN kontakti.personalized_message IS 'AI-generated personalized outreach message';
COMMENT ON COLUMN kontakti.relevance_score IS 'Lead quality score based on title, location, and email verification';

-- =====================================================
-- 3. CREATE OZ AVALA CLIENT ENTRY (IF NOT EXISTS)
-- =====================================================

-- Insert OZ Avala client (update email as needed)
INSERT INTO clients (ime, email, created_at)
VALUES ('Omladinska zadruga Avala', 'ozavala@example.com', NOW())
ON CONFLICT (email) DO NOTHING;

-- Get the client_id for reference
DO $$
DECLARE
  oz_avala_client_id UUID;
BEGIN
  SELECT id INTO oz_avala_client_id FROM clients WHERE email = 'ozavala@example.com';
  RAISE NOTICE 'OZ Avala Client ID: %', oz_avala_client_id;
END $$;

-- =====================================================
-- 4. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function: Update timestamp on record modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on oz_avala_jobs
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON oz_avala_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at on kontakti (if not already exists)
DROP TRIGGER IF EXISTS update_kontakti_updated_at ON kontakti;
CREATE TRIGGER update_kontakti_updated_at
  BEFORE UPDATE ON kontakti
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. CREATE VIEWS FOR MONITORING
-- =====================================================

-- View: Lead pipeline summary
CREATE OR REPLACE VIEW oz_avala_lead_pipeline AS
SELECT
  client_id,
  enrichment_status,
  COUNT(*) as count,
  AVG(relevance_score) as avg_score,
  MAX(created_at) as last_created,
  MAX(updated_at) as last_updated
FROM kontakti
WHERE client_id IN (SELECT id FROM clients WHERE email = 'ozavala@example.com')
GROUP BY client_id, enrichment_status;

COMMENT ON VIEW oz_avala_lead_pipeline IS 'Real-time lead enrichment pipeline status for OZ Avala';

-- View: Job discovery summary
CREATE OR REPLACE VIEW oz_avala_job_summary AS
SELECT
  client_id,
  status,
  COUNT(*) as count,
  MAX(posted_date) as latest_job_date,
  MAX(created_at) as last_scraped
FROM oz_avala_jobs
GROUP BY client_id, status;

COMMENT ON VIEW oz_avala_job_summary IS 'Job scraping status summary for OZ Avala';

-- View: Ready to send leads (for dashboard)
CREATE OR REPLACE VIEW oz_avala_ready_leads AS
SELECT
  k.id,
  k.ime || ' ' || k.prezime as full_name,
  k.email,
  k.company,
  k.job_title,
  k.linkedin_url,
  k.personalized_message,
  k.relevance_score,
  k.profile_headline,
  k.created_at,
  k.updated_at
FROM kontakti k
WHERE k.enrichment_status = 'ready_to_send'
  AND k.client_id IN (SELECT id FROM clients WHERE email = 'ozavala@example.com')
ORDER BY k.relevance_score DESC, k.updated_at DESC;

COMMENT ON VIEW oz_avala_ready_leads IS 'Leads with generated messages ready for manual review and sending';

-- =====================================================
-- 6. SAMPLE QUERIES FOR MONITORING
-- =====================================================

-- Query: Check pipeline status
-- SELECT * FROM oz_avala_lead_pipeline;

-- Query: Get ready-to-send leads
-- SELECT * FROM oz_avala_ready_leads LIMIT 10;

-- Query: Find failed enrichments (retry candidates)
-- SELECT id, ime, prezime, linkedin_url, last_enrichment_error
-- FROM kontakti
-- WHERE enrichment_status = 'failed'
--   AND enrichment_attempts < 3
--   AND client_id IN (SELECT id FROM clients WHERE email = 'ozavala@example.com');

-- Query: Recent jobs scraped
-- SELECT company_name, job_title, location, posted_date, created_at
-- FROM oz_avala_jobs
-- WHERE created_at > NOW() - INTERVAL '7 days'
-- ORDER BY created_at DESC
-- LIMIT 20;

-- Query: Top scoring leads
-- SELECT
--   ime || ' ' || prezime as name,
--   company,
--   job_title,
--   relevance_score,
--   enrichment_status
-- FROM kontakti
-- WHERE client_id IN (SELECT id FROM clients WHERE email = 'ozavala@example.com')
-- ORDER BY relevance_score DESC
-- LIMIT 10;

-- =====================================================
-- 7. RESET FAILED ENRICHMENTS (MAINTENANCE QUERY)
-- =====================================================

-- Reset failed enrichments to 'new' for retry
-- Run this weekly or as needed
--
-- UPDATE kontakti
-- SET
--   enrichment_status = 'new',
--   enrichment_attempts = enrichment_attempts + 1,
--   last_enrichment_error = NULL
-- WHERE enrichment_status = 'failed'
--   AND enrichment_attempts < 3
--   AND client_id IN (SELECT id FROM clients WHERE email = 'ozavala@example.com');

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON oz_avala_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON kontakti TO authenticated;

-- Grant access to service role (for n8n workflows)
GRANT ALL ON oz_avala_jobs TO service_role;
GRANT ALL ON kontakti TO service_role;

-- Grant access to views
GRANT SELECT ON oz_avala_lead_pipeline TO authenticated;
GRANT SELECT ON oz_avala_job_summary TO authenticated;
GRANT SELECT ON oz_avala_ready_leads TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Run this query to verify setup:
SELECT
  'oz_avala_jobs' as table_name,
  COUNT(*) as record_count,
  MAX(created_at) as last_record
FROM oz_avala_jobs
WHERE client_id IN (SELECT id FROM clients WHERE email = 'ozavala@example.com')

UNION ALL

SELECT
  'kontakti (linkedin leads)' as table_name,
  COUNT(*) as record_count,
  MAX(created_at) as last_record
FROM kontakti
WHERE enrichment_status IS NOT NULL
  AND client_id IN (SELECT id FROM clients WHERE email = 'ozavala@example.com');

-- Expected output: Both tables should show 0 records initially
-- After running the workflow, you should see data populating

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Update 'ozavala@example.com' with the actual OZ Avala client email
-- 2. Save the client_id UUID for use in n8n workflow nodes
-- 3. Test with small batches first (5-10 jobs)
-- 4. Monitor views regularly: oz_avala_lead_pipeline, oz_avala_ready_leads
-- 5. Set up Supabase realtime subscriptions for dashboard updates
-- =====================================================