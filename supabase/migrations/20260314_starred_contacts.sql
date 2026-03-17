-- Add starred flag to contacts for manual lead curation
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;
