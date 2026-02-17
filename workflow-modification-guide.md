# Workflow Modification Guide

## Workflow: AI GROWTH - Email Master v5 (hA8nFaedBOsHHy8D)

This guide provides step-by-step instructions for updating the email workflow to use AI-generated personalized emails.

---

## Current Workflow Structure

```
ScheduleTrigger (every 15min)
  ↓
SupabaseQuery-Fixed (fetch pending emails)
  ↓
AI Agent (EXISTING BUT EMPTY - needs configuration)
  ↓
Switch (route by email_type)
  ↓
[GmailE1, E2, E3, E4, E5, E6, E7, E8, Nurture2]
  ↓
Wait nodes
  ↓
Update Supabase nodes
```

---

## Modification Steps

### Step 1: Configure AI Agent Node

**Node**: `AI Agent` (already exists between SupabaseQuery-Fixed and Switch)

**Action**: Add Gemini LLM connection and system prompt

#### 1.1 Add Gemini Chat Model Sub-Node
- In the AI Agent node, add a **Chat Model** sub-node
- Select: `@google/generative-ai` (Gemini)
- Model: `gemini-2.0-flash-exp` (or latest Gemini model)
- Configure API credentials (should already be set up)

#### 1.2 Set System Prompt
Copy the entire content from `ai-agent-email-prompt.md` into the **System Prompt** field of the AI Agent node.

**Important**: The system prompt expects input in this format:
```javascript
{
  email: "...",
  ime: "...",
  kompanija: "...",
  email_type: "...",
  intake_data: { ... },
  meeting_date: "...",
  in_person: true/false
}
```

#### 1.3 Configure Output Parsing
The AI Agent should output JSON with two fields:
```json
{
  "subject": "Email subject",
  "body": "Email body"
}
```

Add a **JSON Parser** node or **Code** node after the AI Agent to:
1. Parse the AI response
2. Extract `subject` and `body`
3. Merge with original Supabase data
4. Pass to Switch node

**Suggested Code Node** (add between AI Agent and Switch):
```javascript
// Parse AI Agent response
const aiResponse = JSON.parse($json.output);

// Merge AI-generated content with original data
return {
  json: {
    ...$json,  // Keep all original Supabase fields
    ai_subject: aiResponse.subject,
    ai_body: aiResponse.body
  }
};
```

---

### Step 2: Update Gmail Nodes

Update **GmailE6, GmailE7, GmailE8, Gmail-Nurture2** to use AI-generated content instead of hardcoded templates.

#### Nodes to Modify:
1. **GmailE6** - Post-meeting value add
2. **GmailE7** - Post-meeting follow-up
3. **GmailE8 (No-Show)** - No-show follow-up
4. **Gmail-Nurture2** - Long-term nurture

#### Changes for Each Node:

**Current (Template-Based)**:
```
Subject: =Razmislili ste o koracima rasta? 💡
Message: =Zdravo {{$json.ime}},

Prošlo je par dana od našeg razgovora...
```

**New (AI-Generated)**:
```
Subject: ={{ $json.ai_subject }}
Message: ={{ $json.ai_body }}
```

#### Detailed Steps:
1. Open each Gmail node (E6, E7, E8, Nurture2)
2. Change **Subject** field from template text to: `={{ $json.ai_subject }}`
3. Change **Message** field from template text to: `={{ $json.ai_body }}`
4. Save changes

**Note**: GmailE1, E2, E3 can optionally be updated the same way, or keep as simple templates since they're low-personalization reminders.

---

### Step 3: Remove/Repurpose Email 6

**Current**: Email 6 (GmailE6) is a generic post-meeting summary.

**New Approach**: Repurpose as post-meeting value add (industry insights, case studies, resources).

#### Option A: Keep and Repurpose
- Keep GmailE6 node
- Update to use AI-generated content (already done in Step 2)
- AI will generate value-add content based on system prompt instructions for `email_type: "email_6"`

