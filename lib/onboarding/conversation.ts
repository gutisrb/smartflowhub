// Curated "showcase" agent conversations for the onboarding demo.
// These replay as an animated Instagram-DM thread that shows the agent doing the
// full job end-to-end — answering, recognizing a photo, and closing an order or
// booking — modeled on the live Harmonija ordering flow. Copy reviewed against
// the project `copywriting` skill: plain Serbian, customer's own words, no fluff.

export type ChatRole = "customer" | "agent" | "system"

export interface ChatBeat {
  role: ChatRole
  text: string
  /** Optional image bubble (customer sends a photo the agent then recognizes). */
  image?: "book" | "product" | "tooth"
  /** ms the typing indicator shows before this bubble appears (agent only). */
  typing?: number
  /** Small inline status note (role: "system"), e.g. the CRM/calendar write. */
  badge?: "crm" | "calendar" | "analytics" | "intervencija"
}

export interface ShowcaseConversation {
  customerName: string
  platform: "instagram" | "facebook" | "whatsapp"
  /** What the agent accomplished — drives the closing "drop into CRM" beat. */
  outcome: { label: string; status: string; tab: string }
  beats: ChatBeat[]
}

type Archetype = "appointment" | "order"

const APPOINTMENT_NICHES = new Set([
  "dental", "medical", "beauty", "fitness", "services", "wellness", "real-estate",
])

function archetypeFor(nicheKey: string): Archetype {
  return APPOINTMENT_NICHES.has(nicheKey) ? "appointment" : "order"
}

// Per-niche specifics so one archetype reads true for many businesses.
const SERVICE: Record<string, { name: string; price: string; minutes: string }> = {
  dental:   { name: "izbeljivanje zuba", price: "18.000 RSD", minutes: "60" },
  medical:  { name: "pregled", price: "4.000 RSD", minutes: "30" },
  beauty:   { name: "tretman lica", price: "4.500 RSD", minutes: "60" },
  fitness:  { name: "personalni trening", price: "2.500 RSD", minutes: "60" },
  services: { name: "konsultacije", price: "3.000 RSD", minutes: "45" },
  wellness: { name: "masaža", price: "4.000 RSD", minutes: "60" },
  "real-estate": { name: "obilazak stana", price: "", minutes: "30" },
}

const PRODUCT: Record<string, { name: string; price: string }> = {
  ecommerce: { name: "proizvod sa slike", price: "2.490 RSD" },
  furniture: { name: "sto sa slike", price: "24.900 RSD" },
  fashion:   { name: "haljina sa slike", price: "5.990 RSD" },
  food:      { name: "torta sa slike", price: "3.500 RSD" },
  auto:      { name: "deo sa slike", price: "6.900 RSD" },
  generic:   { name: "proizvod sa slike", price: "2.490 RSD" },
}

function appointmentConversation(nicheKey: string): ShowcaseConversation {
  const s = SERVICE[nicheKey] ?? SERVICE.services
  const priceLine = s.price
    ? `${capitalize(s.name)} je ${s.price}, traje oko ${s.minutes} minuta.`
    : `${capitalize(s.name)} traje oko ${s.minutes} minuta i potpuno je besplatan.`
  return {
    customerName: "Marija Jović",
    platform: "instagram",
    outcome: { label: "Marija Jović — Zakazano", status: "Zakazano", tab: "Termini" },
    beats: [
      { role: "customer", text: `Zdravo, koliko košta ${s.name}?` },
      { role: "agent", typing: 1100, text: `Zdravo, Marija 😊 ${priceLine} Da Vas zakažem?` },
      { role: "customer", text: "Može, jel ima nešto ovaj petak popodne?" },
      { role: "agent", typing: 1000, text: "Imam slobodno u petak u 16h ili 17h — šta Vam više odgovara?" },
      { role: "customer", text: "17h" },
      { role: "agent", typing: 900, text: "Samo mi recite ime i broj telefona da potvrdim termin." },
      { role: "customer", text: "Marija Jović, 064 123 4567" },
      { role: "agent", typing: 1200, text: "Zakazano za petak u 17h. Poslaću Vam podsetnik dan ranije ✅" },
      { role: "system", badge: "calendar", text: "Termin upisan u kalendar — Marija Jović, petak 17h" },
      { role: "system", badge: "crm", text: "Sačuvano u CRM: Marija Jović · Zakazano" },
    ],
  }
}

function orderConversation(nicheKey: string): ShowcaseConversation {
  const p = PRODUCT[nicheKey] ?? PRODUCT.generic
  const imageKind = nicheKey === "ecommerce" || nicheKey === "generic" ? "product" : "product"
  return {
    customerName: "Stefan Ilić",
    platform: "instagram",
    outcome: { label: "Stefan Ilić — Poručio", status: "Poručio", tab: "CRM" },
    beats: [
      { role: "customer", text: "Imate li ovo na stanju?", image: imageKind as ChatBeat["image"] },
      { role: "agent", typing: 1300, text: `Prepoznao sam sliku — ${p.name}, ${p.price}, na stanju. Da poručim za Vas?` },
      { role: "customer", text: "Da, može" },
      { role: "agent", typing: 900, text: "Plaćate pouzećem ili karticom?" },
      { role: "customer", text: "Pouzeće" },
      { role: "agent", typing: 1000, text: "Treba mi ime i prezime, broj telefona i adresa (ulica, broj, grad)." },
      { role: "customer", text: "Stefan Ilić, 063 987 6543, Kralja Petra 12, Novi Sad" },
      { role: "agent", typing: 1300, text: "Potvrđujem porudžbinu: pouzeće, Stefan Ilić, Kralja Petra 12, Novi Sad. Šaljem danas, stiže za dva dana 📦" },
      { role: "system", badge: "crm", text: "Sačuvano u CRM: Stefan Ilić · Poručio" },
      { role: "system", badge: "analytics", text: "Analitika ažurirana — +1 prodaja iz poruke" },
    ],
  }
}

export function getShowcaseConversation(nicheKey: string | null | undefined): ShowcaseConversation {
  const key = (nicheKey || "generic").toLowerCase()
  return archetypeFor(key) === "appointment"
    ? appointmentConversation(key)
    : orderConversation(key)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
