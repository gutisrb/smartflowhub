/**
 * Scrape emails from real websites for enriched leads that have no email
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.trim() && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const CLIENT_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

async function scrapeEmail(url) {
  if (!url || url.includes('instagram.com') || url.includes('facebook.com') || url.includes('wa.me')) return null;

  const base = url.replace(/\/$/, '');
  const pagesToTry = [base, `${base}/contact`, `${base}/kontakt`, `${base}/pages/contact`, `${base}/o-nama`];

  for (const pageUrl of pagesToTry) {
    try {
      const jinaUrl = `https://r.jina.ai/${pageUrl}`;
      const res = await fetch(jinaUrl, {
        headers: { 'Accept': 'text/plain' },
        signal: AbortSignal.timeout(12000)
      });
      if (!res.ok) continue;
      const text = await res.text();
      const emailMatch = text.match(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g);
      if (emailMatch) {
        const valid = emailMatch.filter(e =>
          !e.includes('sentry') && !e.includes('example') && !e.includes('domain.com') &&
          !e.includes('wix') && !e.includes('shopify') && !e.includes('wordpress') &&
          !e.includes('noreply') && !e.includes('no-reply') && e.length < 60
        );
        if (valid.length > 0) return valid[0].toLowerCase();
      }
    } catch (e) {
      // continue
    }
  }
  return null;
}

// Get leads with real websites but no email
const { data: leads } = await supabase
  .from('kontakti')
  .select('id, full_name, email, instagram_handle, website')
  .eq('client_id', CLIENT_ID)
  .eq('status', 'enriched')
  .is('email', null)
  .not('website', 'is', null);

const realWebsiteLeads = (leads || []).filter(l =>
  l.website &&
  !l.website.includes('instagram.com') &&
  !l.website.includes('facebook.com') &&
  !l.website.includes('wa.me') &&
  !l.website.includes('alteg.io')
);

console.log(`Scraping ${realWebsiteLeads.length} leads with real websites...`);

for (const lead of realWebsiteLeads) {
  process.stdout.write(`  ${lead.full_name || lead.instagram_handle}... `);
  const email = await scrapeEmail(lead.website);
  if (email) {
    await supabase.from('kontakti').update({ email }).eq('id', lead.id);
    console.log(`email:${email} ✓ saved`);
  } else {
    console.log('no email found');
  }
}

console.log('\nDone');