#### Option B: Replace with Nurture Step
- Delete GmailE6, WaitE6, UpdateE6 nodes
- Update Switch node to route `email_6` to `Gmail-Nurture2` instead
- Treat as additional nurture touchpoint

**Recommended**: **Option A** - Keep and repurpose, since the system prompt already handles email_6 as value-add.

---

### Step 4: Update Supabase Qualification Workflow (Optional)

**Workflow**: oaSDcjiIMBI0UocZ (Qualification workflow)

**Current**: Webhook → Gemini qualification → Parse → Insert Supabase

**Changes Needed**:
1. Ensure `intake_data` field stores full form data as JSONB
2. Map new intake form fields:
   - `problem`
   - `current_solution`
   - `why_ai`
   - `ideal_solution`

#### Suggested Code Node (before Supabase Insert):
```javascript
// Extract webhook form data
const formData = $json.body;

// Structure intake_data
const intake_data = {
  problem: formData.problem,
  current_solution: formData.current_solution,
  why_ai: formData.why_ai,
  ideal_solution: formData.ideal_solution
};

// Return structured data for Supabase insert
return {
  json: {
    email: formData.email,
    ime: formData.ime,
    kompanija: formData.kompanija,
    telefon: formData.telefon,
    meeting_date: formData.cal_meeting_date,  // From Cal.com
    in_person: formData.meeting_type === 'in-person',
    email_type: 'email_1',  // First email
    intake_data: intake_data,  // Store as JSONB
    status: 'Novi',
    // ... other fields
  }
};
```

---

## Testing Checklist

### Pre-Deployment Testing

- [ ] AI Agent node has Gemini Chat Model configured
- [ ] System prompt from `ai-agent-email-prompt.md` is copied into AI Agent
- [ ] JSON Parser/Code node exists between AI Agent and Switch
- [ ] GmailE6 uses `={{ $json.ai_subject }}` and `={{ $json.ai_body }}`
- [ ] GmailE7 uses `={{ $json.ai_subject }}` and `={{ $json.ai_body }}`
- [ ] GmailE8 uses `={{ $json.ai_subject }}` and `={{ $json.ai_body }}`
- [ ] Gmail-Nurture2 uses `={{ $json.ai_subject }}` and `={{ $json.ai_body }}`
- [ ] Workflow is saved and activated

### Test Scenarios

**Test 1: Email 1 (Meeting Confirmation)**
1. Create test lead in Supabase with:
   - `email_type: "email_1"`
   - `intake_data`: {"problem": "Društvene mreže su na račun radnog vremena", ...}
   - `meeting_date`: future date
2. Trigger workflow manually
3. Verify AI generates personalized email with:
   - Meeting confirmation
   - AI Agent service focus
   - Specific capabilities mentioned

**Test 2: Email 7 (Post-Meeting Follow-Up)**
1. Create test lead with:
   - `email_type: "email_7"`
   - `intake_data`: {"problem": "Kasnimo za najnovijim trendovima", "why_ai": "Prednost nad konkurencijom", ...}
2. Trigger workflow
3. Verify AI generates:
   - Competitive framing (based on why_ai)
   - AI Marketing focus (based on problem)
   - References their ideal_solution

**Test 3: Nurture_2 (Long-Term Re-Engagement)**
1. Create test lead with:
   - `email_type: "nurture_2"`
   - `intake_data`: {"problem": "Prevaziđeni prodajni sistemi", "ideal_solution": "Automatski lead generation", ...}
2. Trigger workflow
3. Verify AI generates:
   - Problem-focused subject line
   - Industry insight or value
   - AI Prodajni Sistemi focus
   - Low-pressure CTA

---

## Rollback Plan

If AI-generated emails don't work as expected:

1. **Immediate Rollback**: Revert Gmail nodes to original template text
2. **Partial Rollback**: Keep AI generation for E7, E8, Nurture2 but use templates for E1, E2, E3, E6
3. **Debug**: Check AI Agent output using n8n's "Execute node" feature to see raw JSON response

