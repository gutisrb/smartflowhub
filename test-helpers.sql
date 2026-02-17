-- SmartFlow Workflow Testing SQL Helpers
-- Use these to manipulate timing for instant testing without waiting days

-- ============================================================================
-- INSTANT EMAIL TRIGGER (Set next_email_at to NOW)
-- ============================================================================

-- Trigger Email Master for specific lead
UPDATE kontakti
SET next_email_at = NOW()
WHERE email = 'test1@smartflow.test';

-- Trigger all test leads
UPDATE kontakti
SET next_email_at = NOW()
WHERE email LIKE '%@smartflow.test';

-- ============================================================================
-- VIEW TEST LEADS
-- ============================================================================

SELECT
  ime,
  email,
  email_type,
  next_email_at,
  meeting_time,
  demo_preference,
  status,
  created_at
FROM kontakti
WHERE email LIKE '%@smartflow.test'
ORDER BY created_at DESC;

-- ============================================================================
-- CHECK WHICH EMAILS WERE SENT
-- ============================================================================

SELECT
  ime,
  email,
  email_2_poslat,
  email_3_poslat,
  email_4_poslat,
  email_5_poslat,
  nurture_3_poslat,
  nurture_7_poslat,
  nurture_14_poslat
FROM kontakti
WHERE email LIKE '%@smartflow.test';

-- ============================================================================
-- SIMULATE TIME PROGRESSION (without waiting)
-- ============================================================================

-- Simulate "3 days passed" for nurture sequence
UPDATE kontakti
SET next_email_at = NOW() - INTERVAL '1 second'
WHERE email_type = 'nurture_day3'
AND email LIKE '%@smartflow.test';

-- Simulate "day before meeting" for Email 3
UPDATE kontakti
SET next_email_at = NOW() - INTERVAL '1 second'
WHERE email_type = 'email_3'
AND email LIKE '%@smartflow.test';

-- ============================================================================
-- RESET TEST LEADS (start over)
-- ============================================================================

DELETE FROM kontakti WHERE email LIKE '%@smartflow.test';

-- ============================================================================
-- TEST EDGE CASE: Booking for tomorrow
-- ============================================================================

-- Create lead who books for tomorrow at 2pm
-- This tests if day-before reminder (today 2pm) is handled correctly
INSERT INTO kontakti (
  ime, email, kompanija,
  email_type, next_email_at,
  meeting_time, meeting_link, demo_preference,
  status, izvor, client_id
) VALUES (
  'Edge Case User',
  'edge@smartflow.test',
  'Edge Company',
  'email_2',
  NOW(),  -- Email 2 should send now
  (CURRENT_DATE + INTERVAL '1 day' + TIME '14:00:00')::timestamptz,  -- Tomorrow 2pm
  'https://meet.google.com/test',
  'Video poziv',
  'Meeting Booked',
  'Test',
  '69acf7e9-557e-4ca3-85bd-a785ef39e351'
);

-- After Email 2 sends, check if Email 3 is smartly scheduled
-- Should be:
--   - If tomorrow 2pm is <24h away: Skip to email_4 (60min before)
--   - If tomorrow 2pm is >24h away: email_3 (day before)

-- ============================================================================
-- VERIFY SMART TIMING WORKED
-- ============================================================================

-- Check if leads with meetings <24h away correctly skip Email 3
SELECT
  ime,
  email,
  meeting_time,
  email_type,
  next_email_at,
  EXTRACT(EPOCH FROM (meeting_time - NOW()))/3600 AS hours_until_meeting,
  CASE
    WHEN EXTRACT(EPOCH FROM (meeting_time - NOW()))/3600 > 24 AND email_type = 'email_3' THEN '✓ Correct (day-before)'
    WHEN EXTRACT(EPOCH FROM (meeting_time - NOW()))/3600 BETWEEN 1 AND 24 AND email_type = 'email_4' THEN '✓ Correct (skipped day-before)'
    WHEN EXTRACT(EPOCH FROM (meeting_time - NOW()))/3600 < 1 AND email_type = 'email_5' THEN '✓ Correct (at meeting time)'
    ELSE '❌ Wrong timing'
  END as timing_check
FROM kontakti
WHERE email LIKE '%@smartflow.test'
AND meeting_time IS NOT NULL;

-- ============================================================================
-- TEST IN-PERSON MEETING (Should skip Email 4 & 5)
-- ============================================================================

-- In-person meetings should only get Email 2 & 3, then skip 4 & 5
-- Verify by checking execution logs or watching email_type progression

SELECT
  ime,
  demo_preference,
  email_2_poslat,
  email_3_poslat,
  email_4_poslat,  -- Should be NULL or FALSE for in-person
  email_5_poslat   -- Should be NULL or FALSE for in-person
FROM kontakti
WHERE demo_preference = 'Uživo u Beogradu'
AND email LIKE '%@smartflow.test';
