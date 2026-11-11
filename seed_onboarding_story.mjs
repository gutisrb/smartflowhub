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
import { buildSaleMessages, buildHesitationMessages, normalizeOfferTerms, cleanServiceName } from "./lib/sales-playbook.mjs"
import { salesModelOf, normalizeSalesModel } from "./lib/sales-model.mjs"
import { stayStory, stayHesitation, stayQA, bgStayConvos } from "./lib/stay-story.mjs"
import { pickOpening, pickObjection, pickFollowUp, openingFromOverride } from "./lib/customer-voice.mjs"
import { storeStory, orderStory, productQAFor, trackingQA, stageFor, bgStoreConvos, bgShopConvos, DELIVERY_STAGES, guaranteeLine } from "./lib/shop-story.mjs"

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
/**
 * Hero item, and a credible alternative to it.
 *
 * Taking the shop's cheapest row produced downsells no salesperson would ever make:
 * full-arch implants to teeth whitening, a woman's leather coat to a child's jacket,
 * a modular living room to a coffee table, snowboard gear to cycling shorts. The
 * alternative has to stay in the same category and be a step down, not a different
 * purchase — around half the hero's price is what a real upsell ladder looks like.
 */
function pickPair(priced) {
  if (!priced || priced.length < 2) return null
  const sorted = [...priced].sort((a, b) => b.price_min - a.price_min)
  const dear = sorted[0]
  const sameCat = sorted.slice(1).filter((c) => c.category && c.category === dear.category)
  const pool = sameCat.length ? sameCat : sorted.slice(1)
  const target = dear.price_min * 0.55
  const alt = [...pool].sort((a, b) => Math.abs(a.price_min - target) - Math.abs(b.price_min - target))[0]
  if (!alt || alt.id === dear.id) return null
  return { dear, alt }
}

function catalogPair(catalog) {
  const priced = (catalog || []).filter((c) => c.name && c.price_min > 0)
  if (!priced.length) return null
  // Service demos no longer downsell (see lib/sales-playbook.mjs) — only the headline item is used.
  const dear = [...priced].sort((a, b) => b.price_min - a.price_min)[0]
  return {
    sale: cleanServiceName(dear.name), price: rsd(dear.price_min), priceRsd: dear.price_min,
    altName: cleanServiceName(dear.name), altId: dear.id, altColor: dear.color_hex || "#10b981",
    altDuration: dear.duration_minutes || 45,
    cat: dear.category || "Usluge",
  }
}

function serviceStory(nicheKey, catalog, terms, model, strategy, voice = {}) {
  // the item the business's own customers asked about wins over the most expensive one
  const asked = voice.opening?.item?.price_min > 0 ? voice.opening.item : null
  const real = asked ? {
    sale: cleanServiceName(asked.name), price: rsd(asked.price_min), priceRsd: asked.price_min,
    altName: cleanServiceName(asked.name), altId: asked.id, altColor: asked.color_hex || "#10b981",
    altDuration: asked.duration_minutes || 45, cat: asked.category || "Usluge",
  } : catalogPair(catalog)
  const named = (catalog || []).find((c) => c.name)
  const svc = real ? { ...defaultSvc(nicheKey), ...real }
    : named ? { ...defaultSvc(nicheKey), sale: cleanServiceName(named.name), altName: cleanServiceName(named.name), cat: named.category || 'Usluge' }
    : defaultSvc(nicheKey)
  return buildServiceStory(svc, terms, { model, strategy, niche: nicheKey, ...voice })
}

// No price here is ever shown: these are labels for a business whose catalogue states none.
// (They used to carry made-up prices — "termin 5.000 RSD" — which a hotel demo then quoted.)
function defaultSvc(nicheKey) {
  return {
    dental:  { sale: "izbeljivanje zuba", price: null, priceRsd: 0, altName: "Izbeljivanje zuba", cat: "Estetska stomatologija", noSvc: "vađenje umnjaka", noCat: "Oralna hirurgija" },
    beauty:  { sale: "tretman lica", price: null, priceRsd: 0, altName: "Tretman lica", cat: "Nega lica", noSvc: "tretman za akne", noCat: "Nega lica" },
    fitness: { sale: "personalni trening", price: null, priceRsd: 0, altName: "Personalni trening", cat: "Treninzi", noSvc: "jutarnji termin", noCat: "Treninzi" },
  }[nicheKey] || { sale: "termin", price: null, priceRsd: 0, altName: "Termin", cat: "Usluge", noSvc: "termin subotom", noCat: "Usluge" }
}

function buildServiceStory(svc, terms, { model = "booking", strategy = null, niche = null, opening = null, objection = null, followUp = null, calendar = true } = {}) {
  // Conversation text lives in lib/sales-playbook.mjs so every tenant gets the same rules:
  // price + what it includes, no downsell, terms only from the site, the business's own next step.
  const saleConv = buildSaleMessages({ svc, terms, model, strategy, niche, opening: opening?.source === "fallback" ? null : opening, objection, followUp, calendar })
  const left = buildHesitationMessages({ svc, terms, model, strategy, niche, calendar })
  const quote = model === "quote"
  const sale = {
    channel: "whatsapp", customer: "Marija Jović", phone: "064 123 4567",
    msgs: saleConv.msgs,
    crm: { full_name: "Marija Jović", telefon: "064 123 4567", kategorija: svc.cat, proizvod: svc.altName || saleConv.stepName, status: saleConv.status,
      // written by the same branch that wrote the conversation, so the CRM never says "Rekla da je
      // skupo" about a chat in which nobody said it
      razlog: saleConv.razlog,
      izvor: "WhatsApp" },
    // High-ticket: the booking is the business's first step, not the catalogue treatment itself.
    // a consultation is ~30 min; inheriting the treatment's 240 min drew a 4-hour block over the afternoon
    appt: quote || !saleConv.books ? null : { service_name: saleConv.stepName, color: svc.altColor || "#10b981", service_id: saleConv.highTicket ? null : (svc.altId ?? null), duration: saleConv.highTicket ? 30 : Math.min(svc.altDuration ?? 45, 90) },
  }
  const nosale = {
    channel: "instagram", customer: "Nikola Perić", phone: "063 555 1212",
    msgs: left.msgs,
    crm: { full_name: "Nikola Perić", telefon: "063 555 1212", kategorija: svc.cat, proizvod: svc.altName, status: "Zainteresovan", razlog: left.razlog, izvor: "Instagram" },
    appt: null,
  }
  return { sale, nosale }
}

