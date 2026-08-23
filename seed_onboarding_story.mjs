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

const rsd = (n) => `${Math.round(n).toLocaleString("de-DE")} RSD`

/** Pull a real "expensive ask" + "cheaper alternative" pair out of the tenant's
 *  scraped catalog, so the demo conversation quotes their own prices back at them
 *  instead of numbers we invented. Falls back to the generic pair when the catalog
 *  is thin. */
function catalogPair(catalog) {
  const priced = (catalog || []).filter((c) => c.name && c.price_min > 0)
  if (priced.length < 2) return null
  const sorted = [...priced].sort((a, b) => a.price_min - b.price_min)
  const cheap = sorted[0]
  const dear = sorted[sorted.length - 1]
  if (cheap.id === dear.id) return null
  return {
    sale: dear.name.toLowerCase(), price: rsd(dear.price_min),
    alt: cheap.name.toLowerCase(), altPrice: rsd(cheap.price_min),
    altName: cheap.name, altId: cheap.id, altColor: cheap.color_hex || "#10b981",
    altDuration: cheap.duration_minutes || 45,
    cat: cheap.category || "Usluge",
  }
}

function serviceStory(nicheKey, catalog) {
  const real = catalogPair(catalog)
  const svc = real ? { ...defaultSvc(nicheKey), ...real } : defaultSvc(nicheKey)
  return buildServiceStory(svc)
}

function defaultSvc(nicheKey) {
  return {
    dental:  { sale: "izbeljivanje zuba", price: "18.000 RSD", alt: "poliranje i uklanjanje fleka", altPrice: "7.000 RSD", altName: "Poliranje zuba", cat: "Estetska stomatologija", noSvc: "vađenje umnjaka", noCat: "Oralna hirurgija" },
    beauty:  { sale: "tretman lica", price: "4.500 RSD", alt: "dubinsko čišćenje", altPrice: "2.900 RSD", altName: "Dubinsko čišćenje", cat: "Nega lica", noSvc: "tretman za akne", noCat: "Nega lica" },
    fitness: { sale: "personalni trening", price: "2.500 RSD", alt: "grupni čas", altPrice: "900 RSD", altName: "Grupni čas", cat: "Treninzi", noSvc: "jutarnji termin", noCat: "Treninzi" },
  }[nicheKey] || { sale: "termin", price: "5.000 RSD", alt: "kraći termin", altPrice: "3.000 RSD", altName: "Kraći termin", cat: "Usluge", noSvc: "termin subotom", noCat: "Usluge" }
}

function buildServiceStory(svc) {
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
    appt: { service_name: svc.altName, color: svc.altColor || "#10b981", service_id: svc.altId ?? null, duration: svc.altDuration ?? 45 },
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

// ── Schedule ────────────────────────────────────────────────────────────────
// A demo calendar has to look like a real, busy business: weeks of finished
// appointments BEHIND today and bookings ahead of it. Anchored on the seed day;
// the dashboard slides the whole set forward at read time (lib/demo/time-shift).
const SERVICE_POOL = {
  dental: [
    { s: "Kontrola", c: "#0ea5e9", w: 5 },
    { s: "Čišćenje kamenca", c: "#10b981", w: 4 },
    { s: "Popravka zuba", c: "#8b5cf6", w: 4 },
    { s: "Prvi pregled", c: "#f59e0b", w: 3 },
    { s: "Izbeljivanje zuba", c: "#ec4899", w: 2 },
    { s: "Konsultacije — implant", c: "#06b6d4", w: 2 },
  ],
  medical: [
    { s: "Kontrola", c: "#0ea5e9", w: 5 }, { s: "Prvi pregled", c: "#f59e0b", w: 4 },
    { s: "Ultrazvuk", c: "#8b5cf6", w: 3 }, { s: "Konsultacije", c: "#10b981", w: 3 },
    { s: "Laboratorija", c: "#06b6d4", w: 2 },
  ],
  beauty: [
    { s: "Tretman lica", c: "#ec4899", w: 5 }, { s: "Dubinsko čišćenje", c: "#10b981", w: 4 },
    { s: "Manikir", c: "#f59e0b", w: 4 }, { s: "Depilacija", c: "#8b5cf6", w: 3 },
    { s: "Konsultacije", c: "#0ea5e9", w: 2 },
  ],
  fitness: [
    { s: "Personalni trening", c: "#10b981", w: 5 }, { s: "Grupni čas", c: "#0ea5e9", w: 5 },
    { s: "Merenje sastava tela", c: "#f59e0b", w: 2 }, { s: "Konsultacije", c: "#8b5cf6", w: 2 },
  ],
  generic: [
    { s: "Konsultacije", c: "#10b981", w: 5 }, { s: "Kontrola", c: "#0ea5e9", w: 4 },
    { s: "Tretman", c: "#8b5cf6", w: 3 }, { s: "Prvi pregled", c: "#f59e0b", w: 3 },
  ],
}

// Peak hours are the point of the "špic sati" chart — a real practice fills up
// mid-morning and after work, not uniformly across the day.
const HOUR_WEIGHTS = [[9,3],[10,6],[11,6],[12,3],[13,2],[14,3],[15,4],[16,5],[17,6],[18,5],[19,2]]

const CLIENT_NAMES = [
  "Ana Kovačević","Petar Nikolić","Jovana Ilić","Marko Savić","Tamara Đorđević","Luka Pavlović",
  "Milica Jovanović","Nemanja Ristić","Sara Marković","Filip Stojanović","Katarina Lukić","Stefan Petrović",
  "Ivana Nikolić","Vuk Janković","Sofija Mitić","Bojan Kostić","Milan Ilić","Jelena Savić",
  "Dragan Tomić","Vesna Đorđević","Miloš Jovanović","Tijana Rašić","Aleksandar Mitić","Nina Vuković",
  "Teodora Popović","Đorđe Lazić","Lana Simić","Uroš Blagojević","Maja Radovanović","Igor Stanković",
]
const phoneFor = (i) => `06${(i % 5) + 1} ${100 + (i * 37) % 900} ${1000 + (i * 131) % 9000}`

// deterministic pseudo-random so reseeds are stable
const rnd = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x) }
const pickWeighted = (pool, r) => {
  const total = pool.reduce((t, p) => t + (p.w ?? p[1]), 0)
  let acc = r * total
  for (const p of pool) { acc -= (p.w ?? p[1]); if (acc <= 0) return p }
  return pool[pool.length - 1]
}

function scheduleAppts(nicheKey, catalog) {
  // Prefer the tenant's own scraped services over our invented ones — a schedule
  // full of THEIR procedures at THEIR prices is the whole point of the demo.
  const real = (catalog || []).filter((c) => c.name)
  // Weight inversely by price: a clinic books far more whitenings and check-ups
  // than implant surgeries, and a week of nothing but the flagship reads as fake.
  const byPrice = [...real].sort((a, b) => (a.price_min || 0) - (b.price_min || 0))
  const pool = real.length >= 3
    ? byPrice.map((c, i) => ({ s: c.name, c: c.color_hex || "#10b981", id: c.id, dur: c.duration_minutes || 45, w: Math.max(1, byPrice.length - i) }))
    : (SERVICE_POOL[nicheKey] || SERVICE_POOL.generic)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const out = []
  let n = 0
  for (let d = -21; d <= 10; d++) {
    const day = new Date(today); day.setDate(today.getDate() + d)
    const dow = day.getDay()
    if (dow === 0) continue                       // closed Sunday
    const perDay = dow === 6 ? 3 : 5 + Math.floor(rnd(d * 3 + 1) * 2)  // 5–6 weekdays, 3 Saturday
    const used = new Set()
    for (let k = 0; k < perDay; k++) {
      n++
      const hour = pickWeighted(HOUR_WEIGHTS, rnd(n * 7 + d))[0]
      if (used.has(hour)) continue                 // no double-booking the same hour
      if (d === 0 && hour === 15) continue         // today 15:00 belongs to the hero booking
      used.add(hour)
      const svc = pickWeighted(pool, rnd(n * 11 + 3))
      const start = new Date(day); start.setHours(hour, 0, 0, 0)
      const past = d < 0
      // ~6% of finished appointments fall through — a 0% cancel rate reads as fake
      const roll = rnd(n * 17 + 5)
      const status = past ? (roll < 0.04 ? "cancelled" : roll < 0.06 ? "no_show" : "completed") : "confirmed"
      out.push({
        customer_name: CLIENT_NAMES[n % CLIENT_NAMES.length],
        customer_phone: phoneFor(n),
        service_id: svc.id ?? null, service_name: svc.s, service_color: svc.c,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + Math.min(svc.dur ?? 45, 90) * 60000).toISOString(),
        status, urgency: "normal",
        source: ["Instagram", "WhatsApp", "Website", "Facebook"][n % 4],
        notes: "Zakazano preko AI agenta",
      })
    }
  }
  return out
}

