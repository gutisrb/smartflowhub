# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Second Brain (READ THIS FIRST)

This project has a persistent wiki in the Smartflow Obsidian vault.
**Read it at the start of every session. Update it at the end.**

Wiki path: `/Users/johhn/Library/Mobile Documents/iCloud~md~obsidian/Documents/Smartflow/`

| File | What's in it |
|------|-------------|
| `wiki/status.md` | **START HERE** — last session, blockers, next actions |
| `wiki/clients.md` | All clients: configs, live status, issues |
| `wiki/modules.md` | All modules: Active / WIP / Placeholder |
| `wiki/outreach.md` | Email pipeline state and scripts reference |
| `wiki/architecture.md` | Data model, module system, n8n patterns |
| `wiki/workflows.md` | n8n workflow inventory |

Session protocol: read `wiki/status.md` → do work → update `wiki/status.md` + append to `log.md`.

## Development Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run dev -- -p 3001  # Custom port
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
```

No test runner is configured — testing is manual (see TESTING-GUIDE.md).

## Architecture Overview

**AI Growth Agency Dashboard** — a multi-tenant B2B SaaS dashboard built as a Next.js 16 SPA. All routes resolve to `app/page.tsx`; there are no other Next.js routes.

### Module System

The core architectural concept is a database-driven module registry:

- `lib/modules/types.ts` — `ModuleKey`, `DashboardModule`, `EnabledModule` types
- `lib/modules/registry.ts` — Static `MODULE_REGISTRY` mapping `ModuleKey` → metadata (label, icon, category)
- `lib/modules/hooks.ts` — `useClientModules()` fetches enabled modules from `client_modules` table; `useUnifiedModules()` adds special-case logic for OZ Avala (hardcoded UUID `7ac02189-d0ec-4532-baa6-d7d4dc84b87c`) which forces separate modules instead of a unified "Growth Engine" view
- `components/modules/` — One component per module (12 total)

Adding a new module requires: adding a `ModuleKey`, registering it in `MODULE_REGISTRY`, creating a component, and inserting a row in `client_modules`.

### Authentication & Multi-Tenancy

1. Supabase email/password login (`components/auth/login-form.tsx`)
2. User email matched to `clients` table → sets `clientId` in `app/page.tsx`
3. `useUnifiedModules(clientId)` fetches the client's enabled modules from `client_modules`
4. Every Supabase query filters by `client_id` — never fetch cross-client data
5. RLS policies enforce this at the DB level (see `supabase/migrations/`)

### Supabase Client

Singleton pattern in `lib/supabase/client.ts` — always import via `createClient()`, never instantiate directly. All query functions live in `lib/supabase/queries.ts`.

### Real-Time Subscriptions

Used in CRM and other modules. Pattern:
```typescript
useEffect(() => {
    const channel = supabase
        .channel(`kontakti:${clientId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kontakti' },
            () => refetch())
        .subscribe()
    return () => channel.unsubscribe()
}, [clientId])
```

### State Management

React hooks only (`useState`, `useEffect`, `useCallback`, `useMemo`). No Redux/Zustand.

## Key Data Model

```
clients             — organizations; email maps auth user → client
kontakti            — leads/contacts; status: "Novi" | "Prijavljen" | "Intervencija" | "Zaposlen"
jobs                — job postings
candidates          — job candidates
client_modules      — which modules each client can access (module_key, is_enabled, settings JSONB, sort_order)
```

`id_razgovora` on `kontakti` is the Meta/Instagram sender ID (TEXT, not UUID).

## Configuration

**Path alias:** `@/*` → repo root (tsconfig.json)

**Required environment variables** (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Fallback client config:** `config/clients.ts` hardcodes 3 clients (OZ Avala, SmartFlow, dev account) as a fallback when DB lookup fails.

## n8n Workflow Integration

This project integrates with n8n workflows for chatbot automation. The following tools are available:

### n8n MCP Tools

**Server:** `n8n-mcp` (npx n8n-mcp)
**Configuration:** Configured in `.claude/mcp.json` with API access to http://localhost:5678

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
