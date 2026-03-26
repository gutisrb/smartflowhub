/**
 * One-shot script: store manual IG handles + insert 7 new leads.
 * Run from ai-growth-dashboard/ directory.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k';
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── STEP 1: Patch manual IG handles into existing leads ─────────────────────
const handlePatches = [
  { id: '76f6d6c9-e791-4dab-9b43-7f42e6ba78f1', name: 'FLOERTY ®',            handle: 'floerty.us'   },
  { id: '93298e30-0da7-4111-9e47-b1723c5f7b80', name: 'Satovi As',             handle: 'satovi.as_'  },
  { id: 'a23f7d93-1b2e-4e9d-83f1-46530928d370', name: 'Medana — Gorana Dabić', handle: 'medanaaaa'   },
];

console.log('─── Patching manual IG handles ─────────────────────────');
for (const { id, name, handle } of handlePatches) {
  // Fetch current intake_data
  const { data: row } = await sb.from('contacts').select('intake_data').eq('id', id).single();
  const current = row?.intake_data || {};
  const enrichment = current.enrichment || {};

  const patch = {
    intake_data: {
      ...current,
      enrichment: {
        ...enrichment,
        manual_ig_handle: handle,   // picked up by enrich-instagram.mjs
      },
    },
  };

  const { error } = await sb.from('contacts').update(patch).eq('id', id);
  if (error) console.error(`  ✗ ${name}: ${error.message}`);
  else        console.log(`  ✓ ${name} → @${handle}`);
}

// ── STEP 2: Insert 7 new leads ───────────────────────────────────────────────
// Follower counts unknown — set kategorija = 'Topao' (will be corrected after enrichment)
// NOTE: update kategorija manually in the dashboard once follower counts are known.

const newLeads = [
  {
    company_name: 'Wonderful Wonder',
    website:      null,
    niche:        'kozmetika',
    kategorija:   'Topao',
    intake_data:  { manual_ig_handle: 'wonderfulwonder.bw', location: 'Belgrade Waterfront' },
  },
  {
    company_name: 'Prestiž',
    website:      'https://prestiz.rs',
    niche:        'moda',
    kategorija:   'Topao',
    intake_data:  { manual_ig_handle: 'prestiz.rs' },
  },
  {
    company_name: 'Aviva Ageless — Dr Mila Djordjevic',
    website:      null,
    niche:        'klinika_wellness',
    kategorija:   'Topao',
    intake_data:  { manual_ig_handle: 'aviva_ageless', location: 'Niš, Bulevar Nemanjića 12' },
  },
  {
    company_name: 'SL Beauty',
    website:      'https://slbeauty.rs',
    niche:        'kozmetika',
    kategorija:   'Topao',
    intake_data:  { manual_ig_handle: 'slbeauty_prirodnakozmetika' },
  },
  {
    company_name: 'Dar Majke Prirode',
    website:      'https://darmajkeprirode.com',
    niche:        'online_prodaja',
    kategorija:   'Topao',
    intake_data:  { manual_ig_handle: 'darmajkeprirode' },
  },
  {
    company_name: 'Fermini',
    website:      'https://fermini.rs',
    niche:        'moda',
    kategorija:   'Topao',
    intake_data:  { manual_ig_handle: 'fermini.official' },
  },
  {
    company_name: 'Ino Edukacija',
    website:      'https://inoedukacija.com',
    niche:        'obrazovanje',
    kategorija:   'Topao',
    intake_data:  { manual_ig_handle: 'ino.edukacija' },
  },
];

console.log('\n─── Inserting 7 new leads ───────────────────────────────');
for (const lead of newLeads) {
  const row = {
    ...lead,
    status:    'Lead',
    izvor:     'instagram_manual',
    client_id: SMARTFLOW_ID,
  };
  const { error } = await sb.from('contacts').insert(row);
  if (error) console.error(`  ✗ ${lead.company_name}: ${error.message}`);
  else        console.log(`  ✓ ${lead.company_name} (@${lead.intake_data.manual_ig_handle})`);
}

console.log('\nDone. Run: node enrich-instagram.mjs --source instagram_manual --reprocess');
