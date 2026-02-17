#!/bin/bash
# SmartFlow Workflow Test Suite

BASE_URL="http://localhost:5678"
W1_WEBHOOK="lead-form"
W2_WEBHOOK="lead-part2"

echo "=== SMARTFLOW WORKFLOW TESTING ==="
echo ""

# Test 1: Intake + No Booking (Nurture Flow)
echo "Test 1: User fills form but doesn't book (should enter nurture)"
curl -X POST "$BASE_URL/webhook/$W1_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{
    "ime": "Test User 1",
    "email": "test1@smartflow.test",
    "kompanija": "Test Company 1",
    "prepreka": "Need automation",
    "nedeljni_leadovi": "50"
  }'
echo ""
echo "✓ Lead created - should have email_type=nurture_day3, next_email_at=+3 days"
echo ""

# Test 2: Booking 48h+ Away (Full Sequence)
echo "Test 2: User books meeting 48+ hours away (full reminder sequence)"
curl -X POST "$BASE_URL/webhook/$W2_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@smartflow.test",
    "ime": "Test User 2",
    "demo_preference": "Video poziv",
    "demo_time": "2026-02-15T16:49:17.100486",
    "prepreka": "Slow response time",
    "nedeljni_leadovi": "30"
  }'
echo ""
echo "✓ Booked for 48h+ away - should get Email 2→3→4→5"
echo ""

# Test 3: Booking 24h Away (Skip Day-Before)
echo "Test 3: User books meeting 24 hours away (skip day-before reminder)"
curl -X POST "$BASE_URL/webhook/$W2_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test3@smartflow.test",
    "ime": "Test User 3",
    "demo_preference": "Video poziv",
    "demo_time": "2026-02-14T15:49:17.100486"
  }'
echo ""
echo "✓ Booked for 24h away - should skip Email 3, get Email 2→4→5"
echo ""

# Test 4: In-Person Meeting (Skip Video Reminders)
echo "Test 4: User books in-person meeting (skip 60-min and 'joining now')"
curl -X POST "$BASE_URL/webhook/$W2_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test4@smartflow.test",
    "ime": "Test User 4",
    "demo_preference": "Uživo u Beogradu",
    "demo_time": "2026-02-15T16:49:17.100486",
    "meeting_address": "Knez Mihailova 10, Beograd"
  }'
echo ""
echo "✓ In-person meeting - should get Email 2→3, skip 4 & 5"
echo ""

# Test 5: Booking Very Soon (Confirmation Only)
echo "Test 5: User books meeting 2 hours away (confirmation only)"
curl -X POST "$BASE_URL/webhook/$W2_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test5@smartflow.test",
    "ime": "Test User 5",
    "demo_preference": "Video poziv",
    "demo_time": "2026-02-13T17:49:17.100486"
  }'
echo ""
echo "✓ Booked for <2h - should only get Email 2 (confirmation)"
echo ""

echo "=== TESTS COMPLETE ==="
echo ""
echo "To verify results:"
echo "1. Check Supabase kontakti table for 5 test leads"
echo "2. Check n8n execution logs for Workflow 1 & 2"
echo "3. Use SQL helper below to trigger Email Master instantly"
echo ""
