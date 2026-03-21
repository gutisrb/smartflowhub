import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTc0ODEsImV4cCI6MjA4NjA3MzQ4MX0.ZvJKvdaVIGPJMVxmVCALJzWuHsOfkQzNpWpC8W8tiR8';
const SMARTFLOW_CLIENT_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const GEMINI_KEY = 'AIzaSyBl_wYZKB1q3zSRoey0ORu5arB6Ww1h85A';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE_NAME = 'kontakti';
const SOURCE_FILTER = 'meta_ads_scrape';

const OFFER_BRIEF_PATH = join(__dirname, '../offer-brief.md');
const EMAIL_DRAFTS_PATH = '/Users/johhn/.gemini/antigravity/brain/95618e24-a33d-4d7c-abeb-607d1ddea4bf/email_drafts_review.md';

const offerBrief = readFileSync(OFFER_BRIEF_PATH, 'utf-8');
const masterDrafts = readFileSync(EMAIL_DRAFTS_PATH, 'utf-8');

async function generateDynamicDraft(lead) {
  const shortName = lead.company_name;
  const niche = lead.niche || 'nepoznato';
  const intake = lead.intake_data || {};
  const enrich = intake.enrichment || {};
  const igPr = enrich.instagram_profile || {};
  const igReels = enrich.instagram_reels || [];
  const adCount = intake.active_ads_count || 0;
  const adCopies = intake.ad_copies || [];
  const adCta = intake.ad_cta || '';
  const websiteContent = enrich.website_content || 'N/A';
  const contact = enrich.contact || {};
  
  const followers = igPr.followers || igPr.follower_count || 0;
  const reelSummary = igReels.length > 0
    ? `${igReels.length} reels, titles/captions: ${igReels.map(r => r.caption || r.title || '').join(' | ')}`
    : 'no reels data or 0 reels';

  const leadContext = `
LEAD PROFILE:
Company: ${shortName}
Website: ${lead.website || 'unknown'}
Niche: ${niche}
Target Decision Maker: ${contact.name || 'Unknown'}, ${contact.title || contact.seniority || 'Unknown'}

SOCIAL SIGNALS:
IG Followers: ${followers.toLocaleString()}
IG Posts total: ${igPr.posts_count || 0}
IG Bio: ${igPr.biography || 'none'}
Recent Reels Context: ${reelSummary}

AD SIGNALS:
Active ads: ${adCount}
Ad CTA: ${adCta}
Ad Copies Sample: ${adCopies.slice(0, 2).join(' | ')}

WEBSITE CONTENT (Truncated):
${websiteContent.substring(0, 1500)}
`;

  const prompt = `
You are tasked with generating a customized cold outreach email for SmartFlow.
You are writing as Nikola Guteša.

Here is the exact framework of what SmartFlow offers, how to position it, and the psychology to use:
<OFFER_BRIEF>
${offerBrief}
</OFFER_BRIEF>

Here are the master email drafts which show the structure, the hook, the tone, and how to discuss the services:
<MASTER_DRAFTS>
${masterDrafts}
</MASTER_DRAFTS>

Here is the specific lead you are writing to:
<LEAD_CONTEXT>
${leadContext}
</LEAD_CONTEXT>

INSTRUCTIONS:
1. Analyze the LEAD_CONTEXT. What is their biggest gap? (Are they missing videos? Are they losing DMs? Are they spending a lot on ads but need a system to catch leads?)
2. Choose the BEST offer angle (SMS, AIO, AIS, or a custom blend) based on the Offer Brief.
3. Terminology Rules (MANDATORY):
   - Use "X aktivnih reklama" instead of "X aktivnih reklamnih kampanja".
   - Turn "odgovaranje na poruke i komentare" to just "odgovaranje na poruke".
   - Avoid "trenutno vrtite" (too informal). Use professional alternatives like "aktivno se oglašavate" or "imate aktivne kampanje".
4. Grammar Rules (MANDATORY):
   - Use proper Serbian grammar for names (VOCATIVE case). For example, "Dobar dan, Olgice" instead of "Dobar dan Olgica".
   - Ensure the tone is professional yet intriguing.
5. Strategy Refinement ("Stvarno nema smisla"):
   - The "angry customer" angle (e.g., "Stvarno nema smisla") should ONLY be used if you open with a question about who is responsible for social media (e.g., "Ko u [kompanija] vodi...").
   - For other instances (AIO, AIS), use equally strong but more logical hooks. Do not force the "angry customer" line if the context doesn't fit. For example, instead of "Gde tačno nestaju klijenti? Stvarno nema smisla.", use "Gde odlazi profit od vaših reklama?" or "Zašto vaš sajt ne pretvara posetioce u klijente?".
6. Generate a highly personalized email draft in Serbian, following the exact tone, psychological hooks, and structure of the MASTER_DRAFTS, but adhering to the above refinements.
7. OUTLIER RULE: If the lead clearly appears to be international / non-Serbian speaking (e.g., website is fully in English, international training academy, contact name is foreign), you MUST dynamically adapt the email to English using the exact same psychological principles, OR politely frame it in a way that adapts to them.
8. Use objective, data-driven observations. DO NOT use "AI slop" or generic American sales jargon.
9. The signature is already handled, DO NOT add "Veliki pozdrav, Nikola Guteša..." at the end. Only return the Subject and the Body.
10. Output MUST be valid JSON with strictly two keys: "subject" and "body".

Example JSON output:
{
  "subject": "Ko u [kompanija] vodi komunikaciju sa klijentima?",
  "body": "Dobar dan [Ime u vokativu],\\n\\nStvarno nema smisla da..."
}
`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(35000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('empty Gemini response');

    const result = JSON.parse(text);
    const signature = `\n\nVeliki pozdrav,\n\nNikola Guteša\nSmartflow\nSmartflow.rs\n+381 64 118 2200`;
    return `Subject: ${result.subject}\n\n${result.body}${signature}`;
  } catch (err) {
    console.warn(`  ⚠️  Gemini generation failed for ${shortName}: ${err.message}`);
    return null;
  }
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
  const { data: leads, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('client_id', SMARTFLOW_CLIENT_ID)
    .eq('izvor', SOURCE_FILTER)
    .neq('kategorija', 'Disqualified')
    .order('prioritet_skor', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error);
    return;
  }

  console.log(`Generating dynamic drafts for ${leads.length} leads with Gemini 3 Flash...\n`);

  for (const lead of leads) {
    console.log(`Processing: ${lead.company_name}`);
    
    // Add a small delay to respect rate limits
    await delay(1000); 

    const draft = await generateDynamicDraft(lead);
    
    if (draft) {
      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update({ email_draft: draft })
        .eq('id', lead.id);
        
      if (updateError) {
        console.error(`  Error saving draft for ${lead.company_name}:`, updateError);
      } else {
        console.log(`  ✓ Saved custom dynamic draft for ${lead.company_name}`);
      }
    } else {
      console.log(`  - Skipping update for ${lead.company_name} due to generation error.`);
    }
  }
}

main();
