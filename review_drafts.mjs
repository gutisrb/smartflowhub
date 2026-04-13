import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {}
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BELGRADE = /beograd|bgd|novi beograd|zemun/i;

const { data } = await sb.from('contacts')
  .select('id,company_name,email,kategorija,niche,website,izvor,email_draft,intake_data,instagram_followers')
  .eq('client_id','69acf7e9-557e-4ca3-85bd-a785ef39e351')
  .eq('status','enriched')
  .neq('kategorija','Disqualified')
  .not('email_draft','is',null);

for (const r of data) {
  const lines = r.email_draft.split('\n');
  const subject = lines[0].replace('Subject: ','');
  const body = lines.slice(2).join('\n');
  const loc = r.intake_data?.location || '';
  const issues = [];

  // Grammar
  if (/jak digital|jak prisust|jaka prisust|jaku digital/.test(body)) issues.push('GRAMMAR: adjective-noun mismatch');
  if (/izgradili su jak/.test(body)) issues.push('GRAMMAR: jak → jako/snažno');
  // Location CTA
  if (/uživo ili online/.test(body) && loc && !BELGRADE.test(loc)) issues.push('LOCATION: offers uživo outside BG → ' + loc);
  // Full company name with dash in CTA
  if (r.company_name.includes('—') && body.includes(r.company_name)) issues.push('CTA: full name with em-dash');
  if (r.company_name.includes('®') && body.includes(r.company_name)) issues.push('CTA: ® symbol in name');
  // Weak copy
  if (/postoji sistem koji/.test(body)) issues.push('WEAK: postoji sistem koji');
  // No ** bold at all
  if (!body.includes('**')) issues.push('NO BOLD: draft has no formatting');
  // Wrong IG in subject (KunertKolica)
  if (body.includes('KunertKolica') || subject.includes('Kunert')) issues.push('WRONG IG: Kunert ref');
  // Check CTA line specifically
  const ctaLine = body.split('\n').find(l => l.includes('cal.com'));
  if (ctaLine) {
    if (ctaLine.includes('—') && !ctaLine.includes('SmartFlow')) issues.push('CTA: em-dash in company ref → ' + ctaLine.substring(0,80));
    if (ctaLine.includes('®')) issues.push('CTA: ® in CTA line');
  }

  const icon = issues.length ? '⚠' : '✓';
  console.log(icon + ' ' + r.company_name + ' [' + r.kategorija + '] <' + (r.email || 'no email') + '>');
  console.log('  Subject: ' + subject.substring(0,75));
  if (issues.length) {
    for (const i of issues) console.log('  ! ' + i);
  }
  console.log('');
}
console.log('Total:', data.length);