// ── Conversation volume ─────────────────────────────────────────────────────
// The analytics module reads meaning straight out of these messages (top questions,
// top objections, channel mix), so the filler is written to carry that signal —
// not just to make a number go up.
const FN = ["Ana","Marko","Jovana","Petar","Milica","Nikola","Tamara","Luka","Sara","Filip","Katarina","Stefan","Ivana","Vuk","Sofija","Bojan","Milan","Jelena","Dragan","Vesna","Miloš","Tijana","Aleksandar","Nina","Nemanja","Teodora","Đorđe","Lana","Uroš","Maja"]
const LN = ["Petrović","Jovanović","Nikolić","Ilić","Marković","Savić","Kovačević","Đorđević","Stojanović","Lukić","Ristić","Pavlović","Mitić","Kostić","Janković"]

// Instagram carries most of it — that is the pitch. [channel, weight]
const CHANNEL_MIX = [["instagram", 55], ["whatsapp", 20], ["facebook", 13], ["website", 12]]

const SERVICE_QA = [
  ["Da li imate slobodnih termina ove nedelje?", "Imamo 😊 Sreda 11h ili četvrtak 17h — šta Vam odgovara?"],
  ["Koliko košta pregled?", "Šaljem Vam ceo cenovnik odmah 📋 Da Vam odmah rezervišem termin?"],
  ["Radite li subotom?", "Subotom radimo 9–14h. Da Vas upišem?"],
  ["Koliko traje pregled?", "Oko 30–45 min. Želite li termin ove nedelje?"],
  ["Ima li slobodno sutra?", "Ima — sutra 10h ili 16h. Koje Vam odgovara?"],
  ["Koliko košta čišćenje?", "Cena je u cenovniku koji Vam šaljem 📋 Trajanje je oko 40 min."],
  ["Da li dajete garanciju?", "Da, dajemo garanciju — objasniću Vam detalje na terminu 🙏"],
  ["Koje je radno vreme danas?", "Danas radimo do 20h. Imam slobodno u 17h ako Vam odgovara?"],
  ["Da li primate nove pacijente?", "Naravno! Recite mi šta Vam treba pa da nađemo termin."],
  ["Mogu li da zakažem za sledeću nedelju?", "Možete — ponedeljak 12h ili utorak 18h?"],
  ["Koliko košta prvi pregled?", "Prvi pregled Vam šaljem u cenovniku 📋 Da rezervišem termin?"],
  ["Ima li mesta danas popodne?", "Ima u 17h i 18h. Koje Vam odgovara?"],
  ["Da li mogu da pomerim termin?", "Naravno. Kada bi Vam odgovaralo?"],
  ["Da li radite vikendom?", "Subotom 9–14h, nedeljom ne radimo 😊"],
]
const SERVICE_OBJECTIONS = [
  "Malo mi je skupo iskreno",
  "Razmisliću pa se javim",
  "Mogu samo subotom, radim radnim danima",
  "Javiću se sledeće nedelje",
  "Preskupo mi je trenutno",
  "Možda kasnije, hvala",
]
const PRODUCT_QA = [
  ["Da li je na stanju?", "Jeste! Da Vam kreiram porudžbinu?"],
  ["Koliko košta dostava?", "Besplatna preko 3.000 RSD 🚚 Stiže za dva dana."],
  ["Imate li u drugoj boji?", "Imamo u više boja 😊 Koju želite?"],
  ["Radi li pouzeće?", "Da, plaćate kuriru pri preuzimanju 👍"],
  ["Koliko košta ovo?", "Šaljem Vam cenu i sve varijante odmah 📋"],
  ["Imate li veći model?", "Imamo — šaljem Vam veličine koje su na stanju."],
  ["Da li ima garancija?", "12 meseci garancije na sve 😊"],
  ["Kada stiže porudžbina?", "Kurir isporučuje za dva radna dana 📦"],
  ["Ima li ovo u veličini M?", "Ima na stanju! Da Vam rezervišem?"],
  ["Može li zamena ako ne odgovara?", "Naravno, zamena je moguća u roku od 14 dana 🙏"],
  ["Da li šaljete u inostranstvo?", "Šaljemo — javite mi grad pa računam dostavu."],
  ["Koliko košta uz dostavu?", "Šaljem Vam ukupan iznos sa dostavom odmah 📋"],
  ["Imate li ovaj model na stanju?", "Taj je rasprodat, ali imam vrlo sličan — da pošaljem?"],
  ["Da li mogu dva komada?", "Možete! Beležim 2 kom — adresa i telefon?"],
]
const PRODUCT_OBJECTIONS = [
  "Skupo mi je za sada",
  "Razmisliću pa se javim",
  "Nema na stanju baš taj, šteta",
  "Možda sledeći mesec",
  "Mnogo je to para",
  "Javiću se kasnije",
]

