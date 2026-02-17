# OZ Avala Setup & Configuration Guide

Complete setup guide for the LinkedIn + Cold Email automation system for Omladinska zadruga Avala.

## Overview

This system automates three core functions:
1. **Content Posting**: AI-generated LinkedIn posts 2x/week (Tue/Thu 9AM)
2. **LinkedIn Connection Outreach**: Daily lead generation (Mon-Fri 10AM)
3. **Cold Email Outreach**: Primary sales driver (Every 3 hours Mon-Fri, 100-150 emails/day)

---

## Prerequisites

### Required Accounts & Services

- **Supabase** (existing) - Database
- **n8n instance** (http://localhost:5678) - Workflow automation
- **Apollo.io** - Lead sourcing (paid plan recommended)
- **LinkFinder AI** - LinkedIn profile enrichment
- **Instantly.ai** ($37/mo) - Cold email sending
- **Google Cloud** (with Gemini 2.0 Flash API enabled) - AI content generation

### Required Information

Gather these before starting:
- [ ] Supabase project URL
- [ ] Supabase service role key
- [ ] n8n API key
- [ ] Apollo.io API key
- [ ] LinkFinder AI API key
- [ ] Instantly.ai API key
- [ ] Instantly.ai Campaign ID
- [ ] Google Cloud service account JSON (for Gemini)
- [ ] OZ Avala client UUID from Supabase

---

## Step 1: Database Migration

### 1.1 Get OZ Avala Client UUID

```sql
-- Run in Supabase SQL Editor
SELECT id, name, email FROM clients WHERE name ILIKE '%avala%';
```

Copy the `id` value - you'll need this throughout the setup.

If no client exists, create one:

```sql
INSERT INTO clients (name, email)
VALUES ('Omladinska zadruga Avala', 'milos@ozavala.co.rs')
RETURNING id;
```

### 1.2 Run Database Migration

1. Open Supabase SQL Editor
2. Open the file `oz_avala_migration.sql`
3. Copy the entire contents
4. Paste into Supabase SQL Editor
5. Click "Run"
6. Verify success: Check for new tables and views

```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('linkedin_content', 'linkedin_posted_topics');

-- Verify views created
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('email_outreach_stats', 'linkedin_outreach_stats', 'oz_avala_lead_pipeline');

-- Verify kontakti table columns added
SELECT column_name FROM information_schema.columns
WHERE table_name = 'kontakti'
AND column_name IN ('lead_source', 'cold_email_subject', 'linkedin_url', 'connection_message');
```

---

## Step 2: Configure API Services

### 2.1 Apollo.io Setup

1. Sign up at https://apollo.io (paid plan recommended for higher limits)
2. Navigate to Settings → Integrations → API
3. Generate API key
4. Save as `APOLLO_API_KEY`

**Rate Limits:**
- Free: 50 requests/day
- Basic ($49/mo): 500 requests/day
- Professional ($99/mo): Unlimited

**Recommendation:** Start with Basic plan, upgrade if needed.

### 2.2 LinkFinder AI Setup

1. Sign up at https://linkfinderai.com
2. Navigate to API Keys section
3. Generate API key
4. Save as `LINKFINDER_API_KEY`

**Optional:** If budget is tight, you can skip LinkFinder enrichment. The workflow will still work but with less profile data.

### 2.3 Instantly.ai Setup

**CRITICAL:** This is the PRIMARY DRIVER for sales. Don't skip this.

1. Sign up at https://instantly.ai ($37/mo minimum)
2. Add and verify your sending domain (e.g., ozavala.co.rs)
3. Configure DKIM, SPF, DMARC records (Instantly provides these)
4. **Domain Warmup (IMPORTANT):**
   - Days 1-7: Send 20-30 emails/day
   - Days 8-14: Send 50-70 emails/day
   - Days 15+: Ramp to 100-150 emails/day
5. Create a new campaign:
   - Name: "OZ Avala Cold Outreach Q1 2026"
   - Type: Cold outreach
   - Target: Construction & Engineering companies in Serbia
6. Get your Campaign ID from the URL or API
7. Navigate to Settings → API Keys
8. Generate API key
9. Save both:
   - `INSTANTLY_API_KEY`
   - `INSTANTLY_CAMPAIGN_ID`

### 2.4 Google Cloud (Gemini) Setup

1. Go to https://console.cloud.google.com
2. Create new project (or use existing)
3. Enable "Vertex AI API"
4. Navigate to IAM & Admin → Service Accounts
5. Create service account with "Vertex AI User" role
6. Generate JSON key
7. In n8n:
   - Go to Settings → Credentials
   - Add new credential: "Google PaLM (Gemini) API"
   - Upload service account JSON
   - Save as "Google Gemini(PaLM) Api account"

---

## Step 3: Import n8n Workflows

### 3.1 Import Workflow 1: Content Posting

1. Open n8n at http://localhost:5678
2. Click "+ Add Workflow"
3. Click "..." menu → "Import from File"
4. Select `OZ_Avala_1_Content_Posting.json`
5. **Configure nodes:**

**Supabase nodes:**
- Click "Get Posted Topics (last 3 months)" node
- Click credential dropdown
- Select existing Supabase credential or create new:
  - Supabase URL: Your project URL
  - Supabase Key: Service role key
- Repeat for "Save to linkedin_content" node

**Gemini node:**
- Click "Gemini: Generate Post" node
- Select credential created in Step 2.4

**Replace client UUID:**
- Find all instances of `[OZ_AVALA_CLIENT_UUID]`
- Replace with actual UUID from Step 1.1
- Appears in:
  - "Get Posted Topics" filter
  - "Parse Gemini Response" code node
  - "Save to linkedin_content" node

6. Save workflow
7. **Test run:**
   - Click "Execute Workflow" (play button)
   - Verify post created in Supabase `linkedin_content` table
8. **Activate:**
   - Toggle "Active" switch to enable schedule

### 3.2 Import Workflow 2: LinkedIn Connections

1. Import `OZ_Avala_2_LinkedIn_Connections.json`
2. **Configure nodes:**

**Apollo nodes:**
- Click "Apollo: Search Companies"
- Add HTTP Request header:
  - Name: `X-Api-Key`
  - Value: Your `APOLLO_API_KEY`
- Repeat for "Apollo: Find Decision Makers" node

**LinkFinder node:**
- Click "LinkFinder: Enrich Profile"
- Add HTTP Request headers:
  - Authorization: `Bearer [LINKFINDER_API_KEY]`

**Gemini node:**
- Click "Gemini: Generate Connection Message"
- Select Gemini credential

**Supabase node:**
- Click "Save to Kontakti"
- Select Supabase credential
- Replace `[OZ_AVALA_CLIENT_UUID]` with actual UUID

3. **Adjust volume (IMPORTANT):**

Current settings: 10 companies/day × 3 people = 30 potential leads
Actual output after filtering: ~10-15 qualified leads/day

To adjust volume, edit "Apollo: Search Companies" node:
```json
{
  "per_page": 10  // Change to 5 for lower volume, 15 for higher
}
```

4. Save workflow
5. **Test run:**
   - Click "Execute Workflow"
   - Verify leads created in Supabase `kontakti` table
   - Check `lead_source = 'linkedin_connection'`
   - Verify `connection_message` is in Serbian
6. **Activate schedule**

### 3.3 Import Workflow 3: Cold Email Outreach

**CRITICAL:** This is your PRIMARY SALES DRIVER.

1. Import `OZ_Avala_3_Cold_Email_Outreach.json`
2. **Configure nodes:**

**Apollo nodes:**
- Same as Workflow 2 (add API key)

**LinkFinder node (Optional):**
- If budget allows, add API key
- If not, you can disable this node:
  - Click "LinkFinder: Enrich (Optional)" node
  - Toggle "Enabled" to off

**Gemini node:**
- Select Gemini credential

**Instantly.ai node:**
- Click "Instantly.ai: Send Email"
- Add HTTP Request headers:
  - Authorization: `Bearer [INSTANTLY_API_KEY]`
- Update body parameters:
  - `campaign_id`: Your `INSTANTLY_CAMPAIGN_ID`

**Supabase nodes:**
- Configure credentials
- Replace `[OZ_AVALA_CLIENT_UUID]`

3. **Configure volume:**

Default: Every 3 hours Mon-Fri (9AM, 12PM, 3PM, 6PM, 9PM) = 5 runs/day
Per run: 20-30 emails
Daily total: 100-150 emails

**During warmup period (first 2 weeks):**
```json
// In "Apollo: Search Companies" node
{
  "per_page": 5  // Reduced from 10
}

// Change schedule to run less frequently
"expression": "0 10,15 * * 1-5"  // Only 10AM and 3PM = 2 runs/day
```

After warmup, increase to full volume.

4. Save workflow
5. **Test run (CAREFUL):**
   - Run workflow once
   - Verify emails sent in Instantly.ai dashboard
   - Check leads created in Supabase
   - **DO NOT run multiple times during testing** (counts toward daily send limit)
6. **Activate schedule**

---

## Step 4: Frontend Dashboard Verification

### 4.1 Verify Components Are Deployed

Check that these components exist:
- `/Users/johhn/smartflowhub/components/modules/email-outreach-module.tsx`
- `/Users/johhn/smartflowhub/components/modules/linkedin-agent-module.tsx`

### 4.2 Test Data Display

1. Start development server:
```bash
cd /Users/johhn/smartflowhub
npm run dev
```

2. Login as OZ Avala client user (email: milos@ozavala.co.rs)

3. Navigate to **LinkedIn Agent** tab:
   - Verify stats display (Connections Sent, Acceptance Rate, etc.)
   - Check Content Calendar shows posts from `linkedin_content` table
   - Verify "Approve" button works for draft posts
   - Check Connection Leads table shows data from `oz_avala_lead_pipeline` view

4. Navigate to **Email Outreach** tab:
   - Verify stats display (Emails Sent, Replies, Positive Replies, Meetings)
   - Check leads table shows cold email leads
   - Verify sentiment badges display correctly
   - Check campaign info displays

### 4.3 Troubleshooting

**No data showing:**
- Check Supabase queries in browser console
- Verify client_id matches in database
- Run manual query to verify data exists:
```sql
SELECT * FROM oz_avala_lead_pipeline WHERE client_id = '[YOUR_UUID]' LIMIT 10;
SELECT * FROM linkedin_content WHERE client_id = '[YOUR_UUID]';
```

**Stats showing zero:**
- Workflows may not have run yet (check schedules)
- Verify views are created and returning data:
```sql
SELECT * FROM email_outreach_stats WHERE client_id = '[YOUR_UUID]';
SELECT * FROM linkedin_outreach_stats WHERE client_id = '[YOUR_UUID]';
```

---

## Step 5: Testing & Validation

### 5.1 Test Content Posting Workflow

1. Manually trigger "OZ Avala - 1. Content Posting"
2. Expected output:
   - 1 post created in `linkedin_content` table
   - status = 'draft'
   - post_text in Serbian (150-250 characters)
   - engagement_score between 1-10
3. Go to dashboard → LinkedIn Agent tab
4. Verify post appears in Content Calendar
5. Click "Approve"
6. Verify status changes to 'approved' in database

**If post fails to generate:**
- Check Gemini API credentials
- Verify service account has Vertex AI permissions
- Check n8n execution logs for errors

### 5.2 Test LinkedIn Connection Workflow

1. Manually trigger "OZ Avala - 2. LinkedIn Connection Outreach"
2. Expected output:
   - 10-15 leads created in `kontakti` table
   - lead_source = 'linkedin_connection'
   - connection_message populated (Serbian text)
   - decision_maker_score >= 6
3. Go to dashboard → LinkedIn Agent tab
4. Verify leads appear in Connection Outreach Leads table

**If no leads created:**
- Check Apollo API key and quota
- Verify company search returns results (check n8n logs)
- LinkFinder enrichment may fail for some profiles (this is normal, workflow continues)

### 5.3 Test Cold Email Workflow

**WARNING:** Only test once to avoid wasting email quota.

1. **First**, do a dry run:
   - Disable "Instantly.ai: Send Email" node
   - Enable "Wait 5s" node after Gemini
   - Run workflow
   - Verify leads created with proper email subject/body

2. **Then**, enable email sending:
   - Enable "Instantly.ai: Send Email" node
   - Run workflow ONCE
   - Check Instantly.ai dashboard for sent emails
   - Verify leads created in database

3. Expected output:
   - 20-30 emails sent
   - Leads created in `kontakti` with lead_source = 'cold_email'
   - cold_email_subject and cold_email_body populated

**If emails not sending:**
- Check Instantly.ai API key
- Verify campaign ID is correct
- Check domain is verified and warmed up
- Review Instantly.ai dashboard for errors

---

## Step 6: Production Deployment

### 6.1 Activate All Workflows

Once testing is complete:

1. **Content Posting:**
   - Activate workflow
   - Verify schedule: Tue/Thu 9AM (cron: `0 9 * * 2,4`)

2. **LinkedIn Connections:**
   - Activate workflow
   - Verify schedule: Mon-Fri 10AM (cron: `0 10 * * 1-5`)

3. **Cold Email Outreach:**
   - **START SLOW during warmup period**
   - Week 1: Run only 2x/day (10AM, 3PM)
   - Week 2: Run 3x/day (9AM, 1PM, 5PM)
   - Week 3+: Full schedule (9AM, 12PM, 3PM, 6PM, 9PM)
   - After 30 days: Maximize to full 150 emails/day

### 6.2 Monitoring Checklist

**Daily (first 2 weeks):**
- [ ] Check Instantly.ai dashboard for bounce rate (<5%)
- [ ] Verify domain health in Instantly.ai
- [ ] Check open rates (target: >30%)
- [ ] Review n8n execution history for errors
- [ ] Monitor Supabase database size

**Weekly:**
- [ ] Review LinkedIn content performance (engagement)
- [ ] Check connection acceptance rate (target: >20%)
- [ ] Analyze email reply sentiment
- [ ] Update topic blacklist if needed
- [ ] Review Apollo API usage/quota

**Monthly:**
- [ ] Optimize email copy based on reply rates
- [ ] Adjust LinkedIn connection message templates
- [ ] Review and update content themes
- [ ] Analyze meetings booked vs emails sent

### 6.3 Performance Targets

**Content Posting:**
- 8 posts/month (2x/week)
- Target: 5+ likes, 2+ comments per post
- Goal: 10-20 inbound leads/month from content

**LinkedIn Connections:**
- 10-15 requests/day = 200-300/month
- Target acceptance rate: 20-30%
- Goal: 40-90 new connections/month

**Cold Email Outreach (PRIMARY DRIVER):**
- 100-150 emails/day = 2000-3000/month
- Target open rate: 30-40%
- Target reply rate: 5-10%
- Target positive replies: 50-100/month
- **Goal: 10-20 booked meetings/month**

---

## Step 7: Advanced Configuration

### 7.1 Customize Email Templates

To adjust cold email tone/style:

1. Edit "OZ Avala - 3. Cold Email Outreach" workflow
2. Find "Gemini: Generate Email" node
3. Modify prompt in `prompt` field
4. Test thoroughly before deploying

**Tips for better emails:**
- Keep subject line under 50 characters
- Personalize first line with company-specific detail
- Focus on ONE clear benefit
- Strong CTA (book meeting link)
- Professional but conversational tone

### 7.2 Adjust LinkedIn Message Style

To modify connection request messages:

1. Edit "OZ Avala - 2. LinkedIn Connection Outreach" workflow
2. Find "Gemini: Generate Connection Message" node
3. Modify prompt
4. Remember: 250 character LinkedIn limit!

### 7.3 Content Themes

To add/remove content themes:

1. Edit "OZ Avala - 1. Content Posting" workflow
2. Find "Select Topic (avoid repeats)" node
3. Update `searchKeywords` array:
```javascript
const searchKeywords = [
  'zapošljavanje mladih srbija',
  'građevinski radnici',
  'omladinska zadruga',
  // Add more keywords here
];
```

### 7.4 Targeting Adjustments

To change target companies/people:

**For LinkedIn Connections (Workflow 2):**

1. Edit "Apollo: Search Companies" node
2. Adjust filters:
```json
{
  "q_organization_locations": ["Serbia", "Belgrade"],  // Add cities
  "organization_num_employees_ranges": ["10,50", "51,200"],  // Adjust size
  "industry_tag_ids": ["5567cd4773696439b10b0000"]  // Construction industry
}
```

3. Edit "Apollo: Find Decision Makers" node
4. Adjust titles:
```json
{
  "person_titles": [
    "Vlasnik", "Owner", "Direktor", "CEO",  // Add/remove titles
    "HR Manager", "Project Manager"
  ]
}
```

**For Cold Email (Workflow 3):**
- Same adjustments as above in respective Apollo nodes

---

## Troubleshooting Guide

### Database Issues

**Problem:** Views not showing data
```sql
-- Refresh views manually
DROP VIEW IF EXISTS email_outreach_stats;
DROP VIEW IF EXISTS linkedin_outreach_stats;
DROP VIEW IF EXISTS oz_avala_lead_pipeline;

-- Then re-run migration
```

**Problem:** Duplicate leads created
- Workflows have duplicate checks, but if bypassed:
```sql
-- Find duplicates by email
SELECT email, COUNT(*)
FROM kontakti
WHERE client_id = '[UUID]'
GROUP BY email
HAVING COUNT(*) > 1;

-- Delete duplicates (keep oldest)
DELETE FROM kontakti a
USING kontakti b
WHERE a.id > b.id
AND a.email = b.email
AND a.client_id = '[UUID]';
```

### Workflow Errors

**Problem:** Workflow fails at Apollo node
- Check API key is valid
- Verify quota not exceeded (check Apollo dashboard)
- Try reducing `per_page` parameter

**Problem:** Gemini node fails
- Check Google Cloud quota
- Verify service account permissions
- Try reducing prompt length

**Problem:** Instantly.ai node fails
- Check domain is verified
- Verify campaign ID exists
- Check email quota not exceeded
- Review Instantly.ai status page

### Dashboard Issues

**Problem:** Stats showing incorrect numbers
- Views may be cached, wait 5 minutes
- Check date filters in view definitions
- Verify client_id matches everywhere

**Problem:** Approve button not working
- Check Supabase RLS policies
- Verify user has update permission on `linkedin_content` table
- Check browser console for errors

---

## Security & Best Practices

### API Key Management

**NEVER commit API keys to git:**
- Store in n8n credentials manager only
- Use environment variables for local testing
- Rotate keys every 90 days

### Supabase Security

**Row Level Security (RLS):**
Ensure policies are enabled:
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('linkedin_content', 'kontakti');

-- Enable RLS if not enabled
ALTER TABLE linkedin_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontakti ENABLE ROW LEVEL SECURITY;
```

### Rate Limiting

**Respect API limits:**
- Apollo: 50-500 requests/day (depending on plan)
- LinkFinder: Check plan limits
- Instantly.ai: 150 emails/day per domain (recommended max)
- Gemini: 60 requests/minute

**Workflow wait times:**
- Keep 5-second delays between operations
- Don't parallelize email sending
- Spread workflows throughout the day

### LinkedIn Ban Prevention

**CRITICAL:** Do NOT automate connection sending
- Workflows only GENERATE messages and SAVE to database
- Client reviews and sends manually from dashboard
- Keep volume under 20 connections/day
- Vary connection times (don't send all at once)

---

## Maintenance Schedule

### Daily
- [ ] Check n8n execution logs for errors
- [ ] Monitor Instantly.ai bounce rates

### Weekly
- [ ] Review dashboard stats
- [ ] Check API quotas/usage
- [ ] Backup Supabase database

### Monthly
- [ ] Optimize email/message templates based on performance
- [ ] Review and adjust targeting criteria
- [ ] Update content themes
- [ ] Rotate API keys (optional)

### Quarterly
- [ ] Full system audit
- [ ] Cost analysis (API spend vs leads generated)
- [ ] Scaling recommendations

---

## Support & Resources

### Documentation Links
- **Apollo.io API:** https://apolloio.github.io/apollo-api-docs/
- **Instantly.ai API:** https://developer.instantly.ai/
- **n8n Docs:** https://docs.n8n.io/
- **Supabase Docs:** https://supabase.com/docs
- **Gemini API:** https://ai.google.dev/docs

### Contact
For setup issues or questions:
- Developer: [Your contact info]
- Client: Miloš Mitić (milos@ozavala.co.rs)

---

## Appendix: Configuration Reference

### Environment Variables

Create `.env.local` file (do NOT commit):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]

# n8n (for API access)
N8N_API_URL=http://localhost:5678
N8N_API_KEY=[your-n8n-api-key]

# Not needed in .env (use n8n credentials manager instead)
# APOLLO_API_KEY=[key]
# LINKFINDER_API_KEY=[key]
# INSTANTLY_API_KEY=[key]
```

### Workflow Schedules (Cron)

```
Content Posting:    0 9 * * 2,4      (Tue/Thu 9AM)
LinkedIn Connect:   0 10 * * 1-5     (Mon-Fri 10AM)
Cold Email:         0 9,12,15,18,21 * * 1-5  (Mon-Fri 9AM,12PM,3PM,6PM,9PM)
```

### Database Tables Reference

**linkedin_content:**
- Stores AI-generated posts
- Status: draft → approved → published
- Client approves via dashboard

**linkedin_posted_topics:**
- Tracks posted topics to avoid repeats
- 3-month lookback window

**kontakti (extended):**
- All leads (LinkedIn + Email)
- Filtered by lead_source field
- Tracks engagement (opened, replied, sentiment)

**Views:**
- `email_outreach_stats` - Daily email metrics
- `linkedin_outreach_stats` - Daily connection metrics
- `oz_avala_lead_pipeline` - Unified lead view for dashboard

---

## Success Metrics

Track these KPIs monthly:

| Metric | Target | Good | Excellent |
|--------|--------|------|-----------|
| Content engagement rate | 3% | 5% | 8%+ |
| LinkedIn acceptance rate | 20% | 30% | 40%+ |
| Email open rate | 30% | 40% | 50%+ |
| Email reply rate | 5% | 8% | 12%+ |
| Positive replies/month | 50 | 80 | 120+ |
| **Meetings booked/month** | **10** | **15** | **20+** |
| Cost per meeting | $50 | $30 | $20 |

**PRIMARY SUCCESS METRIC:** Meetings booked per month from cold email outreach.

---

## Next Steps After Setup

1. **Week 1-2:** Monitor closely, adjust volume, optimize templates
2. **Week 3-4:** Scale up email volume to full capacity
3. **Month 2:** Start A/B testing email subject lines
4. **Month 3:** Launch additional campaigns for different industries
5. **Month 4+:** Consider adding SMS outreach or WhatsApp integration

---

## Changelog

- **2026-02-16:** Initial setup guide created
- Client: Omladinska zadruga Avala
- Developer: AI Growth Agency / SmartFlow Hub

---

**End of Setup Guide**
