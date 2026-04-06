/**
 * One-shot: insert manually crafted drafts for the 5 leads
 * where Gemini rate limit prevented generation.
 *
 * Follows the exact same DM-fixed template as fix_and_draft_all.mjs.
 * Run from ai-growth-dashboard/:  node insert_manual_drafts.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k';
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function assembleDMEmail(subject, p1, companyName, clientsInstr, clients, booking) {
  const body = `Poštovani,

${p1}

Mislim da biste imali manje haosa, a bolju prodaju, reputaciju i odnos sa ${clientsInstr} — uz AI sistem koji vodi sve razgovore na društvenim mrežama 24/7 i beleži svaki upit.

Vaš tim štedi 15–20 sati nedeljno. Svaka poruka odgovorena. Svaki upit ispraćen.

Svaki razgovor, svaki detalj je na jednom mestu: ko je pisao, za šta pita, šta ga zanima, gde je stao.
Dobijate konkretne podatke pomoću kojih možete da prilagodite ponudu, procese, marketing — sve na osnovu onoga što Vam ${clients} zapravo govore.
Informacije koje trenutno jednostavno nemate.

Ali ovo nije šablonski chatbot.
Ovo je jedini agent na tržištu koji ima analizu slika i videa, i razume odgovore na stori — napravljen od nule.

Rezultat? Više prodaje, bez dodatnog posla.

Kada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za ${companyName} — besplatno i bez ikakvih obaveza, uživo ili online: https://cal.com/smartflow.rs/20min

Veliki pozdrav,

Nikola Guteša
Smartflow
Smartflow.rs
+381 64 118 2200`;
  return `Subject: ${subject}\n\n${body}`;
}

const drafts = [
  {
    name: 'FLOERTY ®',
    subject: 'FLOERTY — sistem koji rasterećuje tim od poruka o veličinama i dostupnosti',
    p1: 'Sa 128.000 pratilaca i jakim vizuelnim identitetom koji prati modne trendove, FLOERTY generiše konstantan tok DM poruka — pitanja o veličinama, dostupnosti i dostavi dolaze svakodnevno. Pretpostavljam da tim troši sate na odgovaranje na te upite, a da pritom nemate nikakav uvid u to šta Vam kupci zapravo traže, šta ih zanima, i gde odustaju od kupovine.',
    clientsInstr: 'kupcima', clients: 'kupci', booking: 'kupovine',
  },
  {
    name: 'Satovi As',
    subject: 'Satovi As — sistem koji rasterećuje tim od pitanja o autentičnosti i dostupnosti',
    p1: 'Sa 35.000 pratilaca i ekskluzivnom kolekcijom satova, svaki novi listing privlači kupce koji pre odluke moraju da potvrde autentičnost, stanje i dostupnost — i svaka sporija reakcija direktno znači izgubljen upit. A da pritom nemate nikakav uvid u to šta Vam kupci zapravo traže, šta ih zanima, i gde odustaju od upita.',
    clientsInstr: 'kupcima', clients: 'kupci', booking: 'upita',
  },
  {
    name: 'Wonderful Wonder',
    subject: 'Wonderful Wonder — sistem koji rasterećuje tim od zakazivanja i upita za tretmane',
    p1: 'Wonderful Wonder na Beogradskom Vodenom frontu je savršeno pozicioniran — jak vizuelni identitet i aktivna Instagram stranica svakodnevno privlači nove klijentkinje koje zakazuju putem DM-a. Pretpostavljam da tim stalno balansira između rada sa klijentima i odgovaranja na poruke, a da pritom nemate nikakav uvid u to šta Vam klijentkinje zapravo traže, šta ih zanima, i gde odustaju od zakazivanja.',
    clientsInstr: 'klijentkinjama', clients: 'klijentkinje', booking: 'zakazivanja',
  },
  {
    name: 'Aviva Ageless — Dr Mila Djordjevic',
    subject: 'Aviva Ageless — sistem koji rasterećuje tim od upita za tretmane i termine',
    p1: 'Dr Đorđević i Aviva Ageless u Nišu izgradili su jak digitalni prisustvo u sferi estetske medicine — profil sa 9.000 pratilaca privlači zainteresovane pacijente koji pre zakazivanja šalju poruke sa pitanjima o tretmanima, cenama i dostupnim terminima. A da pritom nemate nikakav uvid u to šta Vam klijenti zapravo traže, šta ih zanima, i gde odustaju od zakazivanja.',
    clientsInstr: 'klijentima', clients: 'klijenti', booking: 'zakazivanja',
  },
  {
    name: 'Dar Majke Prirode',
    subject: 'Dar Majke Prirode — sistem koji rasterećuje tim od pitanja o sastojcima i narudžbinama',
    p1: 'Sa 37.000 pratilaca i bogatim asortimanom prirodnih i biljnih proizvoda, Dar Majke Prirode privlači kupce kojima treba potvrda pre narudžbine — pitanja o sastojcima, dejstvima, kombinovanju i roku isporuke svakodnevno stižu u inbox. A da pritom nemate nikakav uvid u to šta Vam kupci zapravo traže, šta ih zanima, i gde odustaju od kupovine.',
    clientsInstr: 'kupcima', clients: 'kupci', booking: 'kupovine',
  },
];

console.log('Inserting 5 manual drafts…\n');

for (const d of drafts) {
  const fullDraft = assembleDMEmail(d.subject, d.p1, d.name, d.clientsInstr, d.clients, d.booking);

  // Only update if draft is still null
  const { data: lead } = await sb
    .from('contacts')
    .select('id, email_draft')
    .eq('client_id', SMARTFLOW_ID)
    .eq('company_name', d.name)
    .single();

  if (!lead) { console.log(`  ✗ ${d.name} — not found`); continue; }
  if (lead.email_draft) { console.log(`  ○ ${d.name} — already has draft, skipping`); continue; }

  const { error } = await sb.from('contacts').update({
    email_draft: fullDraft,
    status: 'enriched',
    service: 'social_media_system',
  }).eq('id', lead.id);

  if (error) console.error(`  ✗ ${d.name}: ${error.message}`);
  else        console.log(`  ✓ ${d.name} — draft saved, status → enriched`);
}

console.log('\nDone.');
