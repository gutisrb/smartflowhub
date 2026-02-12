# Current Task: Fix Email Master v5 Timing Bug

## Problem
Workflow **hA8nFaedBOsHHy8D** (AI GROWTH - Email Master v5) is broken:
- Triggers every 15 minutes via Schedule Trigger
- Sends emails continuously without respecting timing delays
- After sending each email, it updates `email_type` to the next email (email_2 → email_3 → email_4, etc.)
- Next 15-minute trigger immediately sends the next email in sequence

## Root Cause
**Missing timing logic** - workflow doesn't check `next_email_at` field before sending emails.

Current behavior:
```
15:00 - Trigger fires → Lead has email_type="email_2" → Send email 2 → Update to email_type="email_3"
15:15 - Trigger fires → Lead has email_type="email_3" → Send email 3 → Update to email_type="email_4"
15:30 - Trigger fires → Lead has email_type="email_4" → Send email 4 → Update to email_type="email_5"
... continues every 15 minutes
```

Expected behavior:
```
15:00 - Trigger fires → Lead has email_type="email_2" AND next_email_at="15:00" → Send email 2 → Update email_type="email_3" AND next_email_at="tomorrow 15:00"
15:15 - Trigger fires → Lead has email_type="email_3" BUT next_email_at="tomorrow 15:00" → SKIP (not ready)
Tomorrow 15:00 - Trigger fires → Lead has email_type="email_3" AND next_email_at="15:00" → Send email 3 → etc.
```

## Solution Required

### Step 1: Fetch Live Workflow Using n8n MCP
Use MCP tools to get the actual workflow configuration from n8n:
```
Workflow ID: hA8nFaedBOsHHy8D
Name: AI GROWTH - Email Master v5 (FRAMEWORK ALIGNED)
```

### Step 2: Identify Missing Timing Logic
Find the node that fetches leads from Supabase and verify it's checking `next_email_at`.

Expected query:
```sql
SELECT * FROM kontakti
WHERE email_type IS NOT NULL
  AND next_email_at IS NOT NULL
  AND next_email_at <= NOW()
ORDER BY next_email_at ASC
```

### Step 3: Fix Update Nodes
Ensure each Update node (UpdateE2 through UpdateE8) sets both:
- `email_type` → next email in sequence
- `next_email_at` → timestamp for when the NEXT email should send

Example timing intervals:
- Email 2 → 3: +24 hours (day before meeting reminder)
- Email 3 → 4: +1 hour (final reminder before meeting)
- Email 4 → 5: +30 minutes (during/after meeting)
- Email 5 → 6: +2 days (follow-up check-in)
- Email 6 → 7: +3 days (final follow-up)
- Email 7 → 8: +5 days (no-show detection)
- Email 8 → NULL: End sequence

### Step 4: Verify Database Schema
Confirm `kontakti` table has these fields (should already exist):
```sql
demo_preference TEXT
demo_time TIMESTAMPTZ
meeting_address TEXT
meeting_link TEXT
email_type TEXT
next_email_at TIMESTAMPTZ
```

## Prerequisites
- n8n MCP must be active in Cursor (restart Cursor after confirming `.claude/mcp.json` exists)
- n8n instance running at http://localhost:5678
- Supabase credentials configured

## Next Steps
1. User restarts Cursor to activate n8n MCP
2. Use `mcp__n8n__get_workflow` to fetch live workflow
3. Analyze actual configuration
4. Provide specific node changes needed
5. Apply fixes using MCP or manual instructions
