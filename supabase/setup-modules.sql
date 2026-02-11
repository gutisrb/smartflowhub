-- ============================================
-- SETUP MODULES FOR YOUR CLIENTS
-- Run this in Supabase SQL Editor
-- ============================================

-- STEP 1: Update OZ Avala email (currently NULL)
UPDATE clients
SET email = 'office@ozavala.co.rs'
WHERE id = '7ac02189-d0ec-4532-baa6-d7d4dc84b87c';

-- STEP 2: Add core modules to BOTH clients
-- (Business CRM, Email Outreach, Analytics, Settings)
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
WHERE c.id IN ('69acf7e9-557e-4ca3-85bd-a785ef39e351', '7ac02189-d0ec-4532-baa6-d7d4dc84b87c')
ON CONFLICT (client_id, module_key) DO NOTHING;

-- STEP 3: Add Social Media modules to OZ Avala (Youth Employment)
-- Job Postings with Serbian label "Poslovi"
INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order)
VALUES (
  '7ac02189-d0ec-4532-baa6-d7d4dc84b87c',
  'social-jobs',
  true,
  'Poslovi',
  5
)
ON CONFLICT (client_id, module_key) DO UPDATE SET
  is_enabled = true,
  display_name = 'Poslovi',
  sort_order = 5;

-- Candidates with Serbian label "Kandidati"
INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order)
VALUES (
  '7ac02189-d0ec-4532-baa6-d7d4dc84b87c',
  'social-candidates',
  true,
  'Kandidati',
  6
)
ON CONFLICT (client_id, module_key) DO UPDATE SET
  is_enabled = true,
  display_name = 'Kandidati',
  sort_order = 6;

-- STEP 4: Add LinkedIn and Website Chatbot modules to SmartFlow (Your Agency)
-- LinkedIn Agent
INSERT INTO client_modules (client_id, module_key, is_enabled, sort_order)
VALUES (
  '69acf7e9-557e-4ca3-85bd-a785ef39e351',
  'linkedin-agent',
  true,
  5
)
ON CONFLICT (client_id, module_key) DO UPDATE SET
  is_enabled = true,
  sort_order = 5;

-- Website Chatbot
INSERT INTO client_modules (client_id, module_key, is_enabled, sort_order)
VALUES (
  '69acf7e9-557e-4ca3-85bd-a785ef39e351',
  'website-chatbot',
  true,
  6
)
ON CONFLICT (client_id, module_key) DO UPDATE SET
  is_enabled = true,
  sort_order = 6;

-- ============================================
-- VERIFICATION: View modules for each client
-- ============================================

-- OZ Avala modules
SELECT
  cm.module_key,
  cm.display_name,
  cm.is_enabled,
  cm.sort_order
FROM client_modules cm
WHERE cm.client_id = '7ac02189-d0ec-4532-baa6-d7d4dc84b87c'
ORDER BY cm.sort_order;

-- Expected result for OZ Avala:
-- business-crm      | Business CRM | true | 1
-- email-outreach    | Email Outreach | true | 2
-- analytics         | Analytics | true | 3
-- settings          | Settings | true | 4
-- social-jobs       | Poslovi | true | 5
-- social-candidates | Kandidati | true | 6

-- SmartFlow modules
SELECT
  cm.module_key,
  cm.display_name,
  cm.is_enabled,
  cm.sort_order
FROM client_modules cm
WHERE cm.client_id = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
ORDER BY cm.sort_order;

-- Expected result for SmartFlow:
-- business-crm      | Business CRM | true | 1
-- email-outreach    | Email Outreach | true | 2
-- analytics         | Analytics | true | 3
-- settings          | Settings | true | 4
-- linkedin-agent    | LinkedIn Agent | true | 5
-- website-chatbot   | Website Chatbot | true | 6
