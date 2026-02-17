# System Prompt Validation & Testing

This document provides test cases and validation criteria for the AI Agent email generation system.

---

## Testing Strategy

### Manual Testing (Recommended First)
1. Use n8n's "Execute Node" feature on AI Agent node
2. Provide sample input data
3. Review AI-generated output
4. Validate against criteria below

### Automated Testing (Optional)
- Create test workflow with sample data
- Compare AI output against expected patterns
- Flag deviations for review

---

## Test Cases

### Test Case 1: Email 1 - Social Media Problem (AI Agent Service)

#### Input
```json
{
  "email": "test@example.com",
  "ime": "Marko",
  "kompanija": "Test Firma",
  "email_type": "email_1",
  "intake_data": {
    "problem": "Društvene mreže su na račun radnog vremena",
    "current_solution": "Sve radimo ručno - nemamo sistem",
    "why_ai": "Zamena ili dopuna radne snage",
    "ideal_solution": "AI agent koji odgovara na poruke automatski"
  },
  "meeting_date": "2026-02-20T10:00:00Z",
  "in_person": false
}
```

#### Expected Output Characteristics
✅ **Subject line**:
- Contains "potvrđen" or "sastanak"
- References "AI Agent" service
- Professional tone

✅ **Body**:
- Confirms meeting date/time (20. februar, 10:00h)
- Focuses on **AI Agent** service (NOT other services)
- Mentions specific capabilities:
  - "24/7" availability
  - "društvene mreže" or "Instagram/Facebook/WhatsApp"
  - "95% manje vremena" or similar time savings
- References their ideal_solution ("odgovara na poruke automatski")
- Emphasizes labor replacement (due to why_ai: "Zamena radne snage")
- Includes thought-provoking question about current time spent
- Proper sign-off with contact info

❌ **Must NOT contain**:
- "leadovi" (use "klijenti" or "poruke")
- "automatizacija" (use "AI sistemi")
- "bot" (use "AI agent")
- Generic openings ("Pre nego što razgovaramo...")
- Mentions of AI Marketing or AI Prodajni Sistemi (wrong service)

---

### Test Case 2: Email 7 - Marketing Problem (AI Marketing Service)

#### Input
```json
{
  "email": "ana@agency.rs",
  "ime": "Ana",
  "kompanija": "Digital Agency",
  "email_type": "email_7",
  "intake_data": {
    "problem": "Kasnimo za najnovijim trendovima i tehnologijom",
    "current_solution": "Koristimo neke alate ali nisu povezani",
    "why_ai": "Prednost nad konkurencijom",
    "ideal_solution": "Video content creation bez production tima"
  },
  "meeting_date": "2026-02-18T14:00:00Z",
  "in_person": false
}
```

#### Expected Output Characteristics
✅ **Subject line**:
- Competitive framing (references "konkurencija" or "prednost")
- Problem-specific or action-oriented
- No emojis (unless explicitly approved by user)

✅ **Body**:
- References post-meeting timing ("Prošlo je par dana...")
- Focuses on **AI Marketing** service
- Competitive framing (due to why_ai: "Prednost nad konkurencijom"):
  - "dok drugi čekaju..."
  - "pre konkurencije..."
  - "prednost se dobija..."
- Mentions specific capabilities:
  - "4k video"
  - "Holivudska produkcija"
  - "9+ videa mesečno"
  - "viral framework-ima"
- Addresses current_solution ("alati koji nisu povezani")
- References ideal_solution ("video content bez tima")
- Asks thought-provoking question
- Low-pressure CTA

❌ **Must NOT contain**:
- Focus on AI Agent or AI Prodajni Sistemi
- Generic follow-up language
- Pushy sales tone
- Mention of "automatizacija"

---

### Test Case 3: Email 8 - No-Show Follow-Up (Sales Systems Problem)

#### Input
```json
{
  "email": "petar@b2b.rs",
  "ime": "Petar",
  "kompanija": "B2B Sales",
  "email_type": "email_8",
  "intake_data": {
    "problem": "Prevaziđeni prodajni sistemi, bez evidencije i statistike",
    "current_solution": "Imamo sistem ali ne funkcioniše kako treba",
    "why_ai": "Povećanje prodaje / efikasnosti",
    "ideal_solution": "Lead generation sa jasnim ROI metrikama"
  },
  "meeting_date": "2026-02-19T11:00:00Z",
  "in_person": false
}
```

#### Expected Output Characteristics
✅ **Subject line**:
- Empathetic check-in
- Examples: "Da li je sve u redu?", "Možemo ponovo da zakažemo?"
- NOT accusatory

✅ **Body**:
- Empathetic opening (no accusation for missing meeting)
- Acknowledges plans change, obligations arise
- Focuses on **AI Prodajni Sistemi** service
- Mentions demo is still ready
- Addresses their current_solution ("sistem ali ne funkcioniše")
- References ideal_solution (ROI metriki, lead generation)
- Emphasizes ROI and sales efficiency (due to why_ai)
- Low-pressure opt-out option
- Easy reschedule CTA

