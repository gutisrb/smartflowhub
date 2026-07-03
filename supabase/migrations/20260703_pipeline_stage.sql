-- Cockpit operating machine: explicit pipeline stage per lead (the clean spine).
-- A lead is in exactly one stage; acting on it moves it to the next, so nothing
-- lingers in the cockpit. Replaces deriving stage from tangled legacy `status`.
--   novi          — sourced + qualified, awaiting approve/discard
--   demo_building — approved, demo build in progress
--   email_ready   — demo built + email drafted, awaiting send-approval
--   sent          — email sent, tracking
--   replied       — warm reply, needs handling
--   booked        — meeting booked
--   discarded     — rejected at the novi gate
--   archived      — old cold pile, out of the daily view (kept, not deleted)
--   lost          — dead
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pipeline_stage text;
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline_stage ON contacts (client_id, pipeline_stage);