**Backup**: Before making changes, **duplicate the workflow** (Create copy: "Email Master v5 - Backup")

---

## Maintenance

### Updating System Prompt
To refine email copy or add new rules:
1. Edit `ai-agent-email-prompt.md`
2. Copy updated prompt to AI Agent node in n8n
3. Test with sample lead
4. Deploy

### Monitoring Email Quality
- Review sent emails weekly
- Check for:
  - Proper personalization
  - Correct service recommendations
  - Natural Serbian language
  - No forbidden words (leadovi, automatizacija, bot)
- Adjust system prompt as needed

### Adding New Email Types
To add new email_type (e.g., `email_9`):
1. Add section to system prompt in `ai-agent-email-prompt.md`
2. Create new Gmail node in workflow
3. Add route in Switch node
4. Test and deploy

---

## Expected Results

### Before (Template-Based)
```
Subject: Razmislili ste o koracima rasta? 💡

Zdravo Marko,

Prošlo je par dana od našeg razgovora, pa sam hteo da proverim da li ste imali vremena da razmislite o predloženim koracima?

Znamo da je uvođenje AI-a velika odluka, ali rezultati u uštedi vremena su skoro momentalni.

Tu smo ako vam treba dodatno pojašnjenje.

Pozdrav,
Nikola
```
**Issues**: Generic, no personalization, vague benefits, doesn't reference their specific problem

### After (AI-Generated)
```
Subject: 95% manje vremena na društvenim mrežama - sledeći koraci za OZ Avala

Zdravo Marko,

Prošlo je nekoliko dana od našeg razgovora o AI Agent sistemu za OZ Avala. Hteo sam da proverim da li ste imali vremena da razmislite o implementaciji?

Razumem da je uvođenje AI sistema velika odluka, pogotovo kada treba da zameni ili dopuni radnu snagu. Međutim, konkretna ušteda je jasna: ako vaš tim trenutno provodi 20 sati nedeljno odgovarajući na poruke sa Instagram-a, Facebook-a i WhatsApp-a, AI Agent to svodi na 1 sat nedelju - samo za oversight.

To je 19 sati koje možete preusmeriti na kvalifikaciju kandidata, prodaju, ili razvoj novih usluga.

OZ Avala ima visok volumen poruka zbog prirode posla (oglasi za omladinske zadruge). Agent je dizajniran upravo za taj use case - analiza CV-jeva u slikama, odgovori na FAQ, kvalifikacija kandidata automatski.

Tu sam ako vam treba dodatno pojašnjenje ili želite da ponovo prođemo kroz implementaciju.

Pozdrav,
Nikola
SmartFlow
smartflow.rs
+381 641182200
```
**Improvements**: Personalized to company, specific numbers (95%, 20h → 1h), references their problem and industry, mentions their motivation (zamena radne snage), uses their ideal_solution context

---

## Technical Notes

### n8n Expression Syntax
- **Access AI output**: `{{ $json.ai_subject }}`, `{{ $json.ai_body }}`
- **Access intake data**: `{{ $json.intake_data.problem }}`
- **Conditional logic**: Use IF nodes if needed, but AI handles most logic

### JSON Output Validation
If AI Agent outputs malformed JSON:
- Add error handling in Code node
- Fallback to generic email template
- Log error to Supabase or monitoring tool

### Rate Limits
- Gemini API: ~60 requests/minute (check current limits)
- If hitting limits, add delay between AI calls or batch processing
- Consider upgrading to paid Gemini tier for higher limits

---

## Support

If issues arise:
1. Check AI Agent node output (use "Execute node" in n8n)
2. Verify system prompt is correctly formatted
3. Ensure intake_data is properly structured in Supabase
4. Test with minimal example lead data
5. Review `email-personalization-examples.md` for expected output patterns

For n8n-specific issues, use the n8n-mcp tools or consult n8n documentation.
