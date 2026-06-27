// Curated "showcase" agent conversations for the onboarding story.
// Rendered as an animated DM thread styled like the real AI Inbox: it shows the
// agent doing the whole job — answering instantly, handling an objection,
// suggesting an alternative, remembering the customer, closing, and logging the
// outcome. Modeled on the live Harmonija ordering flow. Copy reviewed against
// the project `copywriting` skill.

export type ChatRole = "customer" | "agent" | "system"

export interface ChatBeat {
  role: ChatRole
  text: string
  image?: "book" | "product" | "tooth"
  typing?: number
  badge?: "crm" | "calendar" | "analytics" | "intervencija"
}

export interface ShowcaseConversation {
  customerName: string
  channel: "Instagram" | "Facebook" | "WhatsApp"
  outcome: { label: string; status: string }
  beats: ChatBeat[]
}

type Archetype = "appointment" | "order"

const APPOINTMENT_NICHES = new Set([
  "dental", "medical", "beauty", "fitness", "services", "wellness", "real-estate",
])

function archetypeFor(nicheKey: string): Archetype {
  return APPOINTMENT_NICHES.has(nicheKey) ? "appointment" : "order"
}

const SERVICE: Record<string, { name: string; price: string; alt: string; altPrice: string }> = {
  dental:   { name: "izbeljivanje zuba", price: "18.000 RSD", alt: "poliranje i uklanjanje fleka", altPrice: "7.000 RSD" },
  medical:  { name: "pregled specijaliste", price: "5.000 RSD", alt: "osnovni pregled", altPrice: "3.000 RSD" },
  beauty:   { name: "tretman lica", price: "4.500 RSD", alt: "dubinsko čišćenje", altPrice: "2.900 RSD" },
  fitness:  { name: "personalni trening", price: "2.500 RSD", alt: "grupni čas", altPrice: "900 RSD" },
  services: { name: "konsultacije", price: "3.000 RSD", alt: "kratak uvodni poziv", altPrice: "besplatno" },
  wellness: { name: "masaža (60 min)", price: "4.000 RSD", alt: "masaža (30 min)", altPrice: "2.500 RSD" },
}

const PRODUCT: Record<string, { name: string; price: string; alt: string; altPrice: string }> = {
  ecommerce: { name: "model sa slike", price: "2.490 RSD", alt: "vrlo sličan model u istoj boji", altPrice: "2.190 RSD" },
  furniture: { name: "sto sa slike", price: "24.900 RSD", alt: "isti sto u hrastu", altPrice: "22.500 RSD" },
  fashion:   { name: "haljina sa slike", price: "5.990 RSD", alt: "ista haljina u veličini M", altPrice: "5.990 RSD" },
  food:      { name: "torta sa slike", price: "3.500 RSD", alt: "ista torta, manja porcija", altPrice: "2.400 RSD" },
  generic:   { name: "proizvod sa slike", price: "2.490 RSD", alt: "vrlo sličan model", altPrice: "2.190 RSD" },
}

function appointmentConversation(nicheKey: string): ShowcaseConversation {
  const s = SERVICE[nicheKey] ?? SERVICE.services
  return {
    customerName: "Marija Jović",
    channel: "WhatsApp",
    outcome: { label: "Marija Jović — Zakazano", status: "Zakazano" },
    beats: [
      { role: "customer", text: `Zdravo, koliko košta ${s.name}?` },
      { role: "agent", typing: 1100, text: `Zdravo, Marija 😊 ${cap(s.name)} je ${s.price}. Da Vas zakažem?` },
      { role: "customer", text: "Hmm, malo mi je skupo trenutno" },
      { role: "agent", typing: 1300, text: `Razumem. Imamo i ${s.alt} za ${s.altPrice} — odličan prvi korak. Da Vam zakažem to?` },
      { role: "customer", text: "To može!" },
      { role: "agent", typing: 1000, text: "Super. Imam slobodno u petak u 16h ili 17h — šta Vam odgovara?" },
      { role: "customer", text: "17h" },
      { role: "agent", typing: 900, text: "Samo ime i broj telefona da potvrdim termin." },
      { role: "customer", text: "Marija Jović, 064 123 4567" },
      { role: "agent", typing: 1200, text: "Zakazano za petak u 17h ✅ Poslaću Vam podsetnik dan ranije." },
      { role: "system", badge: "calendar", text: "Termin upisan u kalendar — Marija Jović, petak 17h" },
      { role: "system", badge: "crm", text: "Sačuvano u CRM: Marija Jović · Zakazano" },
    ],
  }
}

function orderConversation(nicheKey: string): ShowcaseConversation {
  const p = PRODUCT[nicheKey] ?? PRODUCT.generic
  return {
    customerName: "Stefan Ilić",
    channel: "Instagram",
    outcome: { label: "Stefan Ilić — Poručio", status: "Poručio" },
    beats: [
      { role: "customer", text: "Imate li ovo na stanju?", image: "product" },
      { role: "agent", typing: 1400, text: `Prepoznao sam sliku — ${p.name}, ${p.price}. Baš taj je rasprodat, ali imam ${p.alt} za ${p.altPrice}. Da Vam pošaljem njega?` },
      { role: "customer", text: "Može, da" },
      { role: "agent", typing: 900, text: "Plaćate pouzećem ili karticom?" },
      { role: "customer", text: "Pouzeće" },
      { role: "agent", typing: 1000, text: "Treba mi ime i prezime, telefon i adresa (ulica, broj, grad)." },
      { role: "customer", text: "Stefan Ilić, 063 987 6543, Kralja Petra 12, Novi Sad" },
      { role: "agent", typing: 1400, text: "Potvrđujem porudžbinu. Šaljem danas — broj za praćenje stiže SMS-om, stiže za dva dana 📦" },
      { role: "system", badge: "crm", text: "Sačuvano u CRM: Stefan Ilić · Poručio" },
      { role: "system", badge: "analytics", text: "Analitika ažurirana — +1 prodaja iz poruke" },
    ],
  }
}

export function getShowcaseConversation(nicheKey: string | null | undefined): ShowcaseConversation {
  const key = (nicheKey || "generic").toLowerCase()
  return archetypeFor(key) === "appointment" ? appointmentConversation(key) : orderConversation(key)
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }
