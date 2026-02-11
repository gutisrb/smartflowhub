-- ============================================
-- QUICK REFERENCE: Module Management Queries
-- ============================================

-- 1. VIEW ALL CLIENTS AND THEIR EMAILS
-- Use this to find client emails for the queries below
SELECT id, name, email, created_at
FROM clients
ORDER BY created_at DESC;

-- 2. VIEW ALL MODULES FOR A SPECIFIC CLIENT
-- Replace 'CLIENT_EMAIL' with actual email
SELECT
  cm.module_key,
  cm.display_name,
  cm.is_enabled,
  cm.sort_order,
  cm.settings,
  c.name as client_name,
  c.email as client_email
FROM client_modules cm
JOIN clients c ON c.id = cm.client_id
WHERE c.email = 'CLIENT_EMAIL'
ORDER BY cm.sort_order;

-- 3. ADD CORE MODULES TO A NEW CLIENT
-- Run this when you create a new client
INSERT INTO client_modules (client_id, module_key, is_enabled, sort_order)
SELECT
  id,
  module_key,
  true,
  sort_order
FROM clients
CROSS JOIN (
  VALUES
    ('business-crm', 1),
    ('email-outreach', 2),
    ('analytics', 3),
    ('settings', 4)
) AS modules(module_key, sort_order)
WHERE email = 'NEW_CLIENT_EMAIL'
ON CONFLICT (client_id, module_key) DO NOTHING;

-- 4. ENABLE SOCIAL MEDIA MODULES (Youth Employment Client)
-- Job Postings with Serbian label
INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order)
SELECT id, 'social-jobs', true, 'Poslovi', 5
FROM clients WHERE email = 'CLIENT_EMAIL'
ON CONFLICT (client_id, module_key) DO UPDATE SET
  is_enabled = true, display_name = 'Poslovi';

-- Candidates with Serbian label
INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order)
SELECT id, 'social-candidates', true, 'Kandidati', 6
FROM clients WHERE email = 'CLIENT_EMAIL'
ON CONFLICT (client_id, module_key) DO UPDATE SET
  is_enabled = true, display_name = 'Kandidati';

-- 5. ENABLE LINKEDIN AGENT MODULE
INSERT INTO client_modules (client_id, module_key, is_enabled, sort_order)
SELECT id, 'linkedin-agent', true, 7
FROM clients WHERE email = 'CLIENT_EMAIL'
ON CONFLICT (client_id, module_key) DO UPDATE SET is_enabled = true;

-- 6. ENABLE WEBSITE CHATBOT MODULE
INSERT INTO client_modules (client_id, module_key, is_enabled, sort_order)
SELECT id, 'website-chatbot', true, 8
FROM clients WHERE email = 'CLIENT_EMAIL'
ON CONFLICT (client_id, module_key) DO UPDATE SET is_enabled = true;

-- 7. DISABLE A MODULE (without deleting)
UPDATE client_modules
SET is_enabled = false
WHERE client_id = (SELECT id FROM clients WHERE email = 'CLIENT_EMAIL')
AND module_key = 'MODULE_KEY';

-- 8. CHANGE MODULE DISPLAY NAME (Custom Label)
UPDATE client_modules
SET display_name = 'YOUR_CUSTOM_LABEL'
WHERE client_id = (SELECT id FROM clients WHERE email = 'CLIENT_EMAIL')
AND module_key = 'MODULE_KEY';

-- 9. UPDATE MODULE SETTINGS (n8n workflow ID, etc.)
UPDATE client_modules
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{n8n_workflow_id}',
  '"workflow_123"'
)
WHERE client_id = (SELECT id FROM clients WHERE email = 'CLIENT_EMAIL')
AND module_key = 'MODULE_KEY';

-- 10. REORDER MODULES (change sort_order)
-- Lower numbers appear first
UPDATE client_modules
SET sort_order = 1
WHERE client_id = (SELECT id FROM clients WHERE email = 'CLIENT_EMAIL')
AND module_key = 'business-crm';

-- 11. DELETE A MODULE COMPLETELY (careful!)
DELETE FROM client_modules
WHERE client_id = (SELECT id FROM clients WHERE email = 'CLIENT_EMAIL')
AND module_key = 'MODULE_KEY';

-- 12. COUNT MODULES PER CLIENT
SELECT
  c.name,
  c.email,
  COUNT(cm.id) as total_modules,
  COUNT(cm.id) FILTER (WHERE cm.is_enabled = true) as enabled_modules
FROM clients c
LEFT JOIN client_modules cm ON cm.client_id = c.id
GROUP BY c.id, c.name, c.email
ORDER BY c.name;

-- 13. FIND CLIENTS WITHOUT ANY MODULES
SELECT c.name, c.email
FROM clients c
LEFT JOIN client_modules cm ON cm.client_id = c.id
WHERE cm.id IS NULL;

-- ============================================
-- AVAILABLE MODULE KEYS
-- ============================================
-- Core Modules:
--   business-crm      - Business CRM (B2B leads)
--   email-outreach    - Email campaigns
--   analytics         - Performance metrics
--   settings          - Client settings
--
-- Optional Modules:
--   social-jobs       - Job postings (Instagram, etc.)
--   social-candidates - Candidate tracking
--   linkedin-agent    - LinkedIn automation
--   website-chatbot   - Website chatbot management
-- ============================================
