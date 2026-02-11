-- Seed script for client_modules
-- This script adds modules to existing clients

-- IMPORTANT: Replace the email addresses below with your actual client emails

-- 1. Add core modules to ALL existing clients
-- These modules should be available to everyone
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

-- 2. Add Social Media modules to the youth employment client
-- Replace 'youth-employment@example.com' with the actual email
-- Example:
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

-- INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order)
-- SELECT
--   id,
--   'social-candidates',
--   true,
--   'Kandidati',
--   6
-- FROM clients
-- WHERE email = 'youth-employment@example.com'
-- ON CONFLICT (client_id, module_key) DO NOTHING;

-- 3. Add LinkedIn and other modules to your agency account
-- Replace 'agency@example.com' with your agency email
-- Example:
-- INSERT INTO client_modules (client_id, module_key, is_enabled, sort_order)
-- SELECT
--   id,
--   'linkedin-agent',
--   true,
--   7
-- FROM clients
-- WHERE email = 'agency@example.com'
-- ON CONFLICT (client_id, module_key) DO NOTHING;

-- 4. To add a new module to a specific client, use:
-- INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, settings, sort_order)
-- VALUES (
--   'CLIENT_UUID_HERE',
--   'linkedin-agent',
--   true,
--   'LinkedIn Automation',
--   '{"workflow_id": "n8n_workflow_123"}',
--   7
-- )
-- ON CONFLICT (client_id, module_key) DO UPDATE SET
--   is_enabled = EXCLUDED.is_enabled,
--   display_name = EXCLUDED.display_name,
--   settings = EXCLUDED.settings,
--   sort_order = EXCLUDED.sort_order;

-- 5. To view all modules for a client:
-- SELECT cm.*, c.name as client_name, c.email
-- FROM client_modules cm
-- JOIN clients c ON c.id = cm.client_id
-- WHERE c.email = 'your-email@example.com'
-- ORDER BY cm.sort_order;

-- 6. To disable a module for a client:
-- UPDATE client_modules
-- SET is_enabled = false
-- WHERE client_id = (SELECT id FROM clients WHERE email = 'client@example.com')
-- AND module_key = 'module-to-disable';
