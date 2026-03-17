-- Add facebook_page_id for deduplication of Meta Ads scrape leads
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;

-- Drop partial index if it exists from a previous attempt
DROP INDEX IF EXISTS contacts_client_facebook_page_id_key;

-- PostgREST on_conflict requires a proper UNIQUE CONSTRAINT (not just an index)
-- PostgreSQL allows multiple NULLs in UNIQUE constraints, so non-scraped rows are unaffected
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_client_facebook_page_id_key,
  ADD CONSTRAINT contacts_client_facebook_page_id_key UNIQUE (client_id, facebook_page_id);
