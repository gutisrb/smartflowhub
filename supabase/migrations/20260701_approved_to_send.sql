-- Operator cockpit: approve-to-send gate. Drafts are approved in the dashboard UI;
-- send_outreach.mjs --mode approved is the only thing that actually sends email.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS approved_to_send boolean NOT NULL DEFAULT false;
