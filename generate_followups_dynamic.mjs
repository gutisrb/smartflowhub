import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SMARTFLOW_CLIENT_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE_NAME = 'kontakti';

const SYSTEM_PROMPT_PATH = join(__dirname, 'ai-agent-email-prompt.md');
const systemPrompt = readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');

async function generateFollowUp(lead) {
  const shortName = lead.company_name;
  const intake = lead.intake_data || {};
  const enrich = intake.enrichment || {};
  const igPr = enrich.instagram_profile || {};
  const contact = enrich.contact || {};
  const followers = igPr.followers || igPr.follower_count || 0;
  
  // Extracting the context from the first email draft if it exists
  const firstDraft = lead.email_draft || '';
  const firstDraftPreview = firstDraft.substring(0, 500);

  const followUpPrompt = `
${systemPrompt}

You are writing a FOLLOW-UP email for SmartFlow.
The lead was already sent a primary B-C-O email. Your job is to add a NEW layer of value / friction.

PRIMARY ANGLE: "The Invisible Intelligence"
- Every DM/Interaction is market research that is currently going to waste.
- The constraint is that without AI, this data isn't captured in a CRM.
- The outcome is having a real-time data feedback loop for sales and marketing.

LEAD CONTEXT:
Company: ${shortName}
Followers: ${followers.toLocaleString()}
Original Email Context:
<ORIGINAL_EMAIL>
${firstDraftPreview}
</ORIGINAL_EMAIL>

INSTRUCTIONS:
1. Reference the original approach loosely (e.g. "Nadovezujem se na prethodnu poruku...").
2. Introduce the "Invisible Intelligence" angle: explain how all the daily DMs they get are actually data points staying trapped in the inbox.
3. Keep it brief. 3 or 4 short paragraphs.
4. Soft CTA: Link to demo or a quick question.
5. Use proper Serbian Vocative case for: ${contact.name || 'Unknown'}.
6. Output MUST be valid JSON with strictly two keys: "subject" and "body".
7. Body must use HTML tags (<p>, <strong>, etc.).
8. Signature is included in the body.

Example JSON output:
{
  "subject": "Re: ${shortName} — dopuna (nevidljivi podaci)",
  "body": "<p>Dobar dan, [Ime],</p><p>Nadovezujem se na prošli mejl jer mislim da nisam stavio dovoljno naglaska na ono što zapravo gubite svakog dana.</p><p>Svaka poruka u vašem inboxu je tržišno istraživanje koje niko ne sakuplja — od toga šta klijente koči do toga zašto odustaju od kupovine. Bez sistema koji to hvata, ti podaci ostaju \"zakopani\" u DM-ovima.</p><p>Imam spreman demo koji pokazuje kako to rešavamo. Jeste li raspoloženi za kratak razgovor?</p><p style=\"margin-top:20px;\">Pozdrav,<br>Nikola<br>SmartFlow</p>"
}
`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(35000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: followUpPrompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('empty Gemini response');

    return JSON.parse(text);
  } catch (err) {
    console.warn(`  ⚠️  Follow-up generation failed for ${shortName}: ${err.message}`);
    return null;
  }
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const { data: leads, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('client_id', SMARTFLOW_CLIENT_ID)
    .eq('status', 'Kontaktiran')
    .eq('email_1_poslat', true)
    .eq('email_2_poslat', false);

  if (error) {
    console.error('Error fetching leads:', error);
    return;
  }

  console.log(`\n--- SmartFlow Dynamic Follow-up Generator ---`);
  console.log(`Processing ${leads.length} leads who were already contacted...${isDryRun ? ' [DRY RUN]' : ''}\n`);

  for (const lead of leads) {
    console.log(`Processing: ${lead.company_name}`);
    
    await delay(1000); 

    const result = await generateFollowUp(lead);
    
    if (result && result.subject && result.body) {
      const fullDraft = `Subject: ${result.subject}\n\n${result.body}`;
      
      if (isDryRun) {
        console.log(`  [DRY RUN] Generated for ${lead.company_name}:`);
        console.log(`  Subject: ${result.subject}`);
        console.log(`  Body: ${result.body.substring(0, 100)}...`);
      } else {
        const { error: updateError } = await supabase
          .from(TABLE_NAME)
          .update({ 
            email_2_draft: fullDraft
          })
          .eq('id', lead.id);
          
        if (updateError) {
          console.error(`  Error saving follow-up for ${lead.company_name}:`, updateError);
        } else {
          console.log(`  ✓ Saved dynamic follow-up for ${lead.company_name}`);
        }
      }
    } else {
      console.log(`  - Skipping follow-up for ${lead.company_name} due to generation error.`);
    }
  }
}

main();
