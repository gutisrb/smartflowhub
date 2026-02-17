# OZ Avala LinkedIn Mega Workflow - Setup Guide

## Overview

This mega workflow automates LinkedIn-based lead generation for **Omladinska zadruga Avala (OZ Avala)**, a youth employment agency in Belgrade, Serbia. It combines job discovery, decision-maker research, profile enrichment, and AI-powered personalized outreach.

---

## Workflow Architecture

### **Phase 1: Job Discovery**
```
Form Input → LinkedIn Job Scraper → Supabase (jobs table)
```

### **Phase 2: Decision Maker Research**
```
Get New Jobs → Apollo Org Search → Apollo People Search → Score & Filter → Supabase (kontakti table)
```

### **Phase 3: Lead Enrichment & Outreach**
```
Get New Leads → LinkFinder AI Profile Enrichment → Claude AI Message Generation → Supabase Update
```

---

## Database Schema (Supabase)

### Table: `oz_avala_jobs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (auto-generated) |
| `company_name` | text | Company posting the job |
| `job_title` | text | Job position title |
| `job_url` | text | LinkedIn job URL |
| `location` | text | Job location |
| `posted_date` | timestamp | When job was posted |
| `job_description` | text | Full job description |
| `company_linkedin_url` | text | Company LinkedIn page |
| `status` | text | new / processing / completed |
| `created_at` | timestamp | Record creation time |
| `updated_at` | timestamp | Last update time |
| `client_id` | uuid | Reference to `clients.id` (multi-tenancy) |

**SQL:**
```sql
CREATE TABLE oz_avala_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT,
  job_title TEXT,
  job_url TEXT UNIQUE,
  location TEXT,
  posted_date TIMESTAMP,
  job_description TEXT,
  company_linkedin_url TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  client_id UUID REFERENCES clients(id)
);

CREATE INDEX idx_jobs_status ON oz_avala_jobs(status);
CREATE INDEX idx_jobs_client ON oz_avala_jobs(client_id);
```

### Table: `oz_avala_leads` (extends existing `kontakti` table)

**Recommended: Add new columns to existing `kontakti` table:**

```sql
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS job_url TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS profile_about TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS profile_headline TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS personalized_message TEXT;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS relevance_score INTEGER;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'new';
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS message_sent_at TIMESTAMP;
```

**Status values:**
- `new` - Newly discovered lead
- `enriching` - Profile enrichment in progress
- `ready_to_send` - Message generated, awaiting approval
- `approved` - Message approved by team
- `sent` - Message sent to LinkedIn
- `responded` - Lead responded
- `qualified` - Lead qualified for interview

---

## Required API Keys & Credentials

### 1. **Apify** (LinkedIn Job Scraping)
- **What it does**: Scrapes LinkedIn job postings
- **Where to get**: https://apify.com
- **Actor to use**: `cheap_scraper/linkedin-job-scraper`
- **Configuration**:
  - Add Apify API token to n8n credentials
  - Configure actor run endpoint in HTTP Request node

### 2. **Apollo.io** (Lead Intelligence)
- **What it does**: Company search + contact discovery
- **Where to get**: https://apollo.io
- **API Key**: Dashboard → Settings → API
- **Configuration**:
  - Add API key to HTTP Request headers: `X-Api-Key: YOUR_KEY`

### 3. **LinkFinder AI** (Profile Enrichment)
- **What it does**: Extracts full LinkedIn profile data
- **Where to get**: https://linkfinderai.com
- **Configuration**:
  - Add Bearer token to HTTP Request headers: `Authorization: Bearer YOUR_TOKEN`
  - Use service: `linkedin_profile_to_linkedin_info`

### 4. **Anthropic Claude** (AI Message Generation)
- **What it does**: Generates personalized Serbian messages
- **Where to get**: https://console.anthropic.com
- **Model**: Claude 3.7 Sonnet (`claude-3-7-sonnet-20250219`)
- **Configuration**:
  - Add Anthropic API credentials in n8n
  - Connect to AI Agent node

### 5. **Supabase** (Database)
- **What it does**: Stores jobs, leads, and enrichment data
- **Project**: AI Growth Agency Dashboard
- **Database**: `ndazbdkytcksmhoabtgs`
- **Configuration**:
  - URL: `https://ndazbdkytcksmhoabtgs.supabase.co`
  - Anon Key: (from project settings)
  - Use Supabase nodes in n8n

---

## n8n Node Configuration

### Supabase Nodes (Replace Google Sheets)

#### **1. Insert Job into Supabase**
```
Node: Supabase
Operation: Insert
Table: oz_avala_jobs
Columns:
  company_name: {{ $json.companyName }}
  job_title: {{ $json.jobTitle }}
  job_url: {{ $json.jobUrl }}
  location: {{ $json.location }}
  posted_date: {{ $json.publishedAt }}
  job_description: {{ $json.jobDescription }}
  company_linkedin_url: {{ $json.companyUrl }}
  status: new
  client_id: [OZ_AVALA_CLIENT_UUID]
```

#### **2. Get New Jobs**
```
Node: Supabase
Operation: Get All
Table: oz_avala_jobs
Filters:
  - Column: status
    Operator: equals
    Value: new
  - Column: client_id
    Operator: equals
    Value: [OZ_AVALA_CLIENT_UUID]
Limit: 10
```

#### **3. Insert Lead into Kontakti**
```
Node: Supabase
Operation: Insert
Table: kontakti
Columns:
  ime: {{ $json.first_name }}
  prezime: {{ $json.last_name }}
  email: {{ $json.email }}
  telefon: {{ $json.phone_number }}
  linkedin_url: {{ $json.linkedin_url }}
  company: {{ $json.organization.name }}
  job_title: {{ $('Loop Over Jobs').item.json.job_title }}
  job_url: {{ $('Loop Over Jobs').item.json.job_url }}
  relevance_score: {{ $json.score }}
  status: Novi
  client_id: [OZ_AVALA_CLIENT_UUID]
```