❌ **Must NOT contain**:
- Accusatory tone ("Zašto niste došli?")
- Pushy language
- Focus on other services
- No empathy or understanding

---

### Test Case 4: Nurture_2 - Long-Term Re-Engagement (Integration Problem)

#### Input
```json
{
  "email": "milica@firma.rs",
  "ime": "Milica",
  "kompanija": "Tradicija d.o.o.",
  "email_type": "nurture_2",
  "intake_data": {
    "problem": "Slaba onlajn prisutnost",
    "current_solution": "Probali smo rešenja ali nisu ispunila očekivanja",
    "why_ai": "To je neizbežna budućnost",
    "ideal_solution": "Kompletan digitalni sistem prilagođen našoj industriji"
  },
  "meeting_date": null,
  "in_person": false
}
```

#### Expected Output Characteristics
✅ **Subject line**:
- Problem-focused or value-driven
- Industry-specific or insight-based
- NOT "Are you still interested?" (needy)

✅ **Body**:
- Soft check-in (no desperation)
- Delivers value first (insight, trend, case study)
- Focuses on **AI Integracija** service (broadest offering for "Slaba onlajn prisutnost")
- Addresses current_solution ("probali rešenja ali nisu ispunila očekivanja"):
  - Acknowledges past failures
  - Differentiates custom-built vs off-the-shelf
- References ideal_solution ("kompletan digitalni sistem")
- Future-focused framing (due to why_ai: "neizbežna budućnost")
- Mentions free demo availability
- Low-pressure, helpful expert tone

❌ **Must NOT contain**:
- Needy language ("Jeste li još uvek zainteresovani?")
- Generic nurture copy
- No acknowledgment of their past failures
- Pushy sales tone

---

## Validation Criteria

### Language & Tone Checklist

Use this checklist for EVERY email generated:

#### Forbidden Words ❌
- [ ] Contains "leadovi"? (should use "klijenti" or "poruke")
- [ ] Contains "automatizacija"? (should use "AI sistemi")
- [ ] Contains "bot"? (should use "AI agent")
- [ ] Contains "jeftino"? (undermines premium positioning)
- [ ] Contains "alat"? (should use "sistem" or "rešenje")

#### Required Elements ✅
- [ ] Personalized to company name?
- [ ] References specific problem from intake_data?
- [ ] Mentions correct service (mapped from problem)?
- [ ] Uses motivation framing (competitive/ROI/future based on why_ai)?
- [ ] Includes specific numbers (95%, 24/7, 4k, etc.)?
- [ ] Refers to ideal_solution language?
- [ ] Professional but warm tone (Vi form)?
- [ ] Proper sign-off (Nikola, SmartFlow, contact info)?

#### Tone Requirements ✅
- [ ] Confident, not arrogant?
- [ ] Direct, not robotic?
- [ ] Helpful expert, not desperate salesperson?
- [ ] NO generic openings?
- [ ] Active voice (not passive)?
- [ ] Short paragraphs (2-3 sentences max)?

---

## Common Issues & Fixes

### Issue 1: AI Uses Wrong Service
**Symptom**: Email talks about AI Marketing when problem is "Društvene mreže"

**Root Cause**: Problem → Service mapping not clear in system prompt

**Fix**: Verify problem field exactly matches intake form options:
- "Društvene mreže su na račun radnog vremena" → AI Agent
- "Kasnimo za najnovijim trendovima i tehnologijom" → AI Marketing
- "Prevaziđeni prodajni sistemi, bez evidencije i statistike" → AI Prodajni Sistemi
- "Slaba onlajn prisutnost" → AI Integracija

---

### Issue 2: Generic/Robotic Language
**Symptom**: Email starts with "Pre nego što razgovaramo..." or similar generic phrases

**Root Cause**: AI defaulting to template-like language

**Fix**: Add negative examples to system prompt (already included), emphasize "NO generic openings" rule

---

### Issue 3: Uses Forbidden Words
**Symptom**: Email contains "leadovi", "automatizacija", "bot"

**Root Cause**: System prompt not clear enough on forbidden words

**Fix**: Review "Language Guidelines" section in system prompt, ensure it's emphasized

---

### Issue 4: Wrong Motivation Framing
**Symptom**: Email talks about ROI when why_ai is "Prednost nad konkurencijom"

**Root Cause**: Not reading why_ai field correctly

**Fix**: Verify intake_data.why_ai is properly passed to AI Agent node

---

### Issue 5: Not Personalized to Ideal Solution
**Symptom**: Email doesn't reference customer's specific ideal_solution text

**Root Cause**: System prompt not emphasizing mirroring customer language

**Fix**: Ensure "Customer Language Over Company Language" principle is followed

---

## Edge Case Testing

### Edge Case 1: Missing intake_data
**Input**: `intake_data: null`

**Expected**: AI generates generic professional email focusing on free demo value, without specific service recommendation

**Validation**: Email should NOT fail, should fall back gracefully

---

### Edge Case 2: Multiple Problems (User Selected Multiple)
**Input**: `problem: "Društvene mreže su na račun radnog vremena, Kasnimo za najnovijim trendovima"`

**Expected**: AI suggests integrated approach or full package (AI Agent + AI Marketing)

**Validation**: Email mentions both services or suggests comprehensive solution

---

### Edge Case 3: Unclear Problem Mapping
**Input**: `problem: "Nešto drugo što nije na listi"`

**Expected**: AI defaults to AI Integracija (broadest offering) and mentions all services

**Validation**: Email should NOT focus on wrong service, should be broad

---

### Edge Case 4: Very Short ideal_solution
**Input**: `ideal_solution: "AI"`

**Expected**: AI uses problem and why_ai to infer what they need, doesn't rely solely on ideal_solution

**Validation**: Email is still personalized to problem, not generic

---

### Edge Case 5: In-Person Meeting
**Input**: `in_person: true`

**Expected**: Email says "uživo" or "lično" instead of mentioning Zoom link

**Validation**: No Zoom link mentioned, location reference instead

---

## Quality Scoring Rubric

Rate each generated email on these dimensions (1-5 scale):

| Dimension | 1 (Poor) | 3 (Acceptable) | 5 (Excellent) |
|-----------|----------|----------------|---------------|
| **Personalization** | Generic template | Company name used | Deep intake_data integration |
| **Service Match** | Wrong service | Right service | Right service + specific capabilities |
| **Language Quality** | Uses forbidden words | Clean language | Customer language mirrored |
| **Tone** | Robotic/pushy | Professional | Confident expert, warm |
| **Specificity** | Vague benefits | Some numbers | Concrete numbers + context |
| **CTA** | No CTA or pushy | Present | Natural, low-pressure |

**Target**: All emails should score 4+ on every dimension.

---

## Sample Validation Session

### Step 1: Prepare Test Data
Create 5 test leads in Supabase (or use n8n manual execution) covering:
1. AI Agent focus (problem: Društvene mreže)
2. AI Marketing focus (problem: Kasnimo za trendovima)
3. AI Prodajni focus (problem: Prevaziđeni sistemi)
4. AI Integracija focus (problem: Slaba prisutnost)
5. Edge case (missing intake_data)

### Step 2: Execute AI Agent
For each test lead:
1. Trigger workflow or execute AI Agent node
2. Capture output (subject + body)
3. Review against validation criteria

### Step 3: Score & Document
For each email:
- Fill out checklist (Forbidden Words, Required Elements, Tone)
- Assign quality scores (1-5 on each dimension)
- Note any issues or improvements needed

### Step 4: Iterate
- If scores < 4 on any dimension, refine system prompt
- Re-test until all emails score 4+
- Document any prompt changes

---

## Production Monitoring

### Weekly Review (First 4 Weeks)
- Review 10 random sent emails
- Check for quality issues
- Update system prompt if patterns emerge

### Monthly Review (After 4 Weeks)
- Review 5 random sent emails
- Monitor for drift (AI starting to use generic language)
- Refresh system prompt if needed

### Red Flags to Watch For
🚩 Customer complaints about email tone
🚩 Emails using forbidden words
🚩 Wrong service recommended
🚩 Generic/robotic language returning
🚩 Low reply rates compared to baseline

---

## Troubleshooting

### AI Agent Returns Error
**Possible Causes**:
- Gemini API key expired/invalid
- Rate limit exceeded
- Malformed input data
- System prompt too long

**Debug Steps**:
1. Check n8n error logs
2. Verify Gemini API credentials
3. Test with minimal input
4. Reduce system prompt length if needed

---

### AI Returns Malformed JSON
**Possible Causes**:
- System prompt not clear on output format
- AI adding explanation text before/after JSON
- Special characters breaking JSON

**Fix**:
- Add JSON parsing with error handling
- Emphasize "Return ONLY valid JSON" in system prompt
- Strip markdown code blocks if AI wraps response

---

### Emails Too Long/Short
**Possible Causes**:
- System prompt length guidelines not clear
- AI over-explaining

**Fix**:
- Add specific length targets to system prompt
- Example: "4-6 short paragraphs for email_1"
- Show examples of ideal length

---

## Success Metrics

### Email Quality Metrics
- **Personalization score**: 4.5+ average across all emails
- **Language compliance**: 0 forbidden words in production emails
- **Service match accuracy**: 95%+ correct service recommended

### Business Metrics
- **Open rate**: Baseline + compare to generic templates
- **Reply rate**: Measure engagement improvement
- **Meeting show rate**: Track no-show reduction for email_2/email_3
- **Conversion rate**: Measure from email_7/email_8/nurture_2

---

## Next Steps After Validation

Once all test cases pass:
1. ✅ Deploy to production workflow
2. ✅ Monitor first 50 emails closely
3. ✅ Collect user feedback
4. ✅ Iterate on system prompt based on results
5. ✅ Scale to higher volume

---

## Contact for Issues

If validation fails or unexpected behavior occurs:
- Review this document's troubleshooting section
- Check n8n node execution logs
- Verify input data format matches expected structure
- Test with minimal sample data
- Consult `ai-agent-email-prompt.md` for system prompt details
