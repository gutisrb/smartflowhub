# SmartFlow Workflow Testing Guide

## Overview

This guide shows how to test the complete email funnel without waiting days for timers to expire.

## Prerequisites

- n8n running at http://localhost:5678
- Supabase access
- Test email address that you can check

## Quick Test (5 minutes)

### Step 1: Run Webhook Tests

```bash
bash test-workflows.sh
```

This creates 5 test leads:
1. Nurture flow lead (no booking)
2. Full sequence (48h+ booking)
3. Skipped day-before (24h booking)
4. In-person (skip video reminders)
5. Very soon booking (confirmation only)

### Step 2: Verify Leads Created

Open Supabase Studio and run:

```sql
SELECT ime, email, email_type, next_email_at, meeting_time
FROM kontakti
WHERE email LIKE '%@smartflow.test'
ORDER BY created_at DESC;
```

**Expected Results:**
- Test User 1: `email_type = 'nurture_day3'`, `next_email_at = NOW() + 3 days`
- Test User 2: `email_type = 'email_2'`, `next_email_at = NOW()` (immediate)
- Test User 3: `email_type = 'email_2'`, `next_email_at = NOW()`
- Test User 4: `email_type = 'email_2'`, `meeting_time` set
- Test User 5: `email_type = 'email_2'`, `meeting_time` set

### Step 3: Instant Email Trigger

Instead of waiting 3 days for nurture or 24h for confirmations, force immediate execution:

```sql
-- Trigger Email Master NOW for Test User 1 (nurture)
UPDATE kontakti
SET next_email_at = NOW()
WHERE email = 'test1@smartflow.test';
```

### Step 4: Manually Execute Email Master

1. Open n8n UI: http://localhost:5678
2. Go to "AI GROWTH - Email Master v5" workflow
3. Click "Execute Workflow" button
4. Watch the execution log

**Expected:** Test User 1 gets Nurture Day 3 email sent.

### Step 5: Verify Email Sent

Check execution log in n8n:
- Should show "Gmail-Nurture-Day3" node executed
- Should show "Update-Nurture-Day3" updated the database

Check Supabase:

```sql
SELECT email, nurture_3_poslat, email_type, next_email_at
FROM kontakti
WHERE email = 'test1@smartflow.test';
```

**Expected:**
- `nurture_3_poslat = true`
- `email_type = 'nurture_day7'`
- `next_email_at = NOW() + 4 days`

---

## Comprehensive Test Scenarios

### Scenario 1: Full Nurture Sequence (Non-Booker)

```bash
# 1. Create lead
curl -X POST "http://localhost:5678/webhook/lead-form" \
  -H "Content-Type: application/json" \
  -d '{
    "ime": "John Doe",
    "email": "john@test.com",
    "kompanija": "Test Inc"
  }'

# 2. Force Day 3 email
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'john@test.com';
# Execute Email Master manually

# 3. Force Day 7 email
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'john@test.com';
# Execute Email Master manually

# 4. Force Day 14 email
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'john@test.com';
# Execute Email Master manually

# 5. Verify sequence complete
SELECT * FROM kontakti WHERE email = 'john@test.com';
```

**Expected:** `nurture_3_poslat = true`, `nurture_7_poslat = true`, `nurture_14_poslat = true`, `email_type = NULL` (sequence ended)

---

### Scenario 2: Full Meeting Sequence (Video Call, 48h+ away)

```bash
# 1. Create and book
curl -X POST "http://localhost:5678/webhook/lead-form" ...
curl -X POST "http://localhost:5678/webhook/lead-part2" \
  -d '{"email":"video@test.com","demo_preference":"Video poziv","demo_time":"2026-02-20T14:00:00Z"}'

# 2. Force Email 2 (confirmation)
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'video@test.com';
# Execute Email Master

# 3. Force Email 3 (day before)
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'video@test.com';
# Execute Email Master

# 4. Force Email 4 (60 min before)
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'video@test.com';
# Execute Email Master

# 5. Force Email 5 (joining now)
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'video@test.com';
# Execute Email Master
```

