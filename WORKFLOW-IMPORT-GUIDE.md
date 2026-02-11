# How to Import & Configure Workflow 2

## Files You Have

1. **`IDE-PROMPT-EMAIL-COPY-REWRITE.txt`** - Paste in Antigravity to fix Email Master workflow
2. **`WORKFLOW-2-FIXED-NO-CODE.json`** - Import this directly into n8n (fixed version without code nodes)

---

## Step 1: Import Workflow 2 into n8n

1. **Open n8n** (http://localhost:5678 or your n8n instance)
2. **Click "Workflows"** in left sidebar
3. **Click "+ Add workflow"** button (top right)
4. **Click the 3 dots menu** (⋮) → **Import from File**
5. **Select** `WORKFLOW-2-FIXED-NO-CODE.json`
6. **Click "Import"**

The workflow is now in your n8n! ✅

---

## Step 2: Configure Cal.com Integration

### 2a. Create Cal.com Account (Free)

1. Go to https://cal.com
2. Sign up (free tier is fine)
3. Create your profile

### 2b. Create Event Types

Create 2 event types in Cal.com:

**Event Type 1: Video Demo Call**
- Name: "SmartFlow Video Demo"
- Duration: 15 minutes
- Location: Zoom or Google Meet (auto-generate link)
- Description: "Personalized demo of SmartFlow AI automation"

**Event Type 2: In-Person Meeting**
- Name: "SmartFlow Uživo Sastanak"
- Duration: 30 minutes
- Location: Custom (user will input address)
- Description: "In-person meeting in Belgrade"

**Save both event type IDs** - you'll need them next.

### 2c. Get Cal.com API Key

1. In Cal.com, go to **Settings** → **Developer**
2. Click **"Create API Key"**
3. Copy the API key

### 2d. Add Credential to n8n

1. In n8n, go to **Credentials** (left sidebar)
2. Click **"Add Credential"**
3. Search for **"Cal.com API"** (if not found, use "HTTP Header Auth")
4. Name: "Cal.com API"
5. Paste your API key
6. Save

---

## Step 3: Update Workflow with Your Cal.com IDs

1. **Open Workflow 2** in n8n
2. **Click on "Cal.com - Video Call" node**
3. Find the line: `eventTypeId: "YOUR_CAL_COM_VIDEO_CALL_EVENT_ID"`
4. Replace with your actual Video Call event type ID (e.g., `123456`)
5. **Click on "Cal.com - In-Person" node**
6. Find the line: `eventTypeId: "YOUR_CAL_COM_IN_PERSON_EVENT_ID"`
7. Replace with your actual In-Person event type ID (e.g., `789012`)
8. **Click "Save"**

---

## Step 4: Get Webhook URL for Intake Form

1. **In Workflow 2**, click on the **"Webhook - Part 2 Form"** node
2. **Click "Test workflow"** button (top right)
3. **Click "Listen for Test Event"**
4. **Copy the webhook URL** (looks like: `https://your-n8n.com/webhook/lead-part2`)
5. **Save this URL** - you'll paste it into your intake form code

---

## Step 5: Update Intake Form with Webhook URL

1. **Open your intake form code** (`components/forms/ai-agency-intake-form.tsx`)
2. **Find the line:**
   ```typescript
   const WEBHOOK_PART2_URL = "https://n8n.smartflow.rs/webhook/lead-part2"
   ```
3. **Replace with your actual webhook URL** from Step 4
4. **Save the file**

---

## Step 6: Fix Email Master Workflow (with Antigravity)

1. **Open Antigravity IDE** (must have n8n MCP access)
2. **Copy ENTIRE contents** of `IDE-PROMPT-EMAIL-COPY-REWRITE.txt`
3. **Paste into Antigravity chat**
4. **Send**
5. **Antigravity will:**
   - Fix the Switch node routing
   - Add email progression logic
   - Rewrite all email copy
   - Add new video_demo email branch

---

## Step 7: Activate Workflows

1. **Workflow 1** (Kvalifikacija i Email 1):
   - Open in n8n
   - Click **"Active"** toggle (top right)
   - Should turn green ✅

2. **Workflow 2** (Demo Booking - Part 2):
   - Open in n8n
   - Click **"Active"** toggle
   - Should turn green ✅

3. **Email Master v5**:
   - Open in n8n
   - Verify it's already active (should be)
   - If not, activate it

---

## Step 8: Test End-to-End

### Test 1: Abandoned Lead (Part 1 Only)

1. Go to your intake form
2. Fill out **Part 1 only**:
   - Ime: Test Korisnik
   - Email: your-email+test1@gmail.com
   - Kompanija: Test Kompanija
   - Prepreka: Odgovaranje na poruke klijenata
   - Nedeljni leadovi: 51-200
   - Trenutni alati: Excel/Google Sheets
3. **Click "Submit Part 1"**
4. **DO NOT fill out Part 2** - close the page

**Expected Results:**
- Check Supabase `agency_leads` table → New lead with `status: "Part 1 Only"`
- Check your email → Should receive "Zaboravili ste nešto?" email

### Test 2: Video Snimak

1. Go to your intake form
2. Fill out **Part 1 + Part 2**
3. Choose **"Video snimak"**
4. Submit

**Expected Results:**
- Check Supabase → Lead updated with `demo_preference: "Video snimak"`, `email_type: "video_demo"`
- Wait 30 minutes → Should receive "Vaš video demo je spreman" email
- After 2 days → Should receive follow-up email

### Test 3: Video Poziv

1. Fill out form
2. Choose **"Video poziv"**
3. Select a time (tomorrow, 10 AM)
4. Submit

**Expected Results:**
- Check Cal.com → New booking created
- Check Supabase → `meeting_link` saved
- Check email (within 2 min) → "Potvrđeno: Vidimo se..." email
- 24h before meeting → Reminder email
- 1h before → Reminder email
- At meeting time → "Ulazim na poziv" email

### Test 4: Uživo u Beogradu

1. Fill out form
2. Choose **"Uživo u Beogradu"**
3. Enter address: "Knez Mihailova 10, Beograd"
4. Select time
5. Submit

**Expected Results:**
- Same as Video Poziv
- Plus: `meeting_address` saved in Supabase
- Cal.com booking has location set

---

## Troubleshooting

### Issue: Webhook not triggering

**Solution:**
1. In n8n, go to Workflow 2
2. Click "Executions" tab
3. Look for errors
4. Check webhook URL matches form
5. Try "Test Webhook" button in n8n

### Issue: Cal.com integration failing

**Solution:**
1. Check API key is correct
2. Check event type IDs are correct (not "YOUR_CAL_COM...")
3. Test Cal.com API manually:
   ```bash
   curl -X POST https://api.cal.com/v1/bookings \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "eventTypeId": 123456,
       "start": "2026-02-15T10:00:00Z",
       "responses": {
         "name": "Test",
         "email": "test@example.com"
       }
     }'
   ```

### Issue: Emails not sending

**Solution:**
1. Check "Email Master v5" workflow is **Active**
2. Check `next_email_at` is in the past (use Supabase SQL editor)
3. Check Gmail credentials in n8n
4. Look at n8n execution logs for errors

### Issue: Email sequence not progressing

**Solution:**
- This is the bug we're fixing! Make sure you ran the IDE prompt to fix email progression
- Each email should update `email_type` to the next email
- Check Supabase after each email fires - `email_type` should change

---

## What Happens After Import

```
User submits Part 2 form
  ↓
Webhook receives data
  ↓
Find existing lead in Supabase (by email)
  ↓
Merge Part 2 data with Part 1 data
  ↓
Switch by demo_preference
  ↓
IF "Video snimak":
  → Set email_type = "video_demo"
  → Set next_email_at = NOW() + 30 min
  → Update Supabase
  → Email Master sends video email in 30 min

IF "Video poziv" OR "Uživo":
  → Call Cal.com API
  → Create booking
  → Get meeting_link
  → Set email_type = "email_2"
  → Set next_email_at = NOW() + 2 min
  → Update Supabase
  → Email Master sends confirmation in 2 min
  → Then 24h reminder → 1h reminder → etc.
```

---

## Next Steps

After all workflows are working:

1. **Run database migration** (`supabase/migrations/003_agency_leads_table.sql`)
2. **Deploy intake form** to smartflow.rs
3. **Test with real email addresses**
4. **Monitor first 10 leads** closely
5. **Adjust email copy** if needed
6. **Drive traffic** to form (Meta ads / organic)

---

Good luck! 🚀

If you get stuck, check n8n execution logs - they show exactly what went wrong at each step.