#### **4. Update Lead with Message**
```
Node: Supabase
Operation: Update
Table: kontakti
Filters:
  - Column: id
    Operator: equals
    Value: {{ $('Loop Over Leads').item.json.id }}
Columns:
  profile_about: {{ $('Enrich LinkedIn Profile').item.json.about }}
  profile_headline: {{ $('Enrich LinkedIn Profile').item.json.headline }}
  personalized_message: {{ $json.output }}
  enrichment_status: ready_to_send
  updated_at: NOW()
```

---

## Workflow Execution Flow

### **1. Job Discovery (Manual Trigger)**
1. User fills out form:
   - Job Keywords: "construction, engineering, superintendent"
   - Location: "Belgrade, Serbia"
   - Number of Jobs: 20

2. Workflow scrapes LinkedIn jobs via Apify

3. Jobs saved to Supabase `oz_avala_jobs` table with `status = new`

### **2. Decision Maker Research (Scheduled: Daily at 9 AM)**
1. Get jobs with `status = new` from Supabase

2. For each job:
   - Search company in Apollo.io
   - Find HR/recruiting contacts
   - Score by relevance (title keywords + location)
   - Save top 5 to `kontakti` table with `status = Novi`

3. Update job `status = completed`

### **3. Lead Enrichment (Scheduled: Daily at 11 AM)**
1. Get leads with `enrichment_status = new` from `kontakti`

2. For each lead:
   - Enrich profile via LinkFinder AI
   - Generate personalized Serbian message via Claude
   - Update lead with enrichment data and message
   - Set `enrichment_status = ready_to_send`

### **4. Manual Review & Sending**
1. OZ Avala team reviews messages in dashboard

2. Approve messages by changing `enrichment_status` to `approved`

3. (Optional) Add ConnectSafely integration for automated sending

---

## Deployment Steps

### **Step 1: Create Supabase Tables**
```sql
-- Run in Supabase SQL Editor
-- (See SQL above in Database Schema section)
```

### **Step 2: Get OZ Avala Client ID**
```sql
SELECT id FROM clients WHERE email = 'ozavala@example.com';
-- Use this UUID in all workflow nodes
```

### **Step 3: Import Workflow into n8n**
1. Copy `OZ_Avala_LinkedIn_Mega_Workflow.json`
2. In n8n: Workflows → Import from File
3. Replace all `[YOUR_*]` placeholders with actual credentials

### **Step 4: Configure Credentials**
- Apify API token
- Apollo.io API key
- LinkFinder AI API key
- Anthropic API key
- Supabase URL + Anon Key

### **Step 5: Test with Sample Data**
1. Activate workflow
2. Submit form with test search criteria
3. Verify data appears in Supabase tables
4. Check that messages are generated in Serbian

### **Step 6: Set Up Schedules**
- Decision Maker Research: Daily at 9:00 AM CET
- Lead Enrichment: Daily at 11:00 AM CET

---

## Monitoring & Troubleshooting

### **Check Job Discovery**
```sql
SELECT * FROM oz_avala_jobs WHERE created_at > NOW() - INTERVAL '1 day' ORDER BY created_at DESC;
```

### **Check Lead Pipeline**
```sql
SELECT enrichment_status, COUNT(*)
FROM kontakti
WHERE client_id = '[OZ_AVALA_UUID]'
GROUP BY enrichment_status;
```

### **Find Failed Enrichments**
```sql
SELECT * FROM kontakti
WHERE enrichment_status = 'enriching'
AND updated_at < NOW() - INTERVAL '1 hour';
-- These likely failed, reset to 'new'
```

### **Common Issues**

| Issue | Cause | Solution |
|-------|-------|----------|
| No jobs scraped | Invalid Apify actor URL | Check actor ID and API token |
| Apollo returns 0 results | Company name mismatch | Improve company name extraction |
| Profile enrichment fails | LinkedIn URL format issue | Validate URL before sending to API |
| Messages in wrong language | Prompt configuration | Check Claude prompt specifies Serbian |

---

## Customization Options

### **1. Change Target Industries**
Edit Apollo People Search titles:
```json
"person_titles": [
  "HR",
  "Recruiting",
  "Talent",
  "Project Manager",
  "Construction Manager",  // Add industry-specific titles
  "Engineering Manager"
]
```

### **2. Adjust Message Tone**
Edit Claude system message:
```
Ti si profesionalni LinkedIn komunikator za Omladinsku zadrugu Avala.
Ton: [Formalan / Prijateljski / Casual]
Stil: [Direktan / Pripovedački / Edukativni]
```

### **3. Add More Enrichment Data**
LinkFinder AI returns 20+ fields:
- `companyName`
- `jobTitle`
- `addressWithCountry`
- `mobileNumber`
- Add these to Supabase update

### **4. Integrate with Existing Dashboard**
- Add Lead Enrichment status to `leads-table.tsx`
- Show personalized messages in chat interface
- Add "Send Message" button that calls ConnectSafely API

---

## Next Steps

1. ✅ Review workflow JSON
2. ✅ Create Supabase tables
3. ✅ Configure API credentials
4. ⏳ Import and test workflow
5. ⏳ Train OZ Avala team on approval process
6. ⏳ Monitor first week of production data

---

**Prepared for**: Omladinska zadruga Avala (OZ Avala)
**Date**: February 16, 2026
**Workflow Version**: 1.0
**Database**: Supabase (AI Growth Agency Project)
**Support**: Check n8n execution logs and Supabase table data