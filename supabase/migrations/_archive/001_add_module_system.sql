-- Add language column to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Create client_modules table
CREATE TABLE IF NOT EXISTS client_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  display_name TEXT,
  settings JSONB,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, module_key)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_client_modules_client_id ON client_modules(client_id);
CREATE INDEX IF NOT EXISTS idx_client_modules_enabled ON client_modules(client_id, is_enabled);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_modules_updated_at
  BEFORE UPDATE ON client_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default core modules for existing clients
-- This will give all existing clients access to core modules
INSERT INTO client_modules (client_id, module_key, is_enabled, sort_order)
SELECT
  c.id,
  module_key,
  true,
  sort_order
FROM clients c
CROSS JOIN (
  VALUES
    ('business-crm', 1),
    ('email-outreach', 2),
    ('analytics', 3),
    ('settings', 4)
) AS modules(module_key, sort_order)
ON CONFLICT (client_id, module_key) DO NOTHING;

-- For the first client (assuming it's the youth employment client),
-- also add the social media modules
-- You'll need to replace 'YOUR_CLIENT_EMAIL' with the actual client email
-- Example seed for a specific client:
-- INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order)
-- SELECT
--   id,
--   'social-jobs',
--   true,
--   'Poslovi',
--   5
-- FROM clients
-- WHERE email = 'youth-employment@example.com'
-- ON CONFLICT (client_id, module_key) DO NOTHING;

-- Add RLS policies (if RLS is enabled)
ALTER TABLE client_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client modules"
  ON client_modules FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Users can update their own client modules"
  ON client_modules FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt()->>'email'
    )
  );
