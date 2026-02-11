# Module System Setup Guide

This guide explains how to set up and configure the new modular dashboard system.

## Overview

The dashboard now uses a **modular architecture** where each client can have different features enabled. This allows you to:
- Customize the dashboard per client
- Easily add new modules (LinkedIn, Email Outreach, etc.)
- Hide/show features based on client needs
- Support hybrid localization (custom labels per client)

## Architecture

### Core Concepts

1. **Modules** - Individual features (Business CRM, Email Outreach, LinkedIn Agent, etc.)
2. **Module Registry** - Central definition of all available modules (`lib/modules/registry.ts`)
3. **Client Modules** - Database table tracking which modules each client has enabled
4. **Dynamic Sidebar** - Automatically shows only enabled modules for the logged-in client

### Available Modules

**Core Modules (recommended for all clients):**
- `business-crm` - B2B Lead Management with conversion tracking
- `email-outreach` - Email campaign management (placeholder)
- `analytics` - Performance metrics dashboard (placeholder)
- `settings` - Client settings and preferences (placeholder)

**Optional Modules (client-specific):**
- `social-jobs` - Job postings for social media (e.g., Instagram)
- `social-candidates` - Candidate tracking from social channels
- `linkedin-agent` - LinkedIn automation (placeholder)
- `website-chatbot` - Website chatbot management (placeholder)

## Database Setup

### Step 1: Run the Migration

The migration creates the `client_modules` table and adds a `language` column to the `clients` table.

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/001_add_module_system.sql`
4. Paste and run the SQL

**Option B: Via Supabase CLI**
```bash
# If you have Supabase CLI installed
supabase db push
```

### Step 2: Seed Client Modules

After running the migration, core modules will be automatically added to all existing clients. To add optional modules:

1. Open Supabase **SQL Editor**
2. Copy the template from `supabase/migrations/002_seed_client_modules.sql`
3. **Edit the script** to replace email addresses with your actual client emails
4. Run the modified SQL

#### Example: Add Social Modules to Youth Employment Client

```sql
-- Add Job Postings module with Serbian label
INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order)
SELECT
  id,
  'social-jobs',
  true,
  'Poslovi',  -- Custom Serbian label
  5
FROM clients
WHERE email = 'youth-employment@example.com'
ON CONFLICT (client_id, module_key) DO NOTHING;

-- Add Candidates module with Serbian label
INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order)
SELECT
  id,
  'social-candidates',
  true,
  'Kandidati',  -- Custom Serbian label
  6
FROM clients
WHERE email = 'youth-employment@example.com'
ON CONFLICT (client_id, module_key) DO NOTHING;
```

#### Example: Add LinkedIn Agent to Your Agency Account

```sql
INSERT INTO client_modules (client_id, module_key, is_enabled, sort_order)
SELECT
  id,
  'linkedin-agent',
  true,
  7
FROM clients
WHERE email = 'your-agency@example.com'
ON CONFLICT (client_id, module_key) DO NOTHING;
```

## Module Management

### View All Modules for a Client

```sql
SELECT cm.*, c.name as client_name, c.email
FROM client_modules cm
JOIN clients c ON c.id = cm.client_id
WHERE c.email = 'client@example.com'
ORDER BY cm.sort_order;
```

### Enable a Module for a Client

```sql
INSERT INTO client_modules (client_id, module_key, is_enabled, display_name, sort_order)
VALUES (
  (SELECT id FROM clients WHERE email = 'client@example.com'),
  'linkedin-agent',
  true,
  'LinkedIn Automation',
  7
)
ON CONFLICT (client_id, module_key) DO UPDATE SET
  is_enabled = true;
```

### Disable a Module

```sql
UPDATE client_modules
SET is_enabled = false
WHERE client_id = (SELECT id FROM clients WHERE email = 'client@example.com')
AND module_key = 'linkedin-agent';
```

### Update Module Display Name (Custom Label)

```sql
UPDATE client_modules
SET display_name = 'Poslovi na Društvenim Mrežama'
WHERE client_id = (SELECT id FROM clients WHERE email = 'client@example.com')
AND module_key = 'social-jobs';
```

### Change Module Sort Order

```sql
UPDATE client_modules
SET sort_order = 10
WHERE client_id = (SELECT id FROM clients WHERE email = 'client@example.com')
AND module_key = 'email-outreach';
```

## Adding New Modules

To add a completely new module to the system:

### 1. Update the Module Registry

Edit `lib/modules/registry.ts` and add your module:

```typescript
'my-new-module': {
  key: 'my-new-module',
  defaultLabel: 'My New Feature',
  icon: Star,  // Import from lucide-react
  category: 'outreach',
  isCore: false,
  description: 'Description of what this module does',
  componentPath: 'components/modules/my-new-module'
}
```

### 2. Add the Module Type

Edit `lib/modules/types.ts`:

```typescript
export type ModuleKey =
  | 'business-crm'
  | 'email-outreach'
  // ... existing modules
  | 'my-new-module'  // Add here
```

### 3. Create the Module Component

Create `components/modules/my-new-module.tsx`:

```typescript
"use client"

interface MyNewModuleProps {
  clientId: string
}

export function MyNewModule({ clientId }: MyNewModuleProps) {
  return (
    <div>
      <h2>My New Module</h2>
      {/* Your module content */}
    </div>
  )
}
```

### 4. Register in Main Page Router

Edit `app/page.tsx` and add to the switch statement:

```typescript
case 'my-new-module':
  return <MyNewModule clientId={selectedClientId} />
```

### 5. Enable for Clients

Run SQL to enable for specific clients:

```sql
INSERT INTO client_modules (client_id, module_key, is_enabled, sort_order)
SELECT id, 'my-new-module', true, 10
FROM clients
WHERE email = 'client@example.com';
```

## Module Settings (Advanced)

The `settings` JSONB column in `client_modules` can store module-specific configuration:

```sql
UPDATE client_modules
SET settings = '{
  "n8n_workflow_id": "workflow_123",
  "api_key": "key_abc",
  "custom_field": "value"
}'::jsonb
WHERE client_id = (SELECT id FROM clients WHERE email = 'client@example.com')
AND module_key = 'linkedin-agent';
```

Access settings in your module component:

```typescript
export function MyModule({ clientId }: ModuleProps) {
  const { modules } = useClientModules(clientId)
  const myModule = modules.find(m => m.key === 'my-module')
  const settings = myModule?.settings || {}

  console.log(settings.n8n_workflow_id)
  // ...
}
```

## Testing

After setup:

1. **Login** with a client account
2. **Verify** you see only the modules enabled for that client
3. **Test navigation** between modules
4. **Check** custom labels appear correctly (e.g., "Poslovi" instead of "Job Postings")

## Troubleshooting

### Sidebar is Empty
- Check that client has at least one enabled module in `client_modules`
- Verify the client email in the database matches the auth email
- Check browser console for errors

### Module Not Appearing
- Confirm `is_enabled = true` in database
- Verify module key matches exactly (case-sensitive)
- Check that the module is registered in `lib/modules/registry.ts`

### Wrong Label Showing
- Check `display_name` column in `client_modules`
- If `display_name` is NULL, the default English label is used
- Update with custom label SQL (see above)

## Future Enhancements

- Self-service module management (clients enable/disable via Settings UI)
- Multi-language support with full i18n
- Module marketplace for add-ons
- Analytics across all modules
- Role-based access control per module
