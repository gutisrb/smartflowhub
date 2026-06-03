-- Onboarding tour: gating + per-brand copy
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarded_at    timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_copy jsonb;

-- Treat all EXISTING clients as already onboarded so live clients (OZ Avala,
-- Harmonija, etc.) never get a surprise tour. Only rows created AFTER this
-- migration (new demo tenants) keep onboarded_at = NULL and get the tour.
UPDATE clients SET onboarded_at = now() WHERE onboarded_at IS NULL;
