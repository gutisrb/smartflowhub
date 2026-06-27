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
    ],
    crm: { full_name: "Jelena Marić", telefon: "060 444 7788", kategorija: p.cat, proizvod: "Reklamacija", status: "Intervencija", razlog: "Reklamacija — oštećen proizvod. Prosleđeno timu na rešavanje.", izvor: "Instagram" },
    appt: null,
  }
  return { sale, nosale }
}

async function seedTenant(client) {
  const cid = client.id
  const niche = (client.demo_niche || "generic").toLowerCase()
  const isService = SERVICE_NICHES.has(niche)
  const { sale, nosale } = isService ? serviceStory(niche) : productStory(niche)
  const cid8 = cid.slice(0, 8)

  // wipe prior hero rows
  await sb.from("razgovori").delete().eq("client_id", cid).like("id_razgovora", `%_hero%`)
  await sb.from("demo_crm").delete().eq("client_id", cid).like("id_razgovora", `%_hero%`)
  await sb.from("appointments").delete().eq("client_id", cid).eq("notes", "Zakazano preko AI agenta")

  const now = Date.now()
  const scenarios = [
    { key: `demo_${cid8}_hero1`, s: sale, baseOffsetMin: 12 },   // most recent -> top of inbox
    { key: `demo_${cid8}_hero2`, s: nosale, baseOffsetMin: 90 },
  ]

  const razgovori = []
  const crmRows = []
  const appts = []

  for (const { key, s, baseOffsetMin } of scenarios) {
    s.msgs.forEach(([role, text], i) => {
      const ts = new Date(now - (baseOffsetMin * 60000) + i * 40000).toISOString() // 40s apart
      razgovori.push({ id_razgovora: key, role, message: text, platform: s.channel, client_id: cid, created_at: ts, metadata: { name: s.customer, profile_pic: pic(s.customer) } })
    })
    crmRows.push({ ...s.crm, id_razgovora: key, client_id: cid, created_at: new Date(now - baseOffsetMin * 60000).toISOString() })
    if (s.appt) {
      const start = apptStart(15)
      appts.push({ client_id: cid, customer_name: s.crm.full_name, customer_phone: s.crm.telefon, service_name: s.appt.service_name, service_color: s.appt.color, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 45 * 60000).toISOString(), status: "confirmed", urgency: "normal", source: s.channel === "whatsapp" ? "WhatsApp" : "Instagram", notes: "Zakazano preko AI agenta" })
    }
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