// Third hero (service niches): an expert-judgment question the agent must NOT
// answer — it escalates instead. This is the tour's "kada agent ne zna" beat.
// A business's own expert question (sheet.hero.intervention) wins over the niche's: Tandem's is
// about a jumper in a wheelchair, which its site says it does — not a fitness injury.
function interventionStory(nicheKey, own = null) {
  if (own?.ask) return {
    channel: "instagram", customer: "Dragana Simić", phone: "062 334 5566",
    msgs: [
      ["user", own.ask],
      ["assistant", own.answer],
      ["user", "Dragana Simić, 062 334 5566"],
      ["assistant", "Hvala, Dragana. Upit je prosleđen."],
      ["system", "[HUMAN_NEEDED]", { human_needed: true }],
    ],
    crm: { full_name: "Dragana Simić", telefon: "062 334 5566", kategorija: "Upit", proizvod: "Stručna procena", status: "Intervencija", razlog: own.razlog, izvor: "Instagram" },
    appt: null,
  }
  const q = {
    dental:  { ask: "Zdravo, pijem antikoagulantnu terapiju (Marivarin). Da li smem da izvadim zub?", domain: "lekara", domainNom: "lekar", razlog: "Medicinsko pitanje (antikoagulantna terapija) — zahteva procenu lekara. Prosleđeno." },
    medical: { ask: "Zdravo, na hroničnoj sam terapiji. Da li smem na zahvat koji ste mi preporučili?", domain: "lekara", domainNom: "lekar", razlog: "Medicinsko pitanje — zahteva procenu lekara. Prosleđeno." },
    beauty:  { ask: "Posle prošlog tretmana imala sam jaku reakciju na koži. Da li smem ponovo?", domain: "stručnjaka", domainNom: "stručnjak", razlog: "Moguća alergijska reakcija — zahteva procenu stručnjaka. Prosleđeno." },
    fitness: { ask: "Oporavljam se od povrede ramena. Koje treninge smem da radim?", domain: "trenera", domainNom: "trener", razlog: "Trening uz povredu — zahteva procenu trenera. Prosleđeno." },
    quote:   { ask: "Zdravo, imam specifičan prostor i zahteve. Da li je to uopšte izvodljivo kod Vas?", domain: "stručnjaka", domainNom: "stručnjak", razlog: "Tehničko pitanje o izvodljivosti — zahteva procenu stručnjaka. Prosleđeno." },
  }[nicheKey] || { ask: "Imam specifičnu situaciju i treba mi stručna procena pre nego što zakažem.", domain: "stručnjaka", domainNom: "stručnjak", razlog: "Zahteva stručnu procenu. Prosleđeno." }
  return {
    channel: "instagram", customer: "Dragana Simić", phone: "062 334 5566",
    msgs: [
      ["user", q.ask],
      ["assistant", `Zdravo, Dragana. Na ovo pitanje mora da odgovori naš ${q.domainNom}, pa ne bih da nagađam. Odmah prosleđujem Vaš upit. Mogu li da zabeležim Vaše ime i broj telefona?`],
      ["user", "Dragana Simić, 062 334 5566"],
      ["assistant", "Hvala, Dragana. Pitanje je prosleđeno."],
      ["system", "[HUMAN_NEEDED]", { human_needed: true }],
    ],
    crm: { full_name: "Dragana Simić", telefon: "062 334 5566", kategorija: "Upit", proizvod: "Stručna procena", status: "Intervencija", razlog: q.razlog, izvor: "Instagram" },
    appt: null,
  }
}


/**
 * How an order actually completes for this shop.
 *
 * Cash-on-delivery courier shipping was hardcoded for every product tenant. It is right for
 * perfume and jackets, and wrong for a 45.000 RSD bicycle or a modular living room — no one
 * puts those on a courier COD, and a prospect who sells them reads the demo as generic.
 */
const BULKY = /bicikl|skij|snowboard|trenažer|nameštaj|garnitur|krevet|ležaj|regal|komod|vitrin|polic|sofa|fotelj|orman|plakar|pergol|krov|prozor|\bsto\b/i
function fulfilmentFor(nicheKey, item) {
  // Bulk decides this, not price. A 37.200 RSD perfume ships by courier like any parcel;
  // a 45.000 RSD bicycle does not. Keying on price alone put Belodore on in-store pickup.
  const bulky = BULKY.test(`${item?.name || ""} ${item?.category || ""}`)
  if (nicheKey === "furniture" || (bulky && nicheKey === "furniture")) return "delivery"
  if (bulky) return "pickup"
  return "courier"
}

// 2026-11-10: "Pouzećem ili karticom?", "broj za praćenje pošiljke SMS-om", "rezervišem subotu pre podne" and "čeka Vas do sutra
// uveče" were stamped on every shop (Luxor, Demart, Dallas). The agent now takes the order details and records the order;
// payment, tracking and delivery dates are the business's own and appear only where its Business Sheet states them.
const FULFILMENT_BEATS = {
  courier: [
    ["assistant", "Pošaljite mi ime i prezime, broj telefona i adresu (ulica, broj, grad)."],
    ["user", "Stefan Ilić, 063 987 6543, Kralja Petra 12, Novi Sad"],
    ["assistant", "Hvala, porudžbina je upisana."],
  ],
  pickup: [
    ["assistant", "Mogu da Vam ga rezervišem u radnji, da ga vidite i probate pre kupovine. Pošaljite mi ime i broj telefona."],
    ["user", "Stefan Ilić, 063 987 6543"],
    ["assistant", "Rezervisano je na Vaše ime. Javite kada krenete, da bude spremno."],
  ],
  delivery: [
    ["assistant", "Pošaljite mi ime, broj telefona i adresu za dostavu."],
    ["user", "Stefan Ilić, 063 987 6543, Kralja Petra 12, Novi Sad"],
    ["assistant", "Hvala, porudžbina je upisana."],
  ],
}

const FULFILMENT_CRM = {
  courier: { status_porudzbine: "Poslato", komentar: "Adresa: Kralja Petra 12, Novi Sad" },
  pickup:  { status_porudzbine: "Rezervisano", komentar: "Rezervacija u radnji" },
  delivery:{ status_porudzbine: "Zakazana dostava", komentar: "Adresa: Kralja Petra 12, Novi Sad" },
}

function productStory(nicheKey, catalog, fulfilment = null) {
  // Prefer a real, photographed product from their shop: the whole point of this
  // beat is that the agent recognises what a customer sends a picture of, and a
  // placeholder string cannot demonstrate that.
  // Requiring image_url here was a silent trap: a shop with an accurate catalogue but no
  // scraped photos fell straight through to the invented defaults below, which is how a
  // bike shop's demo ended up selling face cream. Their real products always win; the photo
  // is a bonus that upgrades the beat from "asks by name" to "recognises a picture".
  const priced = (catalog || []).filter((c) => c.name && c.price_min > 0)
    .sort((a, b) => b.price_min - a.price_min)
  const photographed = priced.filter((c) => c.image_url)
  const pool = photographed.length >= 2 ? photographed : priced
  const pair = pickPair(pool)
  if (pair) {
    const { dear, alt } = pair
    return buildProductStory({
      name: dear.name.toLowerCase(), price: rsd(dear.price_min),
      alt: alt.name.toLowerCase(), altPrice: rsd(alt.price_min),
      cat: alt.category || "Proizvodi", image: dear.image_url || null,
      fulfilment: fulfilment || fulfilmentFor(nicheKey, dear),
    })
  }
  const p = {
    ecommerce: { name: "krema sa slike", price: "2.490 RSD", alt: "vrlo sličan proizvod u istoj liniji", altPrice: "2.190 RSD", cat: "Nega" },
    fashion:   { name: "haljina sa slike", price: "5.990 RSD", alt: "ista haljina u veličini M", altPrice: "5.990 RSD", cat: "Garderoba" },
    furniture: { name: "sto sa slike", price: "24.900 RSD", alt: "isti sto u hrastu", altPrice: "22.500 RSD", cat: "Nameštaj" },
    food:      { name: "torta sa slike", price: "3.500 RSD", alt: "ista torta, manja", altPrice: "2.400 RSD", cat: "Poslastice" },
  }[nicheKey] || { name: "proizvod sa slike", price: "2.490 RSD", alt: "vrlo sličan proizvod", altPrice: "2.190 RSD", cat: "Proizvodi" }
  return buildProductStory({ ...p, fulfilment: fulfilment || fulfilmentFor(nicheKey, { name: p.name, category: p.cat }) })
}

/** The complaint hero for a store people come into: no shipping, a bought item with a problem. */
/**
 * A complaint hero from the business's OWN policy (sheets/<email>.json → hero.complaint = { ask, answer, razlog }): Luxor's site says
 * to report within 48 h with the fiscal receipt and a photo of the damage, so the agent asks for exactly that.
 */
