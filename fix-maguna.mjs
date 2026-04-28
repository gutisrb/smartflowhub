/**
 * fix-maguna.mjs — Fix Maguna modules + remove website-chatbot globally + seed crm_maguna + products
 * Run: node fix-maguna.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k'
const MAGUNA_ID = '0c25e7c2-360c-418a-816a-34444d304698'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ─── 1. Fix Maguna modules ────────────────────────────────────────────────────
async function fixMagunaModules() {
  console.log('Fixing Maguna modules...')
  // Delete old modules
  await sb.from('client_modules').delete().eq('client_id', MAGUNA_ID)

  const { error } = await sb.from('client_modules').insert([
    { client_id: MAGUNA_ID, module_key: 'social-chatbot',    is_enabled: true, display_name: 'AI Agent',  sort_order: 1, settings: null },
    { client_id: MAGUNA_ID, module_key: 'chatbot-analytics', is_enabled: true, display_name: 'Analitika', sort_order: 2, settings: null },
    { client_id: MAGUNA_ID, module_key: 'agent-leads',       is_enabled: true, display_name: 'Kupci',     sort_order: 3, settings: null },
    { client_id: MAGUNA_ID, module_key: 'agent-database',    is_enabled: true, display_name: 'Stolovi',   sort_order: 4, settings: null },
  ])
  if (error) throw new Error(`Module fix error: ${error.message}`)
  console.log('  ✅ Maguna modules: AI Agent, Analitika, Kupci, Stolovi')
}

// ─── 2. Remove website-chatbot from ALL clients ───────────────────────────────
async function removeWebsiteChatbot() {
  console.log('Removing website-chatbot from all clients...')
  const { data, error } = await sb
    .from('client_modules')
    .delete()
    .eq('module_key', 'website-chatbot')
    .select('client_id')
  if (error) throw new Error(`website-chatbot delete error: ${error.message}`)
  console.log(`  ✅ Removed from ${data?.length ?? 0} client(s)`)
}

// ─── 3. Create crm_maguna table via RPC (raw SQL) ─────────────────────────────
async function createCrmMagunaTable() {
  console.log('Creating crm_maguna table...')
  const sql = `
    CREATE TABLE IF NOT EXISTS crm_maguna (
      id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id        UUID NOT NULL REFERENCES clients(id),
      id_razgovora     TEXT,
      izvor            TEXT,
      full_name        TEXT,
      email            TEXT,
      telefon          TEXT,
      zdravstveni_cilj TEXT,
      proizvod         TEXT,
      status           TEXT DEFAULT 'Novi',
      razlog           TEXT,
      status_porudzbine TEXT,
      komentar         TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE crm_maguna ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='crm_maguna_select' AND tablename='crm_maguna') THEN
        CREATE POLICY crm_maguna_select ON crm_maguna FOR SELECT USING (true);
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='crm_maguna_insert' AND tablename='crm_maguna') THEN
        CREATE POLICY crm_maguna_insert ON crm_maguna FOR INSERT WITH CHECK (true);
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='crm_maguna_update' AND tablename='crm_maguna') THEN
        CREATE POLICY crm_maguna_update ON crm_maguna FOR UPDATE USING (true);
      END IF;
    END $$;
  `
  const { error } = await sb.rpc('exec_sql', { query: sql }).catch(() => ({ error: { message: 'rpc not available' } }))
  if (error) {
    // Try direct REST approach — table may already exist
    console.log('  ⚠ RPC not available, trying direct insert to check if table exists...')
  } else {
    console.log('  ✅ crm_maguna table created')
  }
}

// ─── 4. Seed crm_maguna ───────────────────────────────────────────────────────
async function seedCrmMaguna() {
  console.log('Seeding crm_maguna...')

  // Delete any existing rows first
  await sb.from('crm_maguna').delete().eq('client_id', MAGUNA_ID)

  const now = new Date()
  const hAgo = (h) => new Date(now - h * 3600000).toISOString()

  const customers = [
    { client_id: MAGUNA_ID, full_name: 'Jovana Filipović',  email: 'jovana.filipovic@gmail.com', telefon: '063 445 8821',  zdravstveni_cilj: 'Sklopivi stolovi',     proizvod: 'Sklopivi sto kutija BELI',              status: 'Poručio',       razlog: null,                  status_porudzbine: 'Poslato',     izvor: 'Instagram', created_at: hAgo(26) },
    { client_id: MAGUNA_ID, full_name: 'Marko Petrović',    email: 'marko.petrovic2@gmail.com',  telefon: '065 123 9988',  zdravstveni_cilj: 'Dečiji nameštaj',      proizvod: 'Sklopivi radni sto BELI',               status: 'Poručio',       razlog: null,                  status_porudzbine: 'Dostavljeno', izvor: 'Instagram', created_at: hAgo(120) },
    { client_id: MAGUNA_ID, full_name: 'Milica Jovanović',  email: 'milica.j@outlook.com',        telefon: null,            zdravstveni_cilj: 'Sklopivi klub stolovi', proizvod: 'Sklopivi klub sto 2u1',                status: 'Zainteresovan', razlog: 'Nema u crnoj boji',   status_porudzbine: null,          izvor: 'Facebook',  created_at: hAgo(48) },
    { client_id: MAGUNA_ID, full_name: 'Ana Đorđević',     email: 'ana.djordjevic@yahoo.com',    telefon: null,            zdravstveni_cilj: 'Sklopivi stolovi',     proizvod: 'Sklopivi sto zaobljeni ćoškovi',       status: 'Zainteresovan', razlog: 'Pita za dostupnost',  status_porudzbine: null,          izvor: 'Facebook',  created_at: hAgo(96) },
    { client_id: MAGUNA_ID, full_name: 'Dragan Tomić',     email: 'dragan.tomic@firma.rs',       telefon: null,            zdravstveni_cilj: 'Sklopivi stolovi',     proizvod: 'Sklopivi sto zaobljeni ćoškovi A427',  status: 'Zainteresovan', razlog: 'Pita za popust',       status_porudzbine: null,          izvor: 'Facebook',  created_at: hAgo(22) },
    { client_id: MAGUNA_ID, full_name: 'Nina Vasić',       email: null,                          telefon: null,            zdravstveni_cilj: 'Šminkanje / dekor',    proizvod: 'Stočić za šminkanje STILSKI',           status: 'Poručio',       razlog: null,                  status_porudzbine: 'Obrađuje se', izvor: 'Instagram', created_at: hAgo(48) },
    { client_id: MAGUNA_ID, full_name: 'Aleksandar Lukić', email: 'aleksandar.l@gmail.com',      telefon: null,            zdravstveni_cilj: 'Sklopivi stolovi',     proizvod: 'Sklopivi četvrtasti sto BELI',          status: 'Intervencija',  razlog: null,                  status_porudzbine: 'Reklamacija', izvor: 'Website',   created_at: hAgo(8) },
    { client_id: MAGUNA_ID, full_name: 'Tamara Milošević', email: 'tamara.m@gmail.com',          telefon: null,            zdravstveni_cilj: 'Dečiji nameštaj',      proizvod: 'Dečija kuhinjica S FRIZIDER',           status: 'Poručio',       razlog: null,                  status_porudzbine: 'Dostavljeno', izvor: 'Website',   created_at: hAgo(144) },
    { client_id: MAGUNA_ID, full_name: 'Jelena Marinović', email: 'jelena.marinovic@hotmail.com',telefon: null,            zdravstveni_cilj: 'Dečiji nameštaj',      proizvod: 'Kućica za barbike',                     status: 'Poručio',       razlog: null,                  status_porudzbine: 'Dostavljeno', izvor: 'Instagram', created_at: hAgo(168) },
    { client_id: MAGUNA_ID, full_name: 'Luka Đurić',      email: null,                          telefon: null,            zdravstveni_cilj: 'Sklopivi stolovi',     proizvod: 'Sklopivi sto polukružni CRNI',          status: 'Zainteresovan', razlog: 'Čeka više slika',     status_porudzbine: null,          izvor: 'Instagram', created_at: hAgo(2) },
    { client_id: MAGUNA_ID, full_name: 'Iva Stanković',    email: 'iva.stankovic@gmail.com',     telefon: null,            zdravstveni_cilj: 'Sklopivi radni stolovi',proizvod: 'Sklopivi radni sto CRNI',              status: 'Zainteresovan', razlog: 'Pita za dostavu u Niš',status_porudzbine: null,          izvor: 'Website',   created_at: hAgo(72) },
    { client_id: MAGUNA_ID, full_name: 'Stefan Nikolić',   email: null,                          telefon: '063 771 4422',  zdravstveni_cilj: 'Sklopivi radni stolovi',proizvod: 'Sklopivi radni sto BELI',              status: 'Zainteresovan', razlog: 'Pita za termin isporuke',status_porudzbine: null,         izvor: 'Instagram', created_at: hAgo(5) },
  ]

  const { error } = await sb.from('crm_maguna').insert(customers)
  if (error) throw new Error(`crm_maguna seed error: ${error.message}`)
  console.log(`  ✅ ${customers.length} customers seeded in crm_maguna`)
}

// ─── 5. Seed proizvodi for Maguna ─────────────────────────────────────────────
async function seedProizvodi() {
  console.log('Seeding proizvodi for Maguna...')

  // Remove any existing Maguna products
  await sb.from('proizvodi').delete().eq('client_id', MAGUNA_ID)

  const products = [
    { client_id: MAGUNA_ID, proizvod_id: 'mg-001', naziv: 'Sklopivi sto kutija BELI',                    kategorija: 'Sklopivi stolovi sa kutijom', brend: 'Maguna', cena: 20500, url: 'https://www.maguna.rs/sklopivi-sto-kutija-beli', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-002', naziv: 'Sklopivi klub sto 2u1',                        kategorija: 'Sklopivi klub stolovi',       brend: 'Maguna', cena: 29500, url: 'https://www.maguna.rs/sklopivi-klub-sto-2u1', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-003', naziv: 'Sklopivi radni sto BELI bez fioke (manji)',    kategorija: 'Sklopivi radni stolovi',      brend: 'Maguna', cena: 12500, url: 'https://www.maguna.rs/sklopivi-radni-sto-beli', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-004', naziv: 'Sklopivi radni sto CRNI bez fioke',            kategorija: 'Sklopivi radni stolovi',      brend: 'Maguna', cena: 13500, url: 'https://www.maguna.rs/sklopivi-radni-sto-crni', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-005', naziv: 'Sklopivi radni sto BELI bez fioke (veći)',     kategorija: 'Sklopivi radni stolovi',      brend: 'Maguna', cena: 18500, url: 'https://www.maguna.rs/sklopivi-radni-sto-beli-veci', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-006', naziv: 'Sklopivi sto sa zaobljenim ćoškovima A427',   kategorija: 'Sklopivi stolovi',            brend: 'Maguna', cena: 15900, url: 'https://www.maguna.rs/sklopivi-sto-zaobljeni-a427', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-007', naziv: 'Sklopivi sto sa zaobljenim ćoškovima BELI',   kategorija: 'Sklopivi stolovi',            brend: 'Maguna', cena: 14900, url: 'https://www.maguna.rs/sklopivi-sto-zaobljeni-beli', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-008', naziv: 'Sklopivi četvrtasti sto BELI',                kategorija: 'Sklopivi stolovi',            brend: 'Maguna', cena: 13900, url: 'https://www.maguna.rs/sklopivi-cetvrtasti-sto-beli', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-009', naziv: 'Sklopivi sto polukružni CRNI',               kategorija: 'Sklopivi stolovi',            brend: 'Maguna', cena: 16500, url: 'https://www.maguna.rs/sklopivi-sto-polukruzni-crni', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-010', naziv: 'Dečija kuhinjica mala',                       kategorija: 'Dečiji nameštaj',             brend: 'Maguna', cena: 12500, url: 'https://www.maguna.rs/decija-kuhinjica-mala', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-011', naziv: 'Dečija kuhinjica srednja veličina',           kategorija: 'Dečiji nameštaj',             brend: 'Maguna', cena: 14500, url: 'https://www.maguna.rs/decija-kuhinjica-srednja', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-012', naziv: 'Dečija kuhinjica S FRIZIDER',                kategorija: 'Dečiji nameštaj',             brend: 'Maguna', cena: 16500, url: 'https://www.maguna.rs/decija-kuhinjica-s-frizider', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-013', naziv: 'Kućica za barbike',                          kategorija: 'Dečiji nameštaj',             brend: 'Maguna', cena: 16500, url: 'https://www.maguna.rs/kucica-za-barbike', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-014', naziv: 'Stočić za šminkanje KLASIK',                 kategorija: 'Stočić za šminkanje',         brend: 'Maguna', cena: 11800, url: 'https://www.maguna.rs/stocic-za-sminkanje-klasik', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-015', naziv: 'Stočić za šminkanje STILSKI',                kategorija: 'Stočić za šminkanje',         brend: 'Maguna', cena: 12500, url: 'https://www.maguna.rs/stocic-za-sminkanje-stilski', status: 'Aktivan' },
    { client_id: MAGUNA_ID, proizvod_id: 'mg-016', naziv: 'Stočić sa TRI ogledala',                     kategorija: 'Stočić za šminkanje',         brend: 'Maguna', cena: 14500, url: 'https://www.maguna.rs/stocic-sa-tri-ogledala', status: 'Aktivan' },
  ]

  const { error } = await sb.from('proizvodi').insert(products)
  if (error) throw new Error(`proizvodi seed error: ${error.message}`)
  console.log(`  ✅ ${products.length} products seeded`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🪑  Fixing Maguna account...\n')
  try {
    await fixMagunaModules()
    await removeWebsiteChatbot()
    // crm_maguna table already created via supabase db push
    await seedCrmMaguna()
    await seedProizvodi()
    console.log('\n✅  All done!')
  } catch (err) {
    console.error('\n❌', err.message)
    process.exit(1)
  }
}

main()