// status mix ≈ 55% of everyone who writes ends up booked/served — a strong but
// believable best case for warm inbound DMs.
const OUTCOME_MIX_SERVICE = [
  ["Zakazano", 31], ["Završeno", 24], ["Zainteresovan", 30], ["Novi", 11], ["Intervencija", 4],
]
const OUTCOME_MIX_PRODUCT = [
  ["Naručio", 32], ["Isporučeno", 23], ["Zainteresovan", 29], ["Novi", 12], ["Intervencija", 4],
]

function fillerConvos(isService, n, cid8, nicheKey, catalog) {
  const qa = isService ? SERVICE_QA : PRODUCT_QA
  const objections = isService ? SERVICE_OBJECTIONS : PRODUCT_OBJECTIONS
  const outcomes = isService ? OUTCOME_MIX_SERVICE : OUTCOME_MIX_PRODUCT
  const real = (catalog || []).filter((c) => c.name)
  const pool = real.length >= 3
    ? real.map((c) => ({ s: c.name, w: 3 }))
    : (SERVICE_POOL[nicheKey] || SERVICE_POOL.generic)
  const out = []
  for (let i = 0; i < n; i++) {
    const name = `${FN[i % FN.length]} ${LN[(i * 7) % LN.length]}`
    const [q, a] = qa[i % qa.length]
    const msgs = [["user", q], ["assistant", a]]
    // every third thread carries an objection the agent answers — that is what
    // fills the "najčešće primedbe" card with something worth reading
    if (i % 3 === 1) {
      msgs.push(["user", objections[i % objections.length]])
      msgs.push(["assistant", isService
        ? "Razumem potpuno 🙏 Ostavljam Vam termin otvoren — javite se kad Vam odgovara."
        : "Razumem 🙏 Zabeležio sam Vas — javim čim bude akcija ili novo stanje."])
    }
    const status = pickWeighted(outcomes, rnd(i * 5 + 2))[0]
    // spread across the last 28 days, denser toward now (a growing account)
    const dayBack = Math.floor(28 * Math.pow(i / n, 0.85))
    const hour = pickWeighted(HOUR_WEIGHTS, rnd(i * 3 + 9))[0]
    const minAgo = dayBack * 24 * 60 + (24 - hour) * 60 + (i * 7) % 60
    out.push({
      key: `demo_${cid8}_fill${i}`, name, ch: pickWeighted(CHANNEL_MIX, rnd(i * 13 + 4))[0],
      minAgo, msgs, status,
      proizvod: pickWeighted(pool, rnd(i * 19 + 6)).s,
      telefon: phoneFor(i),
    })
  }
  return out
}
async function seedTenant(client) {
  const cid = client.id
  const niche = (client.demo_niche || "generic").toLowerCase()
  const isService = SERVICE_NICHES.has(niche)
  const { data: catalog } = await sb
    .from("services_catalog").select("id,name,category,price_min,color_hex,duration_minutes")
    .eq("client_id", cid).eq("is_active", true).order("sort_order")
  const { sale, nosale } = isService ? serviceStory(niche, catalog) : productStory(niche)
  const cid8 = cid.slice(0, 8)

  // wipe prior hero + background rows
  await sb.from("razgovori").delete().eq("client_id", cid).like("id_razgovora", `%_hero%`)
  await sb.from("razgovori").delete().eq("client_id", cid).like("id_razgovora", `%_bg%`)
  await sb.from("razgovori").delete().eq("client_id", cid).like("id_razgovora", `%_fill%`)
  await sb.from("demo_crm").delete().eq("client_id", cid).like("id_razgovora", `%_hero%`)
  await sb.from("demo_crm").delete().eq("client_id", cid).like("id_razgovora", `%_bg%`)
  await sb.from("demo_crm").delete().eq("client_id", cid).like("id_razgovora", `%_fill%`)
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
      appts.push({ client_id: cid, customer_name: s.crm.full_name, customer_phone: s.crm.telefon, service_id: s.appt.service_id ?? null, service_name: s.appt.service_name, service_color: s.appt.color, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + (s.appt.duration ?? 45) * 60000).toISOString(), status: "confirmed", urgency: "normal", source: s.channel === "whatsapp" ? "WhatsApp" : "Instagram", notes: "Zakazano preko AI agenta" })
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
    crmRows.push({
      id_razgovora: key, client_id: cid, full_name: c.name, telefon: phoneFor(idx + 41),
      kategorija: isService ? "Usluge" : "Proizvodi", status: c.st,
      izvor: c.ch === "whatsapp" ? "WhatsApp" : c.ch === "facebook" ? "Facebook" : c.ch === "website" ? "Website" : "Instagram",
      created_at: new Date(now - baseOffsetMin * 60000).toISOString(),
    })
  })

  // ── filler convos across the last 28 days ────────────────────────────────
  // Each one also becomes a CRM row, because the whole claim is "nijedan upit ne
  // propada" — a full inbox next to a near-empty CRM would say the opposite.
  const FILL_N = 170
  for (const f of fillerConvos(isService, FILL_N, cid8, niche, catalog)) {
    f.msgs.forEach(([role, text], i) => {
      const ts = new Date(now - f.minAgo * 60000 + i * 40000).toISOString()
      razgovori.push({ id_razgovora: f.key, role, message: text, platform: f.ch, client_id: cid, created_at: ts, metadata: { name: f.name, profile_pic: pic(f.name) } })
    })
    crmRows.push({
      id_razgovora: f.key, client_id: cid, full_name: f.name, telefon: f.telefon,
      kategorija: isService ? "Usluge" : "Proizvodi", proizvod: f.proizvod, status: f.status,
      izvor: f.ch === "whatsapp" ? "WhatsApp" : f.ch === "facebook" ? "Facebook" : f.ch === "website" ? "Website" : "Instagram",
      created_at: new Date(now - f.minAgo * 60000).toISOString(),
    })
  }

  if (isService) {
    for (const a of scheduleAppts(niche, catalog)) appts.push({ client_id: cid, ...a })
  }

  const r1 = await sb.from("razgovori").insert(razgovori)
  const r2 = await sb.from("demo_crm").insert(crmRows)
  const r3 = appts.length ? await sb.from("appointments").insert(appts) : { error: null }
  const errs = [r1.error, r2.error, r3.error].filter(Boolean).map((e) => e.message)
  const mix = crmRows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {})
  const conv = crmRows.length ? Math.round((crmRows.filter(r => ["Zakazano","Završeno","Naručio","Isporučeno"].includes(r.status)).length / crmRows.length) * 100) : 0
  console.log(`  ${client.name} (${niche}, ${isService ? "service" : "product"}): ${razgovori.length} msgs, ${crmRows.length} CRM (${conv}% konv.), ${appts.length} appt ${errs.length ? "ERR: " + errs.join("; ") : "✓"}`)
  console.log(`    status mix:`, mix)
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