function ownComplaint(own, category) {
  return {
    channel: "instagram", customer: "Jelena Marić", phone: "060 444 7788",
    msgs: [
      ["user", own.ask],
      ["assistant", own.answer],
      ["user", "Jelena Marić, 060 444 7788"],
      ["assistant", "Hvala, Jelena. Slučaj je upisan i prosleđen."],
      ["system", "[HUMAN_NEEDED]", { human_needed: true }],
    ],
    crm: { full_name: "Jelena Marić", telefon: "060 444 7788", kategorija: category || "Proizvodi", proizvod: "Reklamacija", status: "Intervencija", razlog: own.razlog, izvor: "Instagram" },
    appt: null,
  }
}

function storeComplaint(item) {
  // 2026-11-10 (four shops fact-checked): the old one was the same line on every demo ("Hvala." from the customer after a
  // non-answer, two near-identical hand-off lines, emoji, "javiti oko rešenja"). The agent takes the details, says it
  // cannot decide a complaint, records it, and promises nothing about who answers when.
  return {
    channel: "instagram", customer: "Jelena Marić", phone: "060 444 7788",
    msgs: [
      ["user", "Kupila sam kod Vas pre dve nedelje i proizvod je stigao oštećen."],
      ["assistant", "Žao mi je zbog toga. Reklamaciju mora da pogleda neko iz firme, a ja ću da upišem slučaj. Pošaljite mi ime i broj telefona."],
      ["user", "Jelena Marić, 060 444 7788"],
      ["assistant", "Hvala, Jelena. Slučaj je upisan i prosleđen."],
      ["system", "[HUMAN_NEEDED]", { human_needed: true }],
    ],
    crm: { full_name: "Jelena Marić", telefon: "060 444 7788", kategorija: item?.category || "Proizvodi", proizvod: "Reklamacija", status: "Intervencija", razlog: "Reklamacija na kupljen proizvod. Prosleđeno na rešavanje.", izvor: "Instagram" },
    appt: null,
  }
}

function buildProductStory(p) {
  const sale = {
    channel: "instagram", customer: "Stefan Ilić", phone: "063 987 6543",
    // Without a real photo the agent must not claim to have recognised one — the tour
    // narrates this beat as image recognition, and a "[slika proizvoda]" placeholder with
    // no image showing makes the whole demo look broken.
    msgs: [
      p.image
        ? ["user", "Imate li ovo na stanju?", { image_url: p.image, type: "image" }]
        : ["user", `Imate li ${p.name} na stanju?`],
      ["assistant", p.image
        ? `Prepoznao sam sliku: to je ${p.name}, cena je ${p.price}. Trenutno nije na stanju, ali imam ${p.alt} za ${p.altPrice}. Da Vam pripremim tu opciju?`
        : `Cena je ${p.price}. Trenutno nije na stanju, ali imam ${p.alt} za ${p.altPrice}. Da Vam pripremim tu opciju?`],
      ["user", "Može, hvala."],
      ...(FULFILMENT_BEATS[p.fulfilment] || FULFILMENT_BEATS.courier),
    ],
    crm: { full_name: "Stefan Ilić", telefon: "063 987 6543", kategorija: p.cat, proizvod: p.alt, status: "Naručio",
      ...(FULFILMENT_CRM[p.fulfilment] || FULFILMENT_CRM.courier),
      razlog: p.image
        ? "Naručio nakon prepoznavanja proizvoda sa slike (ponuđena alternativa za rasprodati artikal)."
        : "Naručio nakon ponuđene alternative za rasprodati artikal.",
      izvor: "Instagram" },
    appt: null,
  }
  const nosale = storeComplaint({ category: p.cat })
  return { sale, nosale }
}

// ── Background fill: many believable conversations + a full week of termini so
// the real dashboard (inbox / analytics / scheduler) never looks empty. ──────
const A = (name) => ({ name, profile_pic: pic(name) })

// Background threads in every demo inbox. Rules (2026-10-24): correct Serbian, formal Vi,
// nothing the business's own site does not state (no invented hours, promotions, delivery
// terms or guarantees — those come from offer_terms or the agent defers to the team), and
// every hesitation gets one real attempt instead of "javite se kad Vam odgovara".
const PATIENT_NICHES = new Set(["dental", "medical"])
function termsAnswer(t, field, fallback) {
  const v = t?.[field]
  return v ? `${cap(String(v)).replace(/[.]$/, "")}.` : fallback
}
const ASK_TEAM = "To potvrđuje naš tim. Prosleđujem pitanje, pa ćete dobiti tačan odgovor."

function bgServiceConvos(t, niche) {
  const people = PATIENT_NICHES.has(niche) ? "pacijente" : "klijente"
  return [
    { name: "Ana Kovačević", ch: "instagram", st: "Zainteresovan", msgs: [["user","Dobar dan, da li radite vikendom?"],["assistant","Zdravo, Ana 😊 Proveravam raspored za subotu. U koje vreme biste želeli da dođete?"],["user","Javiću se, hvala."],["assistant","Važi. Ako Vam je lakše, mogu odmah da Vam sačuvam termin za subotu, pa ga potvrdite kada budete sigurni."]] },
    { name: "Petar Nikolić", ch: "whatsapp", st: "Zakazano", msgs: [["user","Treba mi termin ove nedelje."],["assistant","Naravno. Imam slobodno u sredu u 11h ili u četvrtak u 17h. Šta Vam odgovara?"],["user","Sreda u 11h."],["assistant","Zakazano za sredu u 11h ✅"]] },
    { name: "Jovana Ilić", ch: "facebook", st: "Zainteresovan", msgs: [["user","Koliko se čeka na termin?"],["assistant","Prvi slobodan termin je sutra u 10h. Da Vam ga rezervišem?"],["user","Razmisliću."],["assistant","Naravno. Ako se odlučite do večeras, termin u 10h je još slobodan."]] },
    { name: "Marko Savić", ch: "website", st: "Zakazano", msgs: [["user","Mogu li danas da dođem?"],["assistant","Imam slobodan termin danas u 18h. Da ga potvrdim?"],["user","Da, može."],["assistant","Potvrđeno, vidimo se u 18h 👍"]] },
    { name: "Tamara Đorđević", ch: "instagram", st: "Zakazano", msgs: [["user","Htela bih da pomerim termin."],["assistant","Naravno. Kada Vam odgovara?"],["user","U petak popodne."],["assistant","Termin je pomeren na petak u 16h ✅"]] },
    { name: "Luka Pavlović", ch: "whatsapp", st: "Novi", msgs: [["user","Može cenovnik?"],["assistant","Može. Koja usluga Vas zanima? Odmah Vam šaljem cenu i šta je u nju uključeno."]] },
    { name: "Milica Jovanović", ch: "instagram", st: "Zakazano", msgs: [["user","Da li ima slobodnih termina sutra?"],["assistant","Ima. Sutra u 10h ili u 13h?"],["user","U 13h."],["assistant","Zakazano za sutra u 13h ✅"]] },
    { name: "Nemanja Ristić", ch: "website", st: "Zainteresovan", msgs: [["user",`Da li primate nove ${people}?`],["assistant","Naravno, Nemanja. Recite mi šta Vam je potrebno, pa da nađemo termin."],["user","Javiću se uskoro."],["assistant","Važi. Ako želite, odmah Vam predložim dva termina za sledeću nedelju."]] },
    { name: "Sara Marković", ch: "whatsapp", st: "Završeno", msgs: [["user","Hvala na današnjem terminu!"],["assistant","Hvala Vama, Sara! Tu smo za sve 🙏"]] },
    { name: "Filip Stojanović", ch: "facebook", st: "Zakazano", msgs: [["user","Imate li termin u ponedeljak?"],["assistant","Imam, u ponedeljak u 9h ili u 15h."],["user","U 9h."],["assistant","Zakazano za ponedeljak u 9h ✅"]] },
    { name: "Katarina Lukić", ch: "instagram", st: "Zainteresovan", msgs: [["user","Da li može plaćanje na rate?"],["assistant", t?.financing ? termsAnswer(t, "financing") : termsAnswer(t, "payment_methods", ASK_TEAM)],["user","U redu, hvala."]] },
    { name: "Stefan Petrović", ch: "website", st: "Zakazano", msgs: [["user","Hoću da zakažem prvi pregled."],["assistant","Može. U utorak u 12h ili u 18h?"],["user","U 18h."],["assistant","Zakazano za utorak u 18h ✅"]] },
  ]
}

