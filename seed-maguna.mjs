/**
 * Seed script: Maguna Dizajn demo account
 * Run: node seed-maguna.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEMO_EMAIL = 'demo@maguna.rs'
const DEMO_PASSWORD = 'MagunaDemo2026'

// Relative timestamps
function hoursAgo(h, m = 0) {
  const d = new Date()
  d.setHours(d.getHours() - h, d.getMinutes() - m, 0, 0)
  return d.toISOString()
}
function daysAgo(days, hour = 10, min = 0) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}

// ─── Step 1: Create auth user ─────────────────────────────────────────────────
async function createAuthUser() {
  console.log('Creating auth user...')
  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })
  if (error && !error.message.includes('already been registered')) {
    throw new Error(`Auth user error: ${error.message}`)
  }
  console.log('  Auth user OK:', data?.user?.id || 'already exists')
  return data?.user?.id
}

// ─── Step 2: Create client record ────────────────────────────────────────────
async function createClient_() {
  console.log('Creating client record...')
  const { data: existing } = await supabase
    .from('clients')
    .select('id, email')
    .eq('email', DEMO_EMAIL)
    .maybeSingle()

  if (existing) {
    console.log('  Client already exists:', existing.id)
    return existing.id
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ name: 'Maguna Dizajn', email: DEMO_EMAIL })
    .select('id')
    .single()

  if (error) throw new Error(`Client insert error: ${error.message}`)
  console.log('  Client created:', data.id)
  return data.id
}

// ─── Step 3: Add client modules ───────────────────────────────────────────────
async function addModules(clientId) {
  console.log('Adding modules...')
  const modules = [
    {
      client_id: clientId,
      module_key: 'social-chatbot',
      is_enabled: true,
      display_name: 'AI Inbox',
      sort_order: 1,
      settings: { platforms: ['instagram', 'facebook', 'website'] }
    },
    {
      client_id: clientId,
      module_key: 'website-chatbot',
      is_enabled: true,
      display_name: 'Website Chatbot',
      sort_order: 2,
      settings: null
    },
    {
      client_id: clientId,
      module_key: 'business-crm',
      is_enabled: true,
      display_name: 'Kupci',
      sort_order: 3,
      settings: {
        statuses: ['Upit', 'Zainteresovan', 'Poručio', 'Isporučeno', 'Reklamacija'],
        showAgencyMetrics: false
      }
    },
    {
      client_id: clientId,
      module_key: 'analytics',
      is_enabled: true,
      display_name: 'Analitika',
      sort_order: 4,
      settings: null
    },
  ]

  const { error } = await supabase
    .from('client_modules')
    .upsert(modules, { onConflict: 'client_id,module_key' })

  if (error) throw new Error(`Modules error: ${error.message}`)
  console.log(`  ${modules.length} modules upserted`)
}

// ─── Step 4: Add contacts (CRM customers) ────────────────────────────────────
async function addContacts(clientId) {
  console.log('Adding contacts...')
  const contacts = [
    {
      client_id: clientId,
      name: 'Jovana Filipović',
      email: 'jovana.filipovic@gmail.com',
      comment: 'Zainteresovana za sklopivi sto sa kutijom u beloj boji. Pita za dostavu u Kragujevac.',
      niche: 'Sklopivi sto kutija BELI',
      status: 'Poručio',
      izvor: 'Instagram DM',
      created_at: daysAgo(3, 14, 20),
    },
    {
      client_id: clientId,
      name: 'Stefan Nikolić',
      email: null,
      comment: 'Naručio 2 radna stola, čeka potvrdu dostave. Pita za rok isporuke.',
      niche: 'Sklopivi radni sto BELI',
      status: 'Upit',
      izvor: 'Instagram DM',
      created_at: daysAgo(1, 9, 15),
    },
    {
      client_id: clientId,
      name: 'Milica Jovanović',
      email: 'milica.j@outlook.com',
      comment: 'Pita da li je Klub Sto 2u1 dovoljno stabilan za svakodnevno korišćenje.',
      niche: 'Sklopivi klub sto 2u1',
      status: 'Zainteresovan',
      izvor: 'Facebook poruka',
      created_at: daysAgo(2, 11, 45),
    },
    {
      client_id: clientId,
      name: 'Ana Đorđević',
      email: 'ana.djordjevic@yahoo.com',
      comment: 'Traži okrugli sto za terasu. Zanima je dostupnost i dostava u Novi Sad.',
      niche: 'Sklopivi sto sa zaobljenim ćoškovima',
      status: 'Zainteresovan',
      izvor: 'Facebook poruka',
      created_at: daysAgo(4, 16, 30),
    },
    {
      client_id: clientId,
      name: 'Marko Petrović',
      email: 'marko.petrovic2@gmail.com',
      comment: 'Traži dečiji radni sto za sina (8 god). Pita za dimenzije stočića.',
      niche: 'Dečija kuhinjica',
      status: 'Poručio',
      izvor: 'Instagram DM',
      created_at: daysAgo(5, 12, 10),
    },
    {
      client_id: clientId,
      name: 'Tamara Milošević',
      email: 'tamara.m@gmail.com',
      comment: 'Dobila kuhinjicu, pita kako da sklopi pokretni deo. Upućena na YT video.',
      niche: 'Dečija kuhinjica S FRIZIDER',
      status: 'Isporučeno',
      izvor: 'Website Chat',
      created_at: daysAgo(6, 15, 55),
    },
    {
      client_id: clientId,
      name: 'Dragan Tomić',
      email: 'dragan.tomic@firma.rs',
      comment: 'Vlasnik kafića, zanima ga 5 sklopivih stolova za baštu. Pita za popust na veće količine.',
      niche: 'Sklopivi sto sa zaobljenim ćoškovima A427',
      status: 'Upit',
      izvor: 'Facebook poruka',
      created_at: daysAgo(1, 17, 40),
    },
    {
      client_id: clientId,
      name: 'Nina Vasić',
      email: null,
      comment: 'Želi stočić za šminkanje. Pita za razliku između STILSKI i KLASIK modela.',
      niche: 'Stočić za šminkanje',
      status: 'Poručio',
      izvor: 'Instagram DM',
      created_at: daysAgo(2, 19, 20),
    },
    {
      client_id: clientId,
      name: 'Aleksandar Lukić',
      email: 'aleksandar.l@gmail.com',
      comment: 'Dobio sto u pogrešnoj boji (crni umesto beli). Otvorio reklamaciju.',
      niche: 'Sklopivi četvrtasti sto BELI',
      status: 'Reklamacija',
      izvor: 'Website Chat',
      created_at: daysAgo(1, 10, 5),
    },
    {
      client_id: clientId,
      name: 'Jelena Marinović',
      email: 'jelena.marinovic@hotmail.com',
      comment: 'Kupila kućicu za barbike za ćerku. Veoma zadovoljna, planira i kuhinjicu.',
      niche: 'Kućica za barbike',
      status: 'Isporučeno',
      izvor: 'Instagram DM',
      created_at: daysAgo(7, 13, 0),
    },
    {
      client_id: clientId,
      name: 'Iva Stanković',
      email: 'iva.stankovic@gmail.com',
      comment: 'Pita za dostavu u Niš i koliko traje isporuka.',
      niche: 'Sklopivi radni sto CRNI',
      status: 'Zainteresovan',
      izvor: 'Website Chat',
      created_at: daysAgo(3, 8, 30),
    },
    {
      client_id: clientId,
      name: 'Luka Đurić',
      email: null,
      comment: 'Traži polukružni crni sto za ugao dnevne sobe.',
      niche: 'Sklopivi sto polukružni CRNI',
      status: 'Upit',
      izvor: 'Instagram DM',
      created_at: daysAgo(0, 8, 45),
    },
  ]

  const { error } = await supabase.from('contacts').insert(contacts)
  if (error) throw new Error(`Contacts error: ${error.message}`)
  console.log(`  ${contacts.length} contacts inserted`)
}

// ─── Step 5: Add razgovori (social inbox conversations) ───────────────────────
async function addRazgovori(clientId) {
  console.log('Adding razgovori (social inbox)...')

  const msgs = []

  const m = (convId, role, text, ts, platform, name, pic, extra = {}) => ({
    id_razgovora: convId,
    role,
    message: text,
    created_at: ts,
    platform,
    client_id: clientId,
    metadata: { name, profile_pic: pic, ...extra },
  })

  // ── Conversation 1: Instagram — Jovana, folding table with box ────────────
  msgs.push(
    m('ig_jovana', 'user', 'Zdravo! Imam pitanje za sklopivi sto sa kutijom u beloj boji — da li je dostupan?', hoursAgo(26, 15), 'instagram', 'Jovana Filipović', 'https://randomuser.me/api/portraits/women/44.jpg'),
    m('ig_jovana', 'assistant', 'Zdravo Jovana! Da, Sklopivi sto kutija BELI je dostupan. Cena je 20.500 RSD. Da li vam treba dostava?', hoursAgo(26, 10), 'instagram', 'Jovana Filipović', 'https://randomuser.me/api/portraits/women/44.jpg'),
    m('ig_jovana', 'user', 'Jeste, trebam dostavu u Kragujevac. Koliko košta?', hoursAgo(26, 5), 'instagram', 'Jovana Filipović', 'https://randomuser.me/api/portraits/women/44.jpg'),
    m('ig_jovana', 'assistant', 'Dostava u Kragujevac je 600 RSD, isporuka za 2–4 radna dana. Želite da naručite?', hoursAgo(26, 0), 'instagram', 'Jovana Filipović', 'https://randomuser.me/api/portraits/women/44.jpg'),
    m('ig_jovana', 'user', 'Da! Kako plaćam?', hoursAgo(25, 45), 'instagram', 'Jovana Filipović', 'https://randomuser.me/api/portraits/women/44.jpg'),
    m('ig_jovana', 'assistant', 'Plaćanje pouzećem pri preuzimanju 💳 Samo nam pošaljite adresu i broj telefona pa šaljemo!', hoursAgo(25, 40), 'instagram', 'Jovana Filipović', 'https://randomuser.me/api/portraits/women/44.jpg'),
    m('ig_jovana', 'user', 'Odlično! Adresa je Cara Dušana 45, Kragujevac, 063 445 8821', hoursAgo(25, 30), 'instagram', 'Jovana Filipović', 'https://randomuser.me/api/portraits/women/44.jpg'),
    m('ig_jovana', 'assistant', 'Hvala Jovana! Narudžbina je evidentirana, paket ide sutra 📦', hoursAgo(25, 25), 'instagram', 'Jovana Filipović', 'https://randomuser.me/api/portraits/women/44.jpg'),
  )

  // ── Conversation 2: Instagram — Stefan, delivery status (humanNeeded) ──────
  msgs.push(
    m('ig_stefan', 'user', 'Pozdrav, naručio sam dva radna stola pre 3 dana. Kad stižu?', hoursAgo(5, 20), 'instagram', 'Stefan Nikolić', 'https://randomuser.me/api/portraits/men/67.jpg'),
    m('ig_stefan', 'assistant', 'Zdravo Stefan! Proveravam vašu narudžbinu — možete li mi dati broj telefona ili adresu porudžbine?', hoursAgo(5, 15), 'instagram', 'Stefan Nikolić', 'https://randomuser.me/api/portraits/men/67.jpg'),
    m('ig_stefan', 'user', '063 771 4422, Beograd Čukarica', hoursAgo(5, 10), 'instagram', 'Stefan Nikolić', 'https://randomuser.me/api/portraits/men/67.jpg'),
    m('ig_stefan', 'assistant', 'Pronašao sam narudžbinu — pakovanje je u toku, isporuka sutra između 10 i 14h. Da li vam odgovara?', hoursAgo(5, 5), 'instagram', 'Stefan Nikolić', 'https://randomuser.me/api/portraits/men/67.jpg'),
    m('ig_stefan', 'user', 'Pa ne baš, sutra sam na poslu ceo dan. Može li prekosutra?', hoursAgo(4, 55), 'instagram', 'Stefan Nikolić', 'https://randomuser.me/api/portraits/men/67.jpg'),
    m('ig_stefan', 'system', '[HUMAN_NEEDED]', hoursAgo(4, 54), 'instagram', 'Stefan Nikolić', 'https://randomuser.me/api/portraits/men/67.jpg'),
  )

  // ── Conversation 3: Facebook — Milica, klub sto stability ─────────────────
  msgs.push(
    m('fb_milica', 'user', 'Dobar dan! Zanima me Sklopivi Klub Sto 2u1 — da li je stabilan dovoljno za ručavanje svaki dan?', daysAgo(2, 11, 45), 'facebook', 'Milica Jovanović', 'https://randomuser.me/api/portraits/women/23.jpg'),
    m('fb_milica', 'assistant', 'Dobar dan Milica! Da, Klub Sto 2u1 je napravljen od MDF-a visoke gustine i nosi do 30kg. Savršen za svakodnevno korišćenje.', daysAgo(2, 11, 50), 'facebook', 'Milica Jovanović', 'https://randomuser.me/api/portraits/women/23.jpg'),
    m('fb_milica', 'user', 'Super. A koje su dimenzije kad je rasklopljen?', daysAgo(2, 12, 0), 'facebook', 'Milica Jovanović', 'https://randomuser.me/api/portraits/women/23.jpg'),
    m('fb_milica', 'assistant', 'Kad je rasklopljen: 80 x 60 x 70 cm. Složen: 80 x 30 x 70 cm. Idealan za manje stanove 🏠', daysAgo(2, 12, 5), 'facebook', 'Milica Jovanović', 'https://randomuser.me/api/portraits/women/23.jpg'),
    m('fb_milica', 'user', 'Hvala, to je taman što mi treba! Ima li u crnoj boji?', daysAgo(2, 12, 10), 'facebook', 'Milica Jovanović', 'https://randomuser.me/api/portraits/women/23.jpg'),
    m('fb_milica', 'assistant', 'Trenutno je dostupan samo u beloj boji, ali crna varijanta se očekuje sledeći mesec. Mogu da vas obavestim kad bude dostupna?', daysAgo(2, 12, 15), 'facebook', 'Milica Jovanović', 'https://randomuser.me/api/portraits/women/23.jpg'),
  )

  // ── Conversation 4: Facebook — Dragan, bulk order for café ───────────────
  msgs.push(
    m('fb_dragan', 'user', 'Dobar dan! Vlasnik sam malog kafića i trebaju mi 5 sklopivih stolova za terasu. Imate li popust za veće količine?', hoursAgo(22, 30), 'facebook', 'Dragan Tomić', 'https://randomuser.me/api/portraits/men/47.jpg'),
    m('fb_dragan', 'assistant', 'Dobar dan Dragane! Da, za narudžbine od 5+ komada nudimo 10% popusta. Za 5 stolova A427 to bi bilo 5 × 15.900 = 79.500 RSD, sa popustom 71.550 RSD.', hoursAgo(22, 25), 'facebook', 'Dragan Tomić', 'https://randomuser.me/api/portraits/men/47.jpg'),
    m('fb_dragan', 'user', 'Odlično! Da li mogu da budu isporučeni odjednom i da li nudite montažu?', hoursAgo(22, 15), 'facebook', 'Dragan Tomić', 'https://randomuser.me/api/portraits/men/47.jpg'),
    m('fb_dragan', 'assistant', 'Isporuka u jednoj pošiljci je moguća. Stolovi se lako sklapaju bez alata — u kutiji dolazi upustvo. Montaža nije potrebna, dovoljno je 2 minuta 😊', hoursAgo(22, 10), 'facebook', 'Dragan Tomić', 'https://randomuser.me/api/portraits/men/47.jpg'),
    m('fb_dragan', 'user', 'Sjajno, šaljem vam adresu da ispostavite račun', hoursAgo(21, 50), 'facebook', 'Dragan Tomić', 'https://randomuser.me/api/portraits/men/47.jpg'),
    m('fb_dragan', 'system', '[HUMAN_NEEDED]', hoursAgo(21, 49), 'facebook', 'Dragan Tomić', 'https://randomuser.me/api/portraits/men/47.jpg'),
  )

  // ── Conversation 5: Instagram — Nina, vanity table comparison ─────────────
  msgs.push(
    m('ig_nina', 'user', 'Hej! Šta je razlika između Stočić za šminkanje STILSKI i KLASIK?', daysAgo(2, 19, 20), 'instagram', 'Nina Vasić', 'https://randomuser.me/api/portraits/women/5.jpg'),
    m('ig_nina', 'assistant', 'Zdravo Nina! KLASIK (11.800 RSD) ima jedno srednje ogledalo, STILSKI (12.500 RSD) ima tri ogledala (jedno centralno + dva bočna) i dodatne police za šminku. Ako koristiš profesionalnu šminku, STILSKI je bolji izbor ✨', daysAgo(2, 19, 25), 'instagram', 'Nina Vasić', 'https://randomuser.me/api/portraits/women/5.jpg'),
    m('ig_nina', 'user', 'Uzimam STILSKI! Kako plaćam?', daysAgo(2, 19, 30), 'instagram', 'Nina Vasić', 'https://randomuser.me/api/portraits/women/5.jpg'),
    m('ig_nina', 'assistant', 'Super izbor! Plaćanje je pouzećem. Pošalji nam adresu i broj telefona i šaljemo u roku od 1–2 radna dana 🚚', daysAgo(2, 19, 35), 'instagram', 'Nina Vasić', 'https://randomuser.me/api/portraits/women/5.jpg'),
  )

  // ── Conversation 6: Website — Aleksandar, wrong color complaint ───────────
  msgs.push(
    m('web_aleksa', 'user', 'Dobar dan, naručio sam BELI četvrtasti sto ali mi je stigao CRNI. Šta da radim?', hoursAgo(8, 30), 'website', 'Aleksandar Lukić', 'https://randomuser.me/api/portraits/men/55.jpg'),
    m('web_aleksa', 'assistant', 'Dobar dan! Izvinjavamo se zbog greške u isporuci. Otvaramo reklamaciju odmah. Možete zadržati crni sto ili zahtevati zamenu — šta preferirate?', hoursAgo(8, 25), 'website', 'Aleksandar Lukić', 'https://randomuser.me/api/portraits/men/55.jpg'),
    m('web_aleksa', 'user', 'Hoću beli, onaj koji sam naručio', hoursAgo(8, 20), 'website', 'Aleksandar Lukić', 'https://randomuser.me/api/portraits/men/55.jpg'),
    m('web_aleksa', 'assistant', 'Razumemo. Kurir dolazi da preuzme pogrešan sto, a beli šaljemo istog dana. Sve troškove zamene snosimo mi. Dobićete SMS potvrdu.', hoursAgo(8, 15), 'website', 'Aleksandar Lukić', 'https://randomuser.me/api/portraits/men/55.jpg'),
    m('web_aleksa', 'system', '[HUMAN_NEEDED]', hoursAgo(8, 14), 'website', 'Aleksandar Lukić', 'https://randomuser.me/api/portraits/men/55.jpg'),
  )

  // ── Conversation 7: Website — Tamara, children's kitchen assembly ─────────
  msgs.push(
    m('web_tamara', 'user', 'Zdravo! Dobila sam dečiju kuhinjicu, ali ne znam kako da sklopim vrata od frižidera.', daysAgo(5, 15, 55), 'website', 'Tamara Milošević', 'https://randomuser.me/api/portraits/women/61.jpg'),
    m('web_tamara', 'assistant', 'Zdravo Tamara! Na našem YouTube kanalu @magunadizajn ima video tutorijal za montažu kuhinjice (3 minuta). Vrata frižidera se zakače na dve plastične kopče sa leve strane — uvuci odozdo pa pritisni gore. 😊', daysAgo(5, 16, 2), 'website', 'Tamara Milošević', 'https://randomuser.me/api/portraits/women/61.jpg'),
    m('web_tamara', 'user', 'Sjajno, našla sam video! Hvala puno, uspela sam 🎉', daysAgo(5, 16, 30), 'website', 'Tamara Milošević', 'https://randomuser.me/api/portraits/women/61.jpg'),
    m('web_tamara', 'assistant', 'Odlično! Ukoliko bude još pitanja, tu smo. Hvala na kupovini! 🏠', daysAgo(5, 16, 32), 'website', 'Tamara Milošević', 'https://randomuser.me/api/portraits/women/61.jpg'),
  )

  // ── Conversation 8: Instagram — Luka, semicircular black table ────────────
  msgs.push(
    m('ig_luka', 'user', 'Pozdrav! Vidim imate polukružni crni sto — koliko je širok i da li staje u ugao?', hoursAgo(2, 10), 'instagram', 'Luka Đurić', 'https://randomuser.me/api/portraits/men/77.jpg'),
    m('ig_luka', 'assistant', 'Zdravo Luka! Sklopivi Sto Polukružni CRNI je prečnika 80cm. Perfektno se uklapa u ugao — ravna strana ide uz zid. Cena je 16.500 RSD + dostava.', hoursAgo(2, 5), 'instagram', 'Luka Đurić', 'https://randomuser.me/api/portraits/men/77.jpg'),
    m('ig_luka', 'user', 'Savršeno za moj salon! Mogu li videti još slika?', hoursAgo(1, 55), 'instagram', 'Luka Đurić', 'https://randomuser.me/api/portraits/men/77.jpg'),
    m('ig_luka', 'assistant', 'Naravno! Šaljem slike direktno. Sto je dostupan odmah, isporuka za 2 radna dana 📸', hoursAgo(1, 50), 'instagram', 'Luka Đurić', 'https://randomuser.me/api/portraits/men/77.jpg'),
  )

  // ── Conversation 9: Instagram — Marko, child's desk ──────────────────────
  msgs.push(
    m('ig_marko', 'user', 'Zdravo! Traži mi sin radni sto za učenje, ima 8 godina. Šta preporučujete?', daysAgo(5, 12, 10), 'instagram', 'Marko Petrović', 'https://randomuser.me/api/portraits/men/32.jpg'),
    m('ig_marko', 'assistant', 'Zdravo Marko! Za 8-godišnjaka savršen je Sklopivi Radni Sto BELI bez fioke (12.500 RSD) — visina 70cm, dovoljno za dete. Ima ravnu radnu površinu 80×50cm. Možete ga sklopiti kad nije potreban 📚', daysAgo(5, 12, 15), 'instagram', 'Marko Petrović', 'https://randomuser.me/api/portraits/men/32.jpg'),
    m('ig_marko', 'user', 'Zvuči dobro. Da li je bezbedan za dete, bez oštrih ivica?', daysAgo(5, 12, 20), 'instagram', 'Marko Petrović', 'https://randomuser.me/api/portraits/men/32.jpg'),
    m('ig_marko', 'assistant', 'Da, sve ivice su zaobljene i obrađene. MDF materijal je netoksičan i sertifikovan za dečiji nameštaj ✅', daysAgo(5, 12, 25), 'instagram', 'Marko Petrović', 'https://randomuser.me/api/portraits/men/32.jpg'),
    m('ig_marko', 'user', 'Odlično, poručujem! Adresa: Knez Mihailova 12, Beograd, 065 123 9988', daysAgo(5, 12, 35), 'instagram', 'Marko Petrović', 'https://randomuser.me/api/portraits/men/32.jpg'),
    m('ig_marko', 'assistant', 'Hvala Marko! Narudžbina je primljena, isporuka za 2 radna dana 🚀', daysAgo(5, 12, 40), 'instagram', 'Marko Petrović', 'https://randomuser.me/api/portraits/men/32.jpg'),
  )

  // ── Conversation 10: Website — Iva, delivery to Niš ──────────────────────
  msgs.push(
    m('web_iva', 'user', 'Pozdrav! Da li dostavljate u Niš i koliko čekam?', daysAgo(3, 8, 30), 'website', 'Iva Stanković', 'https://randomuser.me/api/portraits/women/26.jpg'),
    m('web_iva', 'assistant', 'Zdravo Iva! Da, dostavljamo u Niš! Rok isporuke je 3–5 radnih dana, a cena dostave je 700 RSD. Imate li na umu neki konkretan model?', daysAgo(3, 8, 35), 'website', 'Iva Stanković', 'https://randomuser.me/api/portraits/women/26.jpg'),
    m('web_iva', 'user', 'Da, crni radni sto. Ima li u magacinu?', daysAgo(3, 8, 40), 'website', 'Iva Stanković', 'https://randomuser.me/api/portraits/women/26.jpg'),
    m('web_iva', 'assistant', 'Sklopivi Radni Sto CRNI (13.500 RSD) je dostupan na stanju. Samo napred! 🖥️', daysAgo(3, 8, 45), 'website', 'Iva Stanković', 'https://randomuser.me/api/portraits/women/26.jpg'),
  )

  // Batch insert all messages
  const BATCH = 50
  for (let i = 0; i < msgs.length; i += BATCH) {
    const batch = msgs.slice(i, i + BATCH)
    const { error } = await supabase.from('razgovori').insert(batch)
    if (error) throw new Error(`Razgovori batch error: ${error.message}`)
  }
  console.log(`  ${msgs.length} messages inserted across ${new Set(msgs.map(m => m.id_razgovora)).size} conversations`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🪑  Seeding Maguna Dizajn demo account...\n')
  try {
    await createAuthUser()
    const clientId = await createClient_()
    await addModules(clientId)
    await addContacts(clientId)
    await addRazgovori(clientId)
    console.log('\n✅  Done!')
    console.log(`\nLogin: ${DEMO_EMAIL}`)
    console.log(`Password: ${DEMO_PASSWORD}`)
    console.log(`Client ID: ${clientId}`)
  } catch (err) {
    console.error('\n❌  Error:', err.message)
    process.exit(1)
  }
}

main()