**Expected:** All emails 2-5 sent in sequence, properly formatted with signature.

---

### Scenario 3: In-Person Meeting (Skip Email 4 & 5)

```bash
# 1. Book in-person meeting
curl -X POST "http://localhost:5678/webhook/lead-part2" \
  -d '{"email":"inperson@test.com","demo_preference":"Uživo u Beogradu","demo_time":"2026-02-20T14:00:00Z"}'

# 2. Force Email 2
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'inperson@test.com';
# Execute Email Master → Email 2 sent

# 3. Force Email 3
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'inperson@test.com';
# Execute Email Master → Email 3 sent

# 4. Try to force Email 4 (should be skipped by IF node)
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'inperson@test.com';
# Execute Email Master

# 5. Check logs
```

**Expected:** IF node before Email 4 blocks execution (demo_preference = "Uživo u Beogradu"), workflow skips to Update node.

---

### Scenario 4: Edge Case - Booking Tomorrow

```sql
-- Create lead who books for tomorrow at 2pm
INSERT INTO kontakti (ime, email, meeting_time, email_type, next_email_at, demo_preference, client_id)
VALUES (
  'Edge User',
  'edge@test.com',
  (CURRENT_DATE + INTERVAL '1 day' + TIME '14:00:00')::timestamptz,
  'email_2',
  NOW(),
  'Video poziv',
  '69acf7e9-557e-4ca3-85bd-a785ef39e351'
);

-- Execute Email Master → Email 2 sent
-- Check what email_type was set
SELECT email_type, next_email_at,
       EXTRACT(EPOCH FROM (meeting_time - NOW()))/3600 AS hours_until
FROM kontakti
WHERE email = 'edge@test.com';
```

**Expected:**
- If meeting is <24h away: `email_type = 'email_4'` (skip day-before)
- If meeting is >24h away: `email_type = 'email_3'` (full sequence)

---

### Scenario 5: Manual Status Override

```bash
# 1. Create lead in email sequence
# ... (use any scenario above)

# 2. In frontend, change status to "Deal Closed"
# Or via SQL:
UPDATE kontakti SET status = 'Deal Closed', email_type = NULL WHERE email = 'test@test.com';

# 3. Try to trigger Email Master
UPDATE kontakti SET next_email_at = NOW() WHERE email = 'test@test.com';
# Execute Email Master
```

**Expected:** Lead is filtered out by query (status = "Deal Closed" excluded), no email sent.

---

## Verification Checklist

After running all tests, verify:

- [ ] Nurture sequence works (Day 3, 7, 14)
- [ ] Meeting sequence works (Emails 2-5)
- [ ] In-person meetings skip Email 4 & 5
- [ ] Bookings <24h away skip day-before email
- [ ] Bookings <1h away skip all reminders except confirmation
- [ ] Manual status "Deal Closed" stops emails
- [ ] All emails have proper formatting (no \\n)
- [ ] All emails have signature (Nikola, smartflow.rs, phone)
- [ ] Email Master only processes leads where next_email_at <= NOW()
- [ ] Email Master only processes leads NOT in "Deal Closed" or "Not Interested"

---

## Troubleshooting

### Email not sending?

Check:
1. n8n execution logs for errors
2. Gmail credentials valid
3. Lead's `next_email_at` is in the past
4. Lead's `status` is not "Deal Closed" or "Not Interested"
5. Lead's `email_type` is valid (matches Switch node routes)

### Wrong email sent?

Check:
1. Email Master Switch node routing
2. Lead's `email_type` field
3. n8n execution log to see which path was taken

### Timing seems wrong?

Check:
1. UpdateE2 in Email Master - should calculate smart timing
2. Smart Timing Calculator in Workflow 2 - should set correct email_type based on hours until meeting
3. Lead's `meeting_time` vs NOW() difference

---

## Clean Up

After testing, remove test leads:

```sql
DELETE FROM kontakti WHERE email LIKE '%@smartflow.test';
DELETE FROM kontakti WHERE email LIKE '%@test.com';
```