function bgProductConvos(t) {
  return [
    { name: "Ivana Petrović", ch: "instagram", st: "Naručio", msgs: [["user","Da li je ovo dostupno?"],["assistant","Jeste, na stanju je. Da Vam pripremim porudžbinu?"],["user","Da, molim."],["assistant","Porudžbina je zabeležena ✅ Javljamo Vam se sa potvrdom slanja."]] },
    { name: "Nikola Rašić", ch: "website", st: "Intervencija", msgs: [["user","Stigao mi je pogrešan artikal."],["assistant","Izvinjavam se zbog toga. Odmah prosleđujem Vaš slučaj timu, koji će Vam se javiti oko zamene 🙏"]] },
    { name: "Jelena Marinović", ch: "instagram", st: "Zainteresovan", msgs: [["user","Da li imate ovo u drugoj boji?"],["assistant","Proveravam koje boje su na stanju. Koja boja Vas zanima?"],["user","Razmisliću."],["assistant","Važi. Kada se odlučite, javite mi boju i odmah proveravam stanje."]] },
    { name: "Dragan Tomić", ch: "facebook", st: "Naručio", msgs: [["user","Hoću dva komada."],["assistant","Važi, dva komada. Pošaljite mi adresu i broj telefona."],["user","Poslao sam ih u poruci."],["assistant","Porudžbina je potvrđena 📦"]] },
    { name: "Vesna Đorđević", ch: "whatsapp", st: "Zainteresovan", msgs: [["user","Koliko košta dostava?"],["assistant", termsAnswer(t, "delivery", "Cenu dostave potvrđujemo prema Vašoj adresi. Iz kog ste grada?")],["user","U redu, hvala."]] },
    { name: "Miloš Jovanović", ch: "instagram", st: "Naručio", msgs: [["user","Naručujem ovo."],["assistant","Super. Kako želite da platite?"],["user","Pouzećem."],["assistant","Porudžbina je kreirana ✅"]] },
    { name: "Tijana Kostić", ch: "website", st: "Isporučeno", msgs: [["user","Stiglo je, hvala!"],["assistant","Drago nam je! Hvala na poverenju 💚"]] },
    { name: "Bojan Lukić", ch: "facebook", st: "Zainteresovan", msgs: [["user","Imate li veće pakovanje?"],["assistant","Proveravam šta imamo na stanju i odmah Vam šaljem opcije."],["user","Javiću se."],["assistant","Važi. Ako hoćete, pošaljem Vam sve veličine koje su trenutno na stanju."]] },
    { name: "Marija Stanković", ch: "whatsapp", st: "Naručio", msgs: [["user","Može jedno pakovanje."],["assistant","Beležim. Na koju adresu šaljemo?"],["user","Poslala sam adresu."],["assistant","Hvala, porudžbina je zabeležena 📦"]] },
    { name: "Aleksandar Mitić", ch: "instagram", st: "Novi", msgs: [["user","Kako može da se plati?"],["assistant", termsAnswer(t, "payment_methods", ASK_TEAM)]] },
    { name: "Sofija Ilić", ch: "website", st: "Naručio", msgs: [["user","Naručila bih dva komada."],["assistant","Važi, spremam porudžbinu za dva komada 📦"],["user","Hvala."]] },
    { name: "Vuk Pavlović", ch: "facebook", st: "Zainteresovan", msgs: [["user","Da li postoji garancija?"],["assistant", t?.guarantee ? `Postoji. Garancija: ${String(t.guarantee).replace(/[.]$/, "")}.` : ASK_TEAM],["user","U redu."]] },
  ]
}

// lib/demo/time-shift.ts: the hero booking moves to today, the rest of the calendar by whole weeks
const DEMO_HERO_APPT = "demo:hero"

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

