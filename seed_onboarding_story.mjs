/**
 * seed_onboarding_story.mjs — seeds ONE connected hero story per demo tenant so
 * the onboarding can walk the REAL modules and show the exact same customer in
 * the Inbox -> CRM -> Termini/Order tracking -> Analitika.
 *
 * Two scenarios per tenant (covers the spectrum):
 *   1) a closed sale (booking for service niches, COD order for product niches)
 *   2) a no-sale with a logged REASON (no free slot / escalated complaint)
 *
 * Idempotent: deletes prior hero rows (id_razgovora like `%_hero%`) first.
 *
 * Usage:
 *   node seed_onboarding_story.mjs --email office@crowndental.rs
 *   node seed_onboarding_story.mjs --all-demos
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const SERVICE_NICHES = new Set(["dental", "medical", "beauty", "fitness", "services", "wellness", "real-estate"])
const pic = (name) => `https://i.pravatar.cc/120?u=${encodeURIComponent(name)}`

// today at a fixed hour so the appointment lands in the calendar's default week view
function apptStart(hour = 15) {
  const d = new Date(); d.setHours(hour, 0, 0, 0); return d
}

function serviceStory(nicheKey) {
  const svc = {
    dental:  { sale: "izbeljivanje zuba", price: "18.000 RSD", alt: "poliranje i uklanjanje fleka", altPrice: "7.000 RSD", altName: "Poliranje zuba", cat: "Estetska stomatologija", noSvc: "vađenje umnjaka", noCat: "Oralna hirurgija" },
    beauty:  { sale: "tretman lica", price: "4.500 RSD", alt: "dubinsko čišćenje", altPrice: "2.900 RSD", altName: "Dubinsko čišćenje", cat: "Nega lica", noSvc: "tretman za akne", noCat: "Nega lica" },
    fitness: { sale: "personalni trening", price: "2.500 RSD", alt: "grupni čas", altPrice: "900 RSD", altName: "Grupni čas", cat: "Treninzi", noSvc: "jutarnji termin", noCat: "Treninzi" },
  }[nicheKey] || { sale: "termin", price: "5.000 RSD", alt: "kraći termin", altPrice: "3.000 RSD", altName: "Kraći termin", cat: "Usluge", noSvc: "termin subotom", noCat: "Usluge" }

  const sale = {
    channel: "whatsapp", customer: "Marija Jović", phone: "064 123 4567",
    msgs: [
      ["user", `Zdravo, koliko košta ${svc.sale}?`],
      ["assistant", `Zdravo, Marija 😊 ${cap(svc.sale)} je ${svc.price}. Da Vas zakažem?`],
      ["user", "Hmm, malo mi je skupo trenutno"],
      ["assistant", `Razumem. Imamo i ${svc.alt} za ${svc.altPrice} — odličan prvi korak. Da Vam zakažem to?`],
      ["user", "To može!"],
      ["assistant", "Super. Imam slobodno danas u 15h ili 16h — šta Vam odgovara?"],
      ["user", "15h"],
      ["assistant", "Samo ime i broj telefona da potvrdim termin."],
      ["user", "Marija Jović, 064 123 4567"],
      ["assistant", "Zakazano za danas u 15h ✅ Poslaću Vam podsetnik."],
    ],
    crm: { full_name: "Marija Jović", telefon: "064 123 4567", kategorija: svc.cat, proizvod: svc.altName, status: "Zakazano", razlog: `Zakazala nakon ponuđene povoljnije alternative (${svc.alt} umesto ${svc.sale}).`, izvor: "WhatsApp" },
    appt: { service_name: svc.altName, color: "#10b981" },
  }
  const nosale = {
    channel: "instagram", customer: "Nikola Perić", phone: "063 555 1212",
    msgs: [
      ["user", `Da li radite ${svc.noSvc} subotom?`],
      ["assistant", `Zdravo, Nikola 😊 Radimo, ali subotom trenutno nemamo slobodno. Mogu u utorak ili sredu popodne?`],
      ["user", "Može samo subota, radim radnim danima"],
      ["assistant", "Razumem potpuno. Čim se oslobodi termin subotom, javiću Vam se prvi. Da Vas upišem za obaveštenje?"],
      ["user", "Ok, javite mi"],
      ["assistant", "Upisao sam Vas — javiću čim bude slobodno subotom 🙏"],
    ],
    crm: { full_name: "Nikola Perić", telefon: "063 555 1212", kategorija: svc.noCat, proizvod: svc.noSvc, status: "Zainteresovan", razlog: "Traži termin isključivo subotom — trenutno nema slobodno. Čeka obaveštenje.", izvor: "Instagram" },
    appt: null,
  }
  return { sale, nosale }
}

// Third hero (service niches): an expert-judgment question the agent must NOT
// answer — it escalates instead. This is the tour's "kada agent ne zna" beat.
function interventionStory(nicheKey) {
  const q = {
    dental:  { ask: "Zdravo, pijem antikoagulantnu terapiju (Marivarin). Da li smem da izvadim zub?", domain: "lekara", razlog: "Medicinsko pitanje (antikoagulantna terapija) — zahteva procenu lekara. Prosleđeno." },
    medical: { ask: "Zdravo, na hroničnoj sam terapiji — da li smem na zahvat koji ste mi preporučili?", domain: "lekara", razlog: "Medicinsko pitanje — zahteva procenu lekara. Prosleđeno." },
    beauty:  { ask: "Posle prošlog tretmana imala sam jaku reakciju na koži. Da li smem ponovo?", domain: "stručnjaka", razlog: "Moguća alergijska reakcija — zahteva procenu stručnjaka. Prosleđeno." },
    fitness: { ask: "Oporavljam se od povrede ramena — koje treninge smem da radim?", domain: "trenera", razlog: "Trening uz povredu — zahteva procenu trenera. Prosleđeno." },
  }[nicheKey] || { ask: "Imam specifičnu situaciju — treba mi stručna procena pre nego što zakažem.", domain: "stručnjaka", razlog: "Zahteva stručnu procenu. Prosleđeno." }
  return {
    channel: "instagram", customer: "Dragana Simić", phone: "062 334 5566",
    msgs: [
      ["user", q.ask],
      ["assistant", `Zdravo, Dragana 😊 Ovo je pitanje za našeg ${q.domain} — ne bih da nagađam. Prosleđujem Vaš upit odmah i javiće Vam se lično. Mogu li da zabeležim ime i broj telefona?`],
      ["user", "Dragana Simić, 062 334 5566"],
      ["assistant", "Zabeleženo ✅ Javiće Vam se lično u najkraćem roku. Hvala na strpljenju 🙏"],
      ["system", "[HUMAN_NEEDED]", { human_needed: true }],
    ],
    crm: { full_name: "Dragana Simić", telefon: "062 334 5566", kategorija: "Upit", proizvod: "Stručna procena", status: "Intervencija", razlog: q.razlog, izvor: "Instagram" },
    appt: null,
  }
}

function productStory(nicheKey) {
  const p = {
    ecommerce: { name: "krema sa slike", price: "2.490 RSD", alt: "vrlo sličan proizvod u istoj liniji", altPrice: "2.190 RSD", cat: "Nega" },
    fashion:   { name: "haljina sa slike", price: "5.990 RSD", alt: "ista haljina u veličini M", altPrice: "5.990 RSD", cat: "Garderoba" },
    furniture: { name: "sto sa slike", price: "24.900 RSD", alt: "isti sto u hrastu", altPrice: "22.500 RSD", cat: "Nameštaj" },
    food:      { name: "torta sa slike", price: "3.500 RSD", alt: "ista torta, manja", altPrice: "2.400 RSD", cat: "Poslastice" },
  }[nicheKey] || { name: "proizvod sa slike", price: "2.490 RSD", alt: "vrlo sličan proizvod", altPrice: "2.190 RSD", cat: "Proizvodi" }

  const sale = {
    channel: "instagram", customer: "Stefan Ilić", phone: "063 987 6543",
    msgs: [
      ["user", "Imate li ovo na stanju? [slika proizvoda]"],
      ["assistant", `Prepoznao sam sliku — ${p.name}, ${p.price}. Baš taj je rasprodat, ali imam ${p.alt} za ${p.altPrice}. Da Vam pošaljem njega?`],
      ["user", "Može, da"],
      ["assistant", "Plaćate pouzećem ili karticom?"],
      ["user", "Pouzeće"],
      ["assistant", "Treba mi ime i prezime, telefon i adresa (ulica, broj, grad)."],
      ["user", "Stefan Ilić, 063 987 6543, Kralja Petra 12, Novi Sad"],
      ["assistant", "Potvrđujem porudžbinu. Šaljem danas — broj za praćenje stiže SMS-om, stiže za dva dana 📦"],
    ],
    crm: { full_name: "Stefan Ilić", telefon: "063 987 6543", kategorija: p.cat, proizvod: p.alt, status: "Naručio", status_porudzbine: "Poslato", razlog: "Naručio nakon prepoznavanja proizvoda sa slike (ponuđena alternativa za rasprodati artikal).", izvor: "Instagram", komentar: "Adresa: Kralja Petra 12, Novi Sad · Pouzeće" },
    appt: null,
  }
  const nosale = {
    channel: "instagram", customer: "Jelena Marić", phone: "060 444 7788",
    msgs: [
      ["user", "Stigao mi je oštećen proizvod 😞"],
      ["assistant", "Mnogo mi je žao zbog toga 🙏 Odmah prosleđujem Vas našem timu da to reše i pošalju zamenu."],
      ["user", "Hvala"],
      ["assistant", "Tim Vam se javlja u najkraćem roku. Imate moju poruku zabeleženu."],
      ["system", "[HUMAN_NEEDED]", { human_needed: true }],
    ],
    crm: { full_name: "Jelena Marić", telefon: "060 444 7788", kategorija: p.cat, proizvod: "Reklamacija", status: "Intervencija", razlog: "Reklamacija — oštećen proizvod. Prosleđeno timu na rešavanje.", izvor: "Instagram" },
    appt: null,
  }
  return { sale, nosale }
}

// ── Background fill: many believable conversations + a full week of termini so
// the real dashboard (inbox / analytics / scheduler) never looks empty. ──────
const A = (name) => ({ name, profile_pic: pic(name) })

function bgServiceConvos() {
  return [
    { name: "Ana Kovačević", ch: "instagram", st: "Zainteresovan", msgs: [["user","Dobar dan, da li radite vikendom?"],["assistant","Zdravo Ana 😊 Subotom radimo 9–14h. Da Vas zakažem?"],["user","Javiću se, hvala"]] },
    { name: "Petar Nikolić", ch: "whatsapp", st: "Zakazano", msgs: [["user","Treba mi termin ove nedelje"],["assistant","Naravno! Slobodno u sredu 11h ili četvrtak 17h?"],["user","Sreda 11h"],["assistant","Zakazano za sredu u 11h ✅"]] },
    { name: "Jovana Ilić", ch: "facebook", st: "Zainteresovan", msgs: [["user","Koliko traje pregled?"],["assistant","Oko 30–45 min, Jovana. Želite li termin?"],["user","Razmisliću"]] },
    { name: "Marko Savić", ch: "website", st: "Zakazano", msgs: [["user","Mogu li danas da dođem?"],["assistant","Imam slobodno danas u 18h. Da potvrdim?"],["user","Da, može"],["assistant","Potvrđeno, vidimo se u 18h 👍"]] },
    { name: "Tamara Đorđević", ch: "instagram", st: "Zakazano", msgs: [["user","Htela bih da pomerim termin"],["assistant","Naravno. Kada Vam odgovara?"],["user","Petak popodne"],["assistant","Prebačeno na petak u 16h ✅"]] },
    { name: "Luka Pavlović", ch: "whatsapp", st: "Novi", msgs: [["user","Cenovnik?"],["assistant","Šaljem Vam ceo cenovnik na WhatsApp odmah 📋"]] },
    { name: "Milica Jovanović", ch: "instagram", st: "Zakazano", msgs: [["user","Da li ima slobodno sutra?"],["assistant","Ima! Sutra 10h ili 13h?"],["user","13h"],["assistant","Zakazano sutra u 13h ✅"]] },
    { name: "Nemanja Ristić", ch: "website", st: "Zainteresovan", msgs: [["user","Da li primate nove klijente?"],["assistant","Apsolutno, Nemanja! Recite mi šta Vam treba pa da nađemo termin."],["user","Javim se uskoro"]] },
    { name: "Sara Marković", ch: "whatsapp", st: "Završeno", msgs: [["user","Hvala na današnjem terminu!"],["assistant","Hvala Vama, Sara! Tu smo za sve 🙏"]] },
    { name: "Filip Stojanović", ch: "facebook", st: "Zakazano", msgs: [["user","Imate li termin u ponedeljak?"],["assistant","Imam u ponedeljak 9h ili 15h."],["user","9h"],["assistant","Zakazano ✅"]] },
    { name: "Katarina Lukić", ch: "instagram", st: "Zainteresovan", msgs: [["user","Da li je akcija još aktuelna?"],["assistant","Jeste do kraja meseca 😊 Da Vas upišem?"],["user","Možda sledeće nedelje"]] },
    { name: "Stefan Petrović", ch: "website", st: "Zakazano", msgs: [["user","Hoću da zakažem prvi pregled"],["assistant","Odlično! Utorak 12h ili 18h?"],["user","18h"],["assistant","Zakazano u utorak 18h ✅"]] },
  ]
}

function bgProductConvos() {
  return [
    { name: "Ivana Petrović", ch: "instagram", st: "Naručio", msgs: [["user","Da li je dostupno?"],["assistant","Jeste! Da Vam kreiram porudžbinu?"],["user","Da, pouzeće"],["assistant","Porudžbina kreirana, šalje se danas 📦"]] },
    { name: "Nikola Rašić", ch: "website", st: "Intervencija", msgs: [["user","Stigao pogrešan artikal"],["assistant","Izvinjavam se! Prosleđujem timu za zamenu odmah 🙏"]] },
    { name: "Jelena Marinović", ch: "instagram", st: "Zainteresovan", msgs: [["user","Imate li u drugoj boji?"],["assistant","Imamo u crnoj i bež. Koju želite?"],["user","Razmisliću"]] },
    { name: "Dragan Tomić", ch: "facebook", st: "Naručio", msgs: [["user","Hoću dva komada"],["assistant","Super! Beležim 2 kom. Adresa i telefon?"],["user","Dao sam u poruci"],["assistant","Porudžbina potvrđena 📦"]] },
    { name: "Vesna Đorđević", ch: "whatsapp", st: "Zainteresovan", msgs: [["user","Koliko košta dostava?"],["assistant","Dostava je besplatna preko 3.000 RSD 🚚"],["user","Ok hvala"]] },
    { name: "Miloš Jovanović", ch: "instagram", st: "Naručio", msgs: [["user","Naručujem ovo"],["assistant","Odlično! Pouzeće ili kartica?"],["user","Pouzeće"],["assistant","Porudžbina kreirana ✅"]] },
    { name: "Tijana Kostić", ch: "website", st: "Isporučeno", msgs: [["user","Stiglo, hvala!"],["assistant","Super! Hvala na poverenju 💚"]] },
    { name: "Bojan Lukić", ch: "facebook", st: "Zainteresovan", msgs: [["user","Imate li veći paket?"],["assistant","Imamo i duplo pakovanje sa popustom 😊"],["user","Javim se"]] },
    { name: "Marija Stanković", ch: "whatsapp", st: "Naručio", msgs: [["user","Može jedno pakovanje"],["assistant","Beležim! Adresa za dostavu?"],["user","Poslala sam"],["assistant","Šalje se danas 📦"]] },
    { name: "Aleksandar Mitić", ch: "instagram", st: "Novi", msgs: [["user","Da li radi pouzeće?"],["assistant","Da, plaćate kuriru pri preuzimanju 👍"]] },
    { name: "Sofija Ilić", ch: "website", st: "Naručio", msgs: [["user","Naručila bih dva"],["assistant","Super! Kreiram porudžbinu za 2 kom 📦"],["user","Hvala"]] },
    { name: "Vuk Pavlović", ch: "facebook", st: "Zainteresovan", msgs: [["user","Ima li garancija?"],["assistant","Da, 12 meseci garancije na sve 😊"],["user","Ok"]] },
  ]
}

// spread appointments across the current week, varied hours, skipping today@15 (hero slot)
function weekAppts(crmFullName) {
  const svcPool = [
    { s: "Konsultacije", c: "#10b981" }, { s: "Kontrola", c: "#0ea5e9" },
    { s: "Tretman", c: "#8b5cf6" }, { s: "Prvi pregled", c: "#f59e0b" },
  ]
  const names = ["Petar Nikolić","Marko Savić","Tamara Đorđević","Milica Jovanović","Filip Stojanović","Stefan Petrović","Ana Kovačević","Jovana Ilić","Nemanja Ristić","Sara Marković","Luka Pavlović","Katarina Lukić"]
  const phones = ["063 221 4567","065 884 1290","060 552 7781","064 119 3320","062 770 5512","061 443 8890","063 905 2218","065 117 6643","060 338 9921","064 552 1147","062 661 2204","060 774 9183"]
  // anchor FORWARD from today so the calendar stays populated for ~10 days regardless
  // of when the demo is viewed. [dayOffset, hour] — skip today@15 (Marija's hero slot).
  const today = new Date(); today.setHours(0,0,0,0)
  const slots = [
    [0,9],[0,11],[0,17],[1,10],[1,14],[2,9],[2,13],[2,16],[3,11],[3,15],[4,10],[4,14],[5,12],[6,10],[7,13],[8,11],
  ]
  return slots.map(([d,h], i) => {
    const start = new Date(today); start.setDate(today.getDate() + d); start.setHours(h,0,0,0)
    const svc = svcPool[i % svcPool.length]
    return { customer_name: names[i % names.length], customer_phone: phones[i % phones.length], service_name: svc.s, service_color: svc.c, starts_at: start.toISOString(), ends_at: new Date(start.getTime()+45*60000).toISOString(), status: "confirmed", urgency: i % 5 === 0 ? "high" : "normal", source: ["WhatsApp","Instagram","Website","Facebook"][i%4], notes: "Zakazano preko AI agenta" }
  })
}

// short, varied conversations spread over the last 28 days — pure volume so the
// analytics period charts and totals read like an active, successful account.
const FN = ["Ana","Marko","Jovana","Petar","Milica","Nikola","Tamara","Luka","Sara","Filip","Katarina","Stefan","Ivana","Vuk","Sofija","Bojan","Milan","Jelena","Dragan","Vesna","Miloš","Tijana","Aleksandar","Nina","Nemanja","Teodora","Đorđe","Lana","Uroš","Maja"]
const LN = ["Petrović","Jovanović","Nikolić","Ilić","Marković","Savić","Kovačević","Đorđević","Stojanović","Lukić","Ristić","Pavlović","Mitić","Kostić","Janković"]
const CH4 = ["instagram","whatsapp","facebook","website"]
function fillerConvos(isService, n, cid8) {
  const qa = isService
    ? [["Da li je slobodno ovih dana?","Imamo termina ove nedelje 😊 Da Vas upišem?"],["Koliko košta?","Šaljem Vam ceo cenovnik odmah 📋"],["Radite vikendom?","Subotom radimo 9–14h. Da zakažem?"],["Koliko traje pregled?","Oko 30–45 min. Želite termin?"],["Mogu li sutra?","Imam sutra 11h ili 16h — šta Vam odgovara?"],["Da li primate nove?","Naravno! Recite šta Vam treba pa da nađemo termin."]]
    : [["Na stanju?","Jeste! Da Vam kreiram porudžbinu?"],["Koliko košta dostava?","Besplatna preko 3.000 RSD 🚚"],["Imate li u drugoj boji?","Imamo u više boja 😊 Koju želite?"],["Radi li pouzeće?","Da, plaćate kuriru pri preuzimanju 👍"],["Naručujem ovo","Super! Pouzeće ili kartica?"],["Garancija?","12 meseci garancije na sve 😊"]]
  const out = []
  for (let i = 0; i < n; i++) {
    const name = `${FN[i % FN.length]} ${LN[(i * 7) % LN.length]}`
    const [q, a] = qa[i % qa.length]
    const minAgo = 1600 + Math.floor((i * (28 * 24 * 60)) / n) // ~28 days span, oldest first
    out.push({ key: `demo_${cid8}_fill${i}`, name, ch: CH4[(i * 3) % 4], minAgo, msgs: [["user", q], ["assistant", a]] })
  }
  return out
}

async function seedTenant(client) {
  const cid = client.id
  const niche = (client.demo_niche || "generic").toLowerCase()
  const isService = SERVICE_NICHES.has(niche)
  const { sale, nosale } = isService ? serviceStory(niche) : productStory(niche)
  const cid8 = cid.slice(0, 8)

  // wipe prior hero + background rows
  await sb.from("razgovori").delete().eq("client_id", cid).like("id_razgovora", `%_hero%`)
  await sb.from("razgovori").delete().eq("client_id", cid).like("id_razgovora", `%_bg%`)
  await sb.from("razgovori").delete().eq("client_id", cid).like("id_razgovora", `%_fill%`)
  await sb.from("demo_crm").delete().eq("client_id", cid).like("id_razgovora", `%_hero%`)
  await sb.from("demo_crm").delete().eq("client_id", cid).like("id_razgovora", `%_bg%`)
  // Own the whole demo calendar: clear ALL appointments (incl. build_demo_tenant's
  // stale May-dated set) so there's one clean, forward-dated schedule.
  await sb.from("appointments").delete().eq("client_id", cid)

  const now = Date.now()
  const scenarios = [
    { key: `demo_${cid8}_hero1`, s: sale, baseOffsetMin: 12 },   // most recent -> top of inbox
    // service niches get a dedicated intervention hero (tour beat 2);
    // product niches already use their nosale (complaint) for that beat
    ...(isService ? [{ key: `demo_${cid8}_hero3`, s: interventionStory(niche), baseOffsetMin: 45 }] : []),
    { key: `demo_${cid8}_hero2`, s: nosale, baseOffsetMin: 90 },
  ]

  const razgovori = []
  const crmRows = []
  const appts = []

  for (const { key, s, baseOffsetMin } of scenarios) {
    s.msgs.forEach(([role, text, extraMeta], i) => {
      const ts = new Date(now - (baseOffsetMin * 60000) + i * 40000).toISOString() // 40s apart
      razgovori.push({ id_razgovora: key, role, message: text, platform: s.channel, client_id: cid, created_at: ts, metadata: { name: s.customer, profile_pic: pic(s.customer), ...(extraMeta || {}) } })
    })
    crmRows.push({ ...s.crm, id_razgovora: key, client_id: cid, created_at: new Date(now - baseOffsetMin * 60000).toISOString() })
    if (s.appt) {
      const start = apptStart(15)
      appts.push({ client_id: cid, customer_name: s.crm.full_name, customer_phone: s.crm.telefon, service_name: s.appt.service_name, service_color: s.appt.color, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 45 * 60000).toISOString(), status: "confirmed", urgency: "normal", source: s.channel === "whatsapp" ? "WhatsApp" : "Instagram", notes: "Zakazano preko AI agenta" })
    }
  }

  // ── background fill: authored convos (recent, populate the inbox) ─────────
  const bg = isService ? bgServiceConvos() : bgProductConvos()
  bg.forEach((c, idx) => {
    const key = `demo_${cid8}_bg${idx}`
    const baseOffsetMin = 180 + idx * 95 // last ~20h, under the hero rows
    c.msgs.forEach(([role, text], i) => {
      const ts = new Date(now - baseOffsetMin * 60000 + i * 40000).toISOString()
      razgovori.push({ id_razgovora: key, role, message: text, platform: c.ch, client_id: cid, created_at: ts, metadata: { name: c.name, profile_pic: pic(c.name) } })
    })
  })
  // ── filler convos spread across the last 28 days → analytics feels established
  const FILL_N = 34
  for (const f of fillerConvos(isService, FILL_N, cid8)) {
    f.msgs.forEach(([role, text], i) => {
      const ts = new Date(now - f.minAgo * 60000 + i * 40000).toISOString()
      razgovori.push({ id_razgovora: f.key, role, message: text, platform: f.ch, client_id: cid, created_at: ts, metadata: { name: f.name, profile_pic: pic(f.name) } })
    })
  }
  if (isService) {
    for (const a of weekAppts()) appts.push({ client_id: cid, ...a })
  }

  const r1 = await sb.from("razgovori").insert(razgovori)
  const r2 = await sb.from("demo_crm").insert(crmRows)
  const r3 = appts.length ? await sb.from("appointments").insert(appts) : { error: null }
  const errs = [r1.error, r2.error, r3.error].filter(Boolean).map((e) => e.message)
  console.log(`  ${client.name} (${niche}, ${isService ? "service" : "product"}): ${razgovori.length} msgs, ${crmRows.length} CRM, ${appts.length} appt ${errs.length ? "ERR: " + errs.join("; ") : "✓"}`)
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

async function main() {
  const args = process.argv.slice(2)
  let clients = []
  if (args.includes("--all-demos")) {
    const { data } = await sb.from("clients").select("id,name,demo_niche").not("demo_niche", "is", null)
    clients = data || []
  } else {
    const ei = args.indexOf("--email"); const email = ei !== -1 ? args[ei + 1] : "office@crowndental.rs"
    const { data } = await sb.from("clients").select("id,name,demo_niche").eq("email", email).single()
    clients = data ? [data] : []
  }
  console.log(`Seeding onboarding story for ${clients.length} tenant(s):`)
  for (const c of clients) await seedTenant(c)
  console.log("Done.")
}
main()
