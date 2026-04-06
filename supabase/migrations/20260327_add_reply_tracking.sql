-- Reply tracking columns for SmartFlow outreach contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_snippet TEXT,
  ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;

-- View recreation moved to 20260330_add_email_2_draft.sql to avoid id_razgovora error
-- (id_razgovora only exists in the OZ Avala contacts table, not SmartFlow contacts)