// `days`: the weekdays the business works, when its site says so (sheet.booking.days; Tandem: [6, 0])
function scheduleAppts(nicheKey, catalog, days = null) {
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
    if (days ? !days.includes(dow) : dow === 0) continue   // closed Sunday, unless the site says otherwise
    // a business open two days a week packs them: Tandem jumps all of Saturday and Sunday
    const perDay = days?.length <= 3 ? 7 + Math.floor(rnd(d * 3 + 1) * 3) : dow === 6 ? 3 : 5 + Math.floor(rnd(d * 3 + 1) * 2)
    const used = new Set()
    for (let k = 0; k < perDay; k++) {
      n++
      const hour = pickWeighted(HOUR_WEIGHTS, rnd(n * 7 + d))[0]
      if (used.has(hour)) continue                 // no double-booking the same hour
      // 15:00 belongs to the hero booking ("danas u 15h"); the calendar moves by whole weeks
      // (lib/demo/time-shift), so any seeded day can become "today"
      if (hour === 15) continue
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

// Filler threads (the bulk of the inbox). Same rules as the background threads above.
function serviceQA(t) {
  return [
    ["Da li imate slobodnih termina ove nedelje?", "Imamo 😊 U sredu u 11h ili u četvrtak u 17h. Šta Vam više odgovara?"],
    ["Ima li slobodno sutra?", "Ima, sutra u 10h ili u 16h. Koje Vam vreme odgovara?"],
    ["Da li dajete garanciju?", t?.guarantee ? `Da. Garancija: ${String(t.guarantee).replace(/[.]$/, "")}.` : ASK_TEAM],
    ["Mogu li da zakažem za sledeću nedelju?", "Možete. U ponedeljak u 12h ili u utorak u 18h?"],
    ["Ima li mesta danas popodne?", "Ima, u 17h i u 18h. Koje Vam vreme odgovara?"],
    ["Da li mogu da pomerim termin?", "Naravno. Kada bi Vam odgovaralo?"],
    ["Da li može plaćanje na rate?", t?.financing ? termsAnswer(t, "financing") : t?.payment_schedule ? `Plaćanje ide u fazama: ${String(t.payment_schedule).replace(/[.]$/, "")}.` : ASK_TEAM],
    ["Šta je uključeno u cenu?", t?.included?.length ? `U cenu je uključeno: ${t.included.slice(0, 4).map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(", ")}.` : "Recite mi koja Vas usluga zanima, pa Vam odmah šaljem šta tačno obuhvata."],
    ["Kako izgleda prvi dolazak?", t?.free_consultation ? `Prvi korak je ${String(t.free_consultation.label).toLowerCase()}. Da Vas upišem?` : "Recite mi šta Vam je potrebno, pa Vam predložim termin."],
    ["Da li primate preko vikenda?", "Proveravam raspored za subotu. U koje vreme biste želeli da dođete?"],
  ]
}
// [what they say, what kind of hesitation it is]
const STAY_OBJECTIONS = [
  ["Razmisliću, pa ću se javiti.", "later"],
  ["Javiću se kada dogovorimo datume.", "later"],
  ["Možda sledećeg meseca.", "later"],
]
const SERVICE_OBJECTIONS = [
  ["Malo mi je skupo, iskreno.", "price"],
  ["Razmisliću, pa ću se javiti.", "later"],
  ["Mogu samo subotom, radnim danima radim.", "time"],
  ["Javiću se sledeće nedelje.", "later"],
  ["Trenutno mi je preskupo.", "price"],
  ["Možda kasnije, hvala.", "later"],
]
/** Questions a buyer of something made to order really sends. Answers come from the business's own terms and catalogue. */
function quoteQA(t, catalog) {
  const included = t?.included?.length ? ` U cenu je uključeno: ${t.included.slice(0, 4).map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(", ")}.` : ""
  const priced = (catalog || []).filter((c) => c.name && c.price_min > 0).slice(0, 5)
  const ask = priced.map((c) => [`Koliko košta ${cleanServiceName(c.name).toLowerCase()}?`, `Cena je ${rsd(c.price_min)}.${included}`])
  return [
    ...ask,
    ["Da li je u cenu uključen prevoz?", t?.delivery ? `Da, ${String(t.delivery).replace(/[.]$/, "")}.` : ASK_TEAM],
    ["Šta je sve uključeno u cenu?", included ? included.trim() : "Recite mi šta Vam je potrebno, pa Vam šaljem šta tačno obuhvata."],
    ["Da li dajete garanciju?", t?.guarantee ? `Da. Garancija: ${String(t.guarantee).replace(/[.]$/, "")}.` : ASK_TEAM],
    ["Kako može da se plati?", termsAnswer(t, "payment_methods", ASK_TEAM)],
    ["Može li ponuda po meri?", "Može. Pošaljite mi ime, broj telefona i šta Vam je potrebno, pa pripremamo ponudu."],
  ]
}
const QUOTE_OBJECTIONS = [
  ["Za sada mi je skupo.", "price"],
  ["Razmisliću, pa ću se javiti.", "later"],
  ["To je veliki iznos za mene.", "price"],
  ["Moram prvo da se dogovorim kod kuće.", "later"],
  ["Javiću se kasnije.", "later"],
  ["Možda sledećeg meseca.", "later"],
]
function bgQuoteConvos(t) {
  const included = t?.included?.length ? `U cenu je uključeno: ${t.included.slice(0, 4).map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(", ")}.` : "Recite mi koji proizvod Vas zanima, pa Vam šaljem šta tačno obuhvata."
  return [
    { name: "Ana Kovačević", ch: "instagram", st: "Zainteresovan", msgs: [["user","Dobar dan, da li dostavljate i van grada?"],["assistant", termsAnswer(t, "delivery", ASK_TEAM)],["user","Javiću se, hvala."],["assistant","Važi. Kada budete spremni, pošaljite mesto isporuke i pripremamo ponudu."]] },
    { name: "Petar Nikolić", ch: "whatsapp", st: "Zakazano", msgs: [["user","Treba mi ponuda."],["assistant","Naravno. Pošaljite mi ime, broj telefona i šta Vam je potrebno."],["user","Petar Nikolić, 064 220 1188. Treba nam veća količina."],["assistant","Hvala, Petre. Zahtev za ponudu je upisan i prosleđen."]] },
    { name: "Jovana Ilić", ch: "facebook", st: "Zainteresovan", msgs: [["user","Koliko se čeka od porudžbine do isporuke?"],["assistant", termsAnswer(t, "delivery", ASK_TEAM)],["user","Razmisliću."],["assistant","Naravno. Ako želite, pripremimo ponudu da imate sve na jednom mestu kad odlučite."]] },
    { name: "Marko Savić", ch: "website", st: "Zakazano", msgs: [["user","Zanima me ponuda, može li po našim merama?"],["assistant","Može da se pripremi ponuda. Pošaljite mi ime, broj telefona i mere."],["user","Marko Savić, 065 828 6764, mere šaljem mejlom."],["assistant","Hvala. Zahtev za ponudu sa merama je upisan i prosleđen."]] },
    { name: "Tamara Đorđević", ch: "instagram", st: "Naručio", msgs: [["user","Dogovorili smo se prošle nedelje, potvrđujem porudžbinu."],["assistant","Hvala, Tamara. Porudžbina je zabeležena, tim Vam se javlja oko daljih koraka."]] },
    { name: "Luka Pavlović", ch: "whatsapp", st: "Novi", msgs: [["user","Može cenovnik?"],["assistant","Može. Koji proizvod Vas zanima? Odmah Vam šaljem cenu i šta je u nju uključeno."]] },
    { name: "Milica Jovanović", ch: "instagram", st: "Zakazano", msgs: [["user","Treba nam ponuda do kraja nedelje."],["assistant","Pošaljite mi ime, broj telefona i šta Vam je potrebno, pa prosleđujem timu."],["user","Milica Jovanović, 063 410 7721."],["assistant","Hvala, Milice. Zahtev za ponudu je upisan i prosleđen."]] },
    { name: "Nemanja Ristić", ch: "website", st: "Zainteresovan", msgs: [["user","Šta je sve uključeno u cenu?"],["assistant", included],["user","Javiću se uskoro."],["assistant","Važi. Ako želite, odmah pripremamo ponudu sa svim stavkama."]] },
    { name: "Sara Marković", ch: "whatsapp", st: "Naručio", msgs: [["user","Hvala na ponudi, prihvatamo."],["assistant","Hvala, Sara. Tim Vam se javlja oko potvrde i daljih koraka."]] },
    { name: "Filip Stojanović", ch: "facebook", st: "Zakazano", msgs: [["user","Treba nam ponuda za više komada."],["assistant","Naravno. Pošaljite mi ime, broj telefona i koliko komada Vam treba."],["user","Filip Stojanović, 061 770 5540, tri komada."],["assistant","Hvala, Filipe. Zahtev za ponudu za tri komada je upisan i prosleđen."]] },
    { name: "Katarina Lukić", ch: "instagram", st: "Zainteresovan", msgs: [["user","Kako može da se plati?"],["assistant", termsAnswer(t, "payment_methods", ASK_TEAM)],["user","U redu, hvala."]] },
    { name: "Stefan Petrović", ch: "website", st: "Zakazano", msgs: [["user","Zanima me ponuda, može li?"],["assistant","Može. Pošaljite mi ime, broj telefona i mesto isporuke."],["user","Stefan Petrović, 062 114 9033, Beograd."],["assistant","Hvala, Stefane. Zahtev za ponudu za Beograd je upisan i prosleđen."]] },
  ]
}

const PRODUCT_OBJECTIONS = [
  ["Za sada mi je skupo.", "price"],
  ["Razmisliću, pa ću se javiti.", "later"],
  ["Baš tog nema na stanju, šteta.", "stock"],
  ["Možda sledećeg meseca.", "later"],
  ["To je mnogo para.", "price"],
  ["Javiću se kasnije.", "later"],
]
/**
 * The one real attempt the playbook requires after a hesitation. For a price objection it is the
 * reply worked out for THIS business (lib/objection-engine.mjs); otherwise only facts from the
 * owner's own terms. Never a stock lever, never a discount.
 */
function attemptFor(kind, t, model, strategy, stays = false, i = 0) {
  const worked = (id) => strategy?.worries?.find((w) => w.id === id)?.agent_reply
  const stop = (x) => (/[.!?…]$/.test(x) ? x : `${x}.`)
  // 2026-11-10: no opening acknowledgement at all ("Jasno.", "Razumem Vas." agree with the objection); the answer opens the reply
  if (kind === "price") {
    if (worked("price")) return `${stop(worked("price"))}`
    if (t?.financing) return `${termsAnswer(t, "financing")}`
    if (model !== "order" && t?.payment_schedule) return `Ne plaća se sve odjednom: ${String(t.payment_schedule).replace(/[.]$/, "")}.`
    if (t?.guarantee) return `${guaranteeLine(t.guarantee)}`
    if (model === "quote") return `Ako hoćete, pripremimo Vam ponudu za Vašu lokaciju, pa imate sve crno na belo.`
    return model === "booking" ? `Ako hoćete, pošaljem Vam šta tačno ulazi u cenu.` : `Ako hoćete, pošaljem Vam još par modela, da imate poređenje.`
  }
  if (kind === "time") return "Važi. Ako Vam zatreba termin, samo pišite ovde."
  if (kind === "stock") return "Važi. Ako Vam zatreba, samo pišite ovde."
  if (worked("later")) return stop(worked("later"))
  if (stays) return "Važi. Kada odaberete datume, pišite mi i proveravam šta je slobodno."
  if (model === "quote") return "Važi. Ako hoćete, pripremimo ponudu da je imate pri ruci kad odlučujete."
  return model === "booking" ? "Važi. Ako Vam zatreba termin, samo pišite ovde." : "Važi. Kad se odlučite, javite mi i proveravam da li je na stanju."
}

// Status follows the thread's age, the way a real pipeline looks. Every filler thread ends
// on the agent, so the inbox reads an open lead (Novi/Zainteresovan) by its silence
// (lib/lead-status.ts): under 24h it is still a conversation, 1–7 days "Bez odgovora",
// older "Izgubljen". A flat random mix put a quarter of all leads in Izgubljen (57 of 203),
// which reads as an agent that loses customers. Tiers: today, this week, older.
// "won" = booked/ordered, "done" = the visit happened / the order arrived.
const OUTCOME_BY_AGE = [
  [["Novi", 35], ["Zainteresovan", 35], ["won", 25], ["Intervencija", 5]],
  [["won", 56], ["done", 16], ["Zainteresovan", 19], ["Novi", 3], ["Intervencija", 6]],
  [["done", 66], ["won", 24], ["Zainteresovan", 7], ["Novi", 3]],
]
// A made-to-order enquiry converts more slowly than a booking: most outcomes are an offer
// requested ("Ponuda"), fewer an order placed.
const OUTCOME_BY_AGE_QUOTE = [
  [["Novi", 35], ["Zainteresovan", 35], ["won", 25], ["Intervencija", 5]],
  [["won", 58], ["done", 10], ["Zainteresovan", 24], ["Novi", 4], ["Intervencija", 4]],
  [["won", 54], ["done", 26], ["Zainteresovan", 16], ["Novi", 4]],
]
const WON_STATUS = { service: { won: "Zakazano", done: "Završeno" }, product: { won: "Naručio", done: "Isporučeno" }, quote: { won: "Zakazano", done: "Naručio" } }

function fillerConvos(model, n, cid8, nicheKey, catalog, terms, strategy, { sheet = null, fulfilment = null } = {}) {
  // shops ask what THEIR customers ask (lib/shop-story.mjs): no "veličina M" for a sofa, no
  // delivery question for a store nobody ships from
  // a business with its own question set (sheets/<email>.json → hero.qa / hero.objections) is
  // asked what its customers ask: Tandem gets "Koliko kila je maksimum?", not "Ima li mesta danas popodne?"
  const own = sheet?.hero || {}
  const qa = own.qa?.length ? own.qa : model === "quote" ? quoteQA(terms, catalog) : sheet?.flows?.stays ? stayQA({ sheet, terms }) : model === "booking" ? serviceQA(terms)
    : productQAFor({ terms, niche: nicheKey, catalog, sheet, fulfilment })
  const track = model === "order" ? trackingQA({ fulfilment, couriers: sheet?.shipping?.couriers || [] }) : null
  const objections = model === "quote" ? QUOTE_OBJECTIONS : sheet?.flows?.stays ? STAY_OBJECTIONS : model === "booking" ? SERVICE_OBJECTIONS : PRODUCT_OBJECTIONS
  const wonAs = model === "quote" ? WON_STATUS.quote : model === "booking" ? WON_STATUS.service : WON_STATUS.product
  const real = (catalog || []).filter((c) => c.name)
  const pool = real.length >= 3
    ? real.map((c) => ({ s: cleanServiceName(c.name), cat: c.category || null, w: 3 }))
    : (SERVICE_POOL[nicheKey] || SERVICE_POOL.generic)
  const out = []
  for (let i = 0; i < n; i++) {
    const name = `${FN[i % FN.length]} ${LN[(i * 7) % LN.length]}`
    // every eighth order thread is a customer asking where the order is, answered from its stage
    const tracking = track && i % 8 === 3
    const [q, a] = tracking ? track : qa[i % qa.length]
    const msgs = [["user", q], ["assistant", a]]
    // every third thread carries an objection the agent answers — that is what
    // fills the "najčešće primedbe" card with something worth reading
    if (i % 3 === 1) {
      if (own.objections?.length) {
        // the business's own hesitations, each with the answer its site gives
        const [said, reply] = own.objections[i % own.objections.length]
        msgs.push(["user", said], ["assistant", reply])
      } else {
        const [said, kind] = objections[i % objections.length]
        msgs.push(["user", said])
        msgs.push(["assistant", attemptFor(kind, terms, model, strategy, !!sheet?.flows?.stays, i)])
      }
    }
    // spread across the last 28 days, denser toward now (a growing account)
    const dayBack = Math.floor(26 * Math.pow(i / n, 1.25))
    const hour = pickWeighted(HOUR_WEIGHTS, rnd(i * 3 + 9))[0]
    const minAgo = 30 * 60 + dayBack * 24 * 60 + (24 - hour) * 60 + (i * 7) % 60 // nothing newer than 30h
    const tier = minAgo < 22 * 60 ? 0 : minAgo < 7 * 24 * 60 ? 1 : 2
    const picked = pickWeighted((model === "quote" ? OUTCOME_BY_AGE_QUOTE : OUTCOME_BY_AGE)[tier], rnd(i * 5 + 2))[0]
    let status = tracking ? "Naručio" : (wonAs[picked] ?? picked)
    const stage = tracking ? track[2] : model === "order" ? stageFor(status, minAgo, fulfilment) : null
    // an order whose delivery is done is a delivered order, not an open one
    if (stage && stage === DELIVERY_STAGES[fulfilment]?.[2]) status = "Isporučeno"
    out.push({
      key: `demo_${cid8}_fill${i}`, name, ch: pickWeighted(CHANNEL_MIX, rnd(i * 13 + 4))[0],
      minAgo, msgs, status, status_porudzbine: stage,
      ...(() => { const it = pickWeighted(pool, rnd(i * 19 + 6)); return { proizvod: it.s, kategorija: it.cat || null } })(),
      telefon: phoneFor(i),
    })
  }
  return out
}
// ── builder threads (retired 2026-10-27) ─────────────────────────────────────
// build_demo_tenant used to write ~18 model-written conversations per demo (`…_conv_N`). Read as
// the owner, they said what the business never says: "svaki paket uključuje 4K video" to Tandem
// (two of its packages have none), "ne nudimo plaćanje na rate" to JetSet, a blue armchair out of
// stock at Radovanović, and "razumemo da je to velika odluka" everywhere. Nothing in them was
// checked against the site, so they are removed and the verified filler threads take their place.
// (A copy of every removed thread is kept outside the repo, in the session's scratchpad.)
async function retireBuilderThreads(cid) {
  await sb.from("razgovori").delete().eq("client_id", cid).like("id_razgovora", "%_conv_%")
  await sb.from("demo_crm").delete().eq("client_id", cid).like("id_razgovora", "%_conv_%")
  await sb.from("demo_crm").delete().eq("client_id", cid).is("id_razgovora", null)
}

async function seedTenant(client) {
  const cid = client.id
  const niche = (client.demo_niche || "generic").toLowerCase()
  // How this business sells decides the whole story (lib/sales-model.mjs). A lead analysed by
  // analyze_leads.mjs carries it; otherwise it follows from the niche. `isService` = the people-
  // facing heroes (Marija, Dragana, Nikola), which both booking and quote businesses use.
  const model = normalizeSalesModel(client.onboarding_copy?.sales_model) || salesModelOf(niche)
  const strategy = client.onboarding_copy?.sales_strategy || null
  const isService = model !== "order"
  const { data: catalog } = await sb
    .from("services_catalog").select("id,name,category,price_min,color_hex,duration_minutes,image_url")
    .eq("client_id", cid).eq("is_active", true).order("sort_order")
  const terms = client.onboarding_copy?.offer_terms ? normalizeOfferTerms(client.onboarding_copy.offer_terms) : null
  // The Business Sheet (build_sheets.mjs) says how this business hands things over. A store people
  // come into gets a visit story; a shop that ships gets orders with delivery stages.
  const sheet = client.onboarding_copy?.business_sheet || null
  const sflows = sheet?.flows || {}
  const primaryOffer = sheet?.offers?.[sheet?.primary ?? 0]
  const fulfilment = model !== "order" ? null
    : sflows.inStore && !sflows.orderTracking ? "in_store"
    : ["courier", "delivery"].includes(primaryOffer?.fulfilment) ? primaryOffer.fulfilment
    : null
  // How THIS business's customers start and what holds them back, from its own Instagram
  // (collect_customer_voice.mjs). A hand-chosen opening in the lead's sheet wins; no data → plain DM.
  const customerVoice = client.onboarding_copy?.customer_voice || null
  const heroOverride = sheet?.hero || null
  const opening = openingFromOverride(heroOverride?.opening, customerVoice, catalog) || pickOpening(customerVoice, { catalog, fallbackText: null })
  const objection = heroOverride?.objection ? { kind: heroOverride.objection.kind || "price", text: heroOverride.objection.text } : pickObjection(customerVoice)
  const followUp = heroOverride?.follow_up ?? pickFollowUp(customerVoice, opening)
  const voice = { opening, objection, followUp }
  const store = fulfilment === "in_store" ? storeStory({ catalog, sheet, strategy, opening }) : null
  const shop = ["courier", "delivery"].includes(fulfilment) ? orderStory({ catalog, terms, strategy, fulfilment, opening }) : null
  const stays = !!sflows.stays
  const story = stays ? { sale: stayStory({ sheet }), nosale: stayHesitation({ sheet }) }
    : isService ? serviceStory(niche, catalog, terms, model, strategy, { ...voice, calendar: sheet?.flows ? !!sheet.flows.calendar : true })
    : store ? { sale: store.sale, nosale: storeComplaint(store.item) }
    : shop ? { sale: shop.sale, nosale: productStory(niche, catalog, fulfilment).nosale }
    : productStory(niche, catalog, fulfilment)
  // A hand-written hero in the lead's sheet (sheets/<email>.json → hero.msgs) replaces the generated
  // one: for a lead worth it, a person picks the real comment and writes every agent line from the
  // business's own words. A message tagged {post} becomes a reply to that Instagram post.
  // A hand-written conversation (sheets/<email>.json): its own words, the post it answers, and an
  // appointment only when the conversation books one ("Upisani ste za prvi pregled danas u 15h").
  const post = (code) => (customerVoice?.posts || []).find((p) => p.shortcode === code)
  const withPosts = (msgs) => msgs.map(([role, text, meta]) => {
    const p = meta?.post ? post(meta.post) : null
    return p ? [role, text, { type: "post_reply", image_url: p.image || null, post_caption: p.caption.slice(0, 140) }] : [role, text]
  })
  const apptOf = (a) => a ? { service_name: a.service_name, color: a.color || "#10b981", service_id: catalog.find((x) => x.name === a.service_name)?.id ?? null, duration: a.duration || 30 } : null
  if (heroOverride?.msgs?.length) {
    story.sale = {
      channel: heroOverride.channel || "instagram", customer: heroOverride.customer, phone: heroOverride.phone,
      msgs: withPosts(heroOverride.msgs), crm: heroOverride.crm, appt: apptOf(heroOverride.appt),
    }
  }
  // the customer who asked and left, in this business's own terms (Tandem: the ticket is valid a year)
  const leftOverride = heroOverride?.left
  if (leftOverride?.msgs?.length) {
    story.nosale = {
      channel: leftOverride.channel || "instagram", customer: leftOverride.customer || "Nikola Perić", phone: leftOverride.phone || "063 555 1212",
      msgs: withPosts(leftOverride.msgs), crm: leftOverride.crm, appt: null,
    }
  }
  if (!isService && heroOverride?.complaint?.ask) story.nosale = ownComplaint(heroOverride.complaint, story.sale?.crm?.kategorija)
  const { sale, nosale } = story
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
    ...(isService ? [{ key: `demo_${cid8}_hero3`, s: interventionStory(niche, sheet?.hero?.intervention), baseOffsetMin: 45 }] : []),
    // Services: the customer who left asked yesterday and has been silent since, so the inbox
    // and CRM show him as "Bez odgovora". Products: this is the complaint, which stays recent.
    { key: `demo_${cid8}_hero2`, s: nosale, baseOffsetMin: isService ? 26 * 60 : 90 },
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
      appts.push({ client_id: cid, customer_name: s.crm.full_name, customer_phone: s.crm.telefon, service_id: s.appt.service_id ?? null, service_name: s.appt.service_name, service_color: s.appt.color, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + (s.appt.duration ?? 45) * 60000).toISOString(), status: "confirmed", urgency: "normal", urgency_reason: DEMO_HERO_APPT, source: s.channel === "whatsapp" ? "WhatsApp" : "Instagram", notes: "Zakazano preko AI agenta" })
    }
  }

  // ── background fill: authored convos (recent, populate the inbox) ─────────
  const bgAll = sheet?.hero?.background?.length ? sheet.hero.background
    : model === "quote" ? bgQuoteConvos(terms) : stays ? bgStayConvos({ sheet, terms }) : isService ? bgServiceConvos(terms, niche)
    : fulfilment === "in_store" ? bgStoreConvos({ terms, niche, catalog, sheet })
    : fulfilment ? bgShopConvos({ terms, niche, catalog, sheet, fulfilment }) : bgProductConvos(terms)
  // the four newest threads are what "today" shows, so they cover the mix an owner sees every
  // morning (a new enquiry, one in progress, one won, one more open) instead of whatever came first
  const wonSt = new Set(["Zakazano", "Završeno", "Naručio", "Isporučeno"])
  const pick = (f, skip = []) => bgAll.find((c) => f(c) && !skip.includes(c))
  const lead4 = []
  for (const f of [(c) => c.st === "Novi", (c) => c.st === "Zainteresovan", (c) => wonSt.has(c.st), (c) => c.st === "Zainteresovan"]) { const c = pick(f, lead4); if (c) lead4.push(c) }
  const bg = [...lead4, ...bgAll.filter((c) => !lead4.includes(c))]
  bg.forEach((c, idx) => {
    const key = `demo_${cid8}_bg${idx}`
    // ~7 conversations a day is what 200 over 28 days means. Four fall in the hours after the
    // hero rows; the rest are older than the 26h-old "Bez odgovora" hero, so that hero sits a few
    // rows under Marija and the tour never has to scroll the table to reach him.
    const TODAY = [150, 330, 560, 900]
    const baseOffsetMin = idx < TODAY.length ? TODAY[idx] : 28 * 60 + (idx - TODAY.length) * 410
    c.msgs.forEach(([role, text], i) => {
      const ts = new Date(now - baseOffsetMin * 60000 + i * 40000).toISOString()
      razgovori.push({ id_razgovora: key, role, message: text, platform: c.ch, client_id: cid, created_at: ts, metadata: { name: c.name, profile_pic: pic(c.name) } })
    })
    crmRows.push({
      id_razgovora: key, client_id: cid, full_name: c.name, telefon: phoneFor(idx + 41),
      kategorija: isService ? "Usluge" : "Proizvodi", status: c.st,
      ...((c.stage || stageFor(c.st, baseOffsetMin, fulfilment)) ? { status_porudzbine: c.stage || stageFor(c.st, baseOffsetMin, fulfilment) } : {}),
      izvor: c.ch === "whatsapp" ? "WhatsApp" : c.ch === "facebook" ? "Facebook" : c.ch === "website" ? "Website" : "Instagram",
      created_at: new Date(now - baseOffsetMin * 60000).toISOString(),
    })
  })

  // ── filler convos across the last 28 days ────────────────────────────────
  // Each one also becomes a CRM row, because the whole claim is "nijedan upit ne
  // propada" — a full inbox next to a near-empty CRM would say the opposite.
  // 188 = the 170 it was plus the 18 retired builder threads, so the inbox keeps ~7 a day
  const FILL_N = 188
  for (const f of fillerConvos(model, FILL_N, cid8, niche, catalog, terms, strategy, { sheet, fulfilment })) {
    f.msgs.forEach(([role, text], i) => {
      const ts = new Date(now - f.minAgo * 60000 + i * 40000).toISOString()
      razgovori.push({ id_razgovora: f.key, role, message: text, platform: f.ch, client_id: cid, created_at: ts, metadata: { name: f.name, profile_pic: pic(f.name) } })
    })
    crmRows.push({
      id_razgovora: f.key, client_id: cid, full_name: f.name, telefon: f.telefon,
      kategorija: f.kategorija || (isService ? "Usluge" : "Proizvodi"), proizvod: f.proizvod, status: f.status,
      ...(f.status_porudzbine ? { status_porudzbine: f.status_porudzbine } : {}),
      izvor: f.ch === "whatsapp" ? "WhatsApp" : f.ch === "facebook" ? "Facebook" : f.ch === "website" ? "Website" : "Instagram",
      created_at: new Date(now - f.minAgo * 60000).toISOString(),
    })
  }

  await retireBuilderThreads(cid)

  // a slot calendar only where customers book a slot (not a hotel's date reservations)
  if (model === "booking" && (!sheet || sheet.flows?.calendar)) {
    for (const a of scheduleAppts(niche, catalog, sheet?.booking?.days || null)) appts.push({ client_id: cid, ...a })
    // The customer file shows a history of visits. Marija is a returning patient: one
    // finished visit a few months back, so her file reads past visit → today's booking.
    // A lower-priced service from their own catalogue, never the treatment she asked about.
    const prior = [...(catalog || [])].filter((c) => c.name).sort((a, b) => (a.price_min || 0) - (b.price_min || 0))
      .find((c) => c.name !== sale.crm.proizvod && c.name !== sale.appt?.service_name)
    // only when her conversation books something; and on a day the business works
    const days = sheet?.booking?.days
    const visit = new Date(); visit.setDate(visit.getDate() - 118); visit.setHours(10, 0, 0, 0)
    while (days?.length && !days.includes(visit.getDay())) visit.setDate(visit.getDate() - 1)
    if (sale.appt) appts.push({ client_id: cid, customer_name: sale.crm.full_name, customer_phone: sale.crm.telefon,
      service_id: prior?.id ?? null, service_name: prior?.name || "Kontrolni pregled", service_color: prior?.color_hex || "#64748b",
      starts_at: visit.toISOString(), ends_at: new Date(visit.getTime() + 45 * 60000).toISOString(),
      status: "completed", urgency: "normal", source: "WhatsApp", notes: "Zakazano preko AI agenta" })
  }

  // The CRM measures silence from updated_at, which the database stamps at insert time;
  // without this every seeded lead reads as active in the CRM while the inbox shows the
  // same lead as "Bez odgovora". Last activity = the thread's last message.
  const lastAt = {}
  for (const m of razgovori) if (!lastAt[m.id_razgovora] || m.created_at > lastAt[m.id_razgovora]) lastAt[m.id_razgovora] = m.created_at
  for (const r of crmRows) r.updated_at ??= lastAt[r.id_razgovora] ?? r.created_at

  // The tour's first card is the same on every demo (lib/onboarding/tour-copy.mjs). Nothing else is stored per demo:
  // the Ponuda used to lead with "Više od 30 ljudi je ispod Vaših poslednjih 12 objava pitalo za cenu" (counted from
  // the lead's public comments); Nikola dropped it on 2026-11-10 ("not sure the stat is reliable, and only 30?").
  {
    const { data: fresh } = await sb.from("clients").select("onboarding_copy").eq("id", cid).single()
    await sb.from("clients").update({ onboarding_copy: {
      ...(fresh?.onboarding_copy || {}),
      tour_story: null,
      hero_opening: { kind: opening?.kind || "dm", source: opening?.source || "fallback", text: opening?.text || null, objection: objection?.text || null },
    } }).eq("id", cid)
  }

  // 2026-11-10 (clinic fact-checks): no emoji in what a clinic's agent writes ("😊 ✅ 🙏 jar on a medical question"). Done once, here, for
  // every thread (hero, background and filler), so no template added later can put one back. The customer's own words are left alone.
  if (["dental", "medical"].includes(String(niche).toLowerCase())) {
    for (const m of razgovori) if (m.role === "assistant") m.message = m.message.replace(/\s*[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, "").replace(/\s{2,}/g, " ").trim()
  }
  const r1 = await sb.from("razgovori").insert(razgovori)
  const r2 = await sb.from("demo_crm").insert(crmRows)
  const r3 = appts.length ? await sb.from("appointments").insert(appts) : { error: null }
  const errs = [r1.error, r2.error, r3.error].filter(Boolean).map((e) => e.message)
  const mix = crmRows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {})
  const conv = crmRows.length ? Math.round((crmRows.filter(r => ["Zakazano","Završeno","Naručio","Isporučeno"].includes(r.status)).length / crmRows.length) * 100) : 0
  console.log(`  ${client.name} (${niche}, ${model}): ${razgovori.length} msgs, ${crmRows.length} CRM (${conv}% konv.), ${appts.length} appt ${errs.length ? "ERR: " + errs.join("; ") : "✓"}`)
  console.log(`    status mix:`, mix)
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

async function main() {
  const args = process.argv.slice(2)
  let clients = []
  if (args.includes("--all-demos")) {
    const { data } = await sb.from("clients").select("id,name,demo_niche,onboarding_copy").not("demo_niche", "is", null)
    clients = data || []
  } else {
    const ei = args.indexOf("--email"); const email = ei !== -1 ? args[ei + 1] : "office@crowndental.rs"
    const { data } = await sb.from("clients").select("id,name,demo_niche,onboarding_copy").eq("email", email).single()
    clients = data ? [data] : []
  }
  console.log(`Seeding onboarding story for ${clients.length} tenant(s):`)
  for (const c of clients) await seedTenant(c)
  console.log("Done.")
}
main()
