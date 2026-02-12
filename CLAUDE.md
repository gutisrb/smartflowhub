# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI Growth Agency Dashboard - a Next.js 16 application with Supabase authentication and real-time data synchronization. The application provides a client-facing dashboard for managing job postings, leads (kontakti), and chat logs.

## Development Commands

```bash
# Start development server (default port 3000)
npm run dev

# Start on custom port (e.g., 3001)
npm run dev -- -p 3001

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Architecture Overview

### Authentication Flow

- Single-page app with client-side authentication (app/page.tsx:36-48)
- Uses Supabase Auth with email/password (components/auth/login-form.tsx:23-39)
- After login, user's email is matched to a `clients` table record (app/page.tsx:51-64)
- If no matching client profile exists, user sees a message to contact admin
- Session check runs on mount; authenticated users automatically fetch their client profile

### Data Model

**Key Supabase Tables:**
- `clients` - Client organizations with email for auth mapping
- `jobs` - Job postings linked to clients via `client_id`
- `kontakti` - Leads/contacts linked to clients via `client_id`, with statuses like "Prijavljen", "Zaposlen"
- Chat data accessed via `id_razgovora` field in kontakti

**Database Schema Pattern:**
All client-specific data uses `client_id` foreign key for multi-tenancy.

### Real-Time Synchronization

The app uses Supabase Realtime channels (app/page.tsx:82-97):
- Subscribes to `kontakti` table changes filtered by `client_id`
- Auto-refreshes leads data on any INSERT/UPDATE/DELETE
- Channel cleanup handled in useEffect return function

### Supabase Client Pattern

**IMPORTANT:** Uses singleton pattern for Supabase client (lib/supabase/client.ts:3-13)
- Single browser client instance created on first call
- Reused across all components to prevent multiple WebSocket connections
- Always import via `createClient()` from `@/lib/supabase/client`

### Component Organization

**Dashboard Components** (components/dashboard/):
- `jobs-crm.tsx` - Full CRUD interface for job postings with inline create dialog
- `leads-table.tsx` - Displays kontakti with action buttons
- `chat-log-viewer.tsx` - Modal viewer for chat transcripts by `id_razgovora`
- `stats-grid.tsx` - Aggregated statistics (total leads, applications, hired)
- `client-selector.tsx` - Client switcher (not currently used in main flow)

**UI Components** (components/ui/):
- shadcn/ui components (tabs, card, table, dialog, etc.)
- Configured via components.json for Tailwind CSS 4

### State Management

No external state library. Uses React hooks:
- Local component state for UI (useState)
- Data fetching in useEffect with manual refetch functions
- Real-time updates via Supabase subscriptions

### Routing

Single-page application with all content in `app/page.tsx`. No app router routes beyond root.

## Important Patterns

### Data Fetching Pattern

```typescript
// 1. Define query in lib/supabase/queries.ts
export async function getLeadsByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('kontakti')
        .select('*')
        .eq('client_id', clientId)
    // ... error handling
    return data
}

// 2. Call from component with useEffect
useEffect(() => {
    if (clientId) {
        fetchLeads(clientId)
    }
}, [clientId])
```

### Real-Time Subscription Pattern

Always return cleanup function from useEffect:
```typescript
useEffect(() => {
    if (selectedClientId) {
        const unsubscribe = subscribeToLeads(selectedClientId)
        return () => { unsubscribe() }
    }
}, [selectedClientId])
```

## Configuration

**Path Aliases:**
- `@/*` maps to root directory (tsconfig.json:21-23)

**Environment Variables Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

Create `.env.local` file with these variables (ignored by git).

**Styling:**
- Tailwind CSS 4 with PostCSS
- Custom styles in app/globals.css
- shadcn/ui components pre-configured

## Database Access Patterns

All database operations go through `lib/supabase/queries.ts`:
- `getClients()` - Fetch all clients
- `createNewClient(name, email)` - Create client profile
- `getJobsByClientId(clientId)` - Fetch jobs for client
- `createJob(jobData)` - Insert new job
- `getLeadsByClientId(clientId)` - Fetch leads for client

Always pass `clientId` for tenant isolation. Never fetch data across clients.

## Multi-Tenancy Security

User can only access data for their linked client:
1. Auth email → client.email lookup (app/page.tsx:51-64)
2. All queries filtered by `client_id`
3. No admin/superuser role - each user sees only their client data
4. Supabase RLS policies should enforce this at database level

## n8n Workflow Integration

This project integrates with n8n workflows for chatbot automation. The following tools are available:

### n8n MCP Tools

**Server:** `n8n-mcp` (npx n8n-mcp)
**Configuration:** Configured in Cursor with API access to http://localhost:5678

**Available Tools:**
- **Node search and documentation** - Access 1,084+ n8n nodes (537 core + 547 community)
- **Template discovery** - Browse 2,709 workflow templates with metadata
- **Workflow management** - Create, update, and execute workflows via API
- **AI tool variants** - 265 AI-capable tool nodes with full documentation

**Key Usage Patterns:**
- Use `get_node` to fetch node documentation and configuration options
- Use `search_nodes` to find nodes by type or functionality
- Use `validate_workflow` to check workflow configurations before deployment
- Always filter community nodes with `source` parameter when needed

**Safety Warning:** Never edit production workflows directly with AI! Copy workflows first, test in development, and validate before deployment.

### n8n Skills

**Seven specialized Claude Code skills** are available for n8n workflow development:

1. **n8n-expression-syntax** - n8n expression syntax, $json/$node variables, webhook data patterns
2. **n8n-mcp-tools-expert** - Tool selection, nodeType formatting, validation profiles
3. **n8n-workflow-patterns** - Five architectural patterns (webhook, HTTP API, database, AI, scheduled)
4. **n8n-validation-expert** - Interpret validation errors, auto-sanitization, false positives
5. **n8n-node-configuration** - Operation-aware config, property dependencies, AI connections
6. **n8n-code-javascript** - Code node patterns, data access, return formatting as `[{json: {...}}]`
7. **n8n-code-python** - Python in Code nodes (limited, prefer JavaScript for 95% of use cases)

**How Skills Activate:**
Skills automatically engage based on query context. Asking about expressions triggers n8n-expression-syntax; searching for nodes activates n8n-mcp-tools-expert; building workflows engages n8n-workflow-patterns.

**Critical n8n Gotchas:**
- Webhook data is under `$json.body` (not `$json`)
- Code node returns must be `[{json: {...}}]` format
- Python Code nodes have no external library support
- Expression syntax uses `{{ }}` not just `$`

### Supabase MCP Integration

**Server:** `supabase` (https://mcp.supabase.com/mcp)
**Configuration:** Scoped to project `ndazbdkytcksmhoabtgs`

The Supabase MCP enables AI-assisted database operations:
- Query Supabase tables directly
- Execute read-only operations (when configured with `read_only=true`)
- Scope access to specific projects via `project_ref` parameter

**Authentication:** MCP prompts for Supabase login and organizational access during first use.

### Workflow Integration Pattern

**n8n Workflow → Supabase Database:**
- Chatbot workflows (e.g., OZ Avala Agent) use Supabase Tool nodes
- AI Agent nodes connect to Supabase tools for CRM operations
- Tables: `kontakti` (leads), `jobs` (postings), `clients` (organizations)
- All operations scoped by `client_id` for multi-tenancy

**Example: OZ Avala Chatbot Flow**
```
Webhook (Meta/Instagram)
  → Extract message (sender ID, text, images)
  → Get lead (Supabase lookup by id_razgovora)
  → If (filter Intervencija status + echo)
  → AI Agent (Gemini with Supabase tools)
  → Send response (HTTP to Meta API)
```

**Critical Fields:**
- `id_razgovora` - Meta/Instagram sender ID (TEXT, not UUID!)
- `client_id` - Organization ID (UUID, for multi-tenancy)
- `status` - Lead status ("Novi", "Prijavljen", "Intervencija", "Zaposlen")

### Working with n8n Workflows

**When modifying n8n workflows:**

1. **Use n8n-mcp tools** to search for nodes and fetch configurations
2. **Leverage n8n-workflow-patterns skill** to identify the right architectural pattern
3. **Use Supabase MCP** for database schema exploration and queries
4. **Validate configurations** using n8n-validation-expert skill
5. **Test in development** before deploying to production

**Environment Variables Required for n8n API:**
- `N8N_API_URL` - n8n instance URL (http://localhost:5678)
- `N8N_API_KEY` - API key for authentication

**MCP Configuration Files:**
- Cursor: `~/.cursor/mcp.json` (Supabase MCP)
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (n8n-mcp)
