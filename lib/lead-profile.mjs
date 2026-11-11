// WHO is worth a demo: the second half of the lead gate (lib/lead-fit.mjs judges reach; this judges the business itself).
//
// Nikola, 2026-11-11: "I like this OG batch of leads very much, I want all future leads to be over that quality… quality clients that can
// both afford and have actual visibly obvious evidence of value for my offer, not corporations or huge clients." The original batch
// (Varmus prefab houses, LOGERA tiny homes, Tandem skydiving, Cvejanović + DENTALUX implants, JetSet phones, Luxor + Dallas furniture,
// Demart pergolas) has one thing in common: a HIGH-CONSIDERATION purchase where the customer asks, compares and is guided to a decision
// by conversation (quote, custom order, booking, big-ticket). The newest 12 got in through loose comment tiers and search terms that
// pulled in beauty, laser, hair and bridal accounts: frequent, low-ticket, appointment-commodity businesses where a sales agent has
// little to sell. A lead must match one of the verticals below, must not match a low-ticket one, and must not be a chain or corporation.
// Unknown vertical = not eligible (add it here, with evidence, rather than letting it through by default).

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')

/** High-consideration verticals: what the customer buys is big, custom or booked after a conversation. */
export const VERTICALS = {
  prefab: /montazn|kontejner|tiny ?(home|house)|drvene kuce|brvnar|mobilne kuce|prefabrik|moduln\w* kuc/,
  pergole: /pergol|\btende\b|zimski vrt|staklene basta|bioklimat|klizni (krov|sistem|prozor)/,
  furniture: /namestaj|furniture|interior|kuhinj\w* po meri|plakar|enterijer|spavac\w+ sob|ugaon\w+ garnitur|tapacir|stolarij\w* po meri|sto za|lezaj|krevet/,
  windows: /pvc stolarij|aluminijumsk\w* stolarij|stolarij|prozori i vrata|roletn|fasad/,
  pools_solar: /(izgradnj|izrad|gradnj)\w* bazen|bazeni po meri|bazensk\w* (oprema|tehnika)|solarn|fotonapon|toplotn\w* pump/,
  dental: /stomat|dental|\bdent\b|dentist|implant|ortodon|zubn|zubar/,
  aesthetic_surgery: /plastic\w* hirurg|estetsk\w* hirurg|hirurg/,
  auto: /auto ?salon|polovni automobil|polovna vozila|prodaja vozila|automobil/,
  electronics: /mobilni telefon|gsm|servis telefon|otkup telefon|laptop|racunar/,
  experience: /tandem|padobran|paraglajd|paragliding|skok\b|adrenalin/,
  real_estate: /nekretnin|izgradnja stanova|investitor|stanovi u izgradnji|gradnj/,
}

/** Frequent, low-ticket or non-selling accounts: a sales agent has little to sell here. */
export const LOW_TICKET = /lepot|negu (lica|tela)|nega (lica|tela)|body ?space|estetic centar|salon lepote|kozmeticar|kozmeticki|frizer|sisanje|manikir|nokti|trepavic|laser\w* epilacij|epilacij|tretman\w* lica|wellness|\bspa\b|masaz|kafic|restoran|torte|slastic|odeca|haljin|majic|cipel|nakit|sminka|parfem|ulja\b|ulje\b|kozmetik|igracke|bebi|vesti|portal|\bcoach|trener|edukacij|kurs\b|vencanic|bridal|wedding|hair|lash|nails|beauty/

/** Chains, franchises and corporations: not the owner-run businesses the offer is for. */
export const CORPORATE = /lanac|franshiz|franchise|siroma srbije|sirom srbije|preko \d+ (prodavnica|salona|objekata|lokacija)|\bgrupa\b|\bgroup\b|holding|veleprodaj|distributer|zastupnik/

/**
 * @param {{ name?: string, bio?: string, category?: string, niche?: string, followers?: number|null, website?: string|null }} p
 * @returns {{ pass: boolean, vertical: string|null, fails: string[], notes: string[] }}
 */
export function profileFit(p) {
  // What the business IS comes from its name and its niche label; the bio is weaker evidence (Studio Namaste's bio mentions "plastična
  // hirurgija" and tripped the surgery vertical though it is a body-care studio). A low-ticket word in the name/niche wins over any bio match.
  // the classifier's generic 'klinika_wellness' label is put on dental clinics too, so it is not evidence of a spa
  const strong = fold(`${p.name || ''} ${String(p.niche || '').replace(/klinika_wellness/gi, '')}`)
  const weak = fold(`${p.bio || ''} ${p.category || ''}`)
  const text = `${strong} ${weak}`
  const fails = []
  const notes = []
  let vertical = null
  for (const [k, re] of Object.entries(VERTICALS)) if (re.test(strong)) { vertical = k; break }
  const lowStrong = strong.match(LOW_TICKET)
  if (!vertical && !lowStrong) for (const [k, re] of Object.entries(VERTICALS)) if (re.test(weak)) { vertical = k; break }
  const low = lowStrong || text.match(LOW_TICKET)
  const corp = text.match(CORPORATE)
  if (lowStrong && !(vertical && ['dental', 'aesthetic_surgery', 'furniture', 'prefab', 'pergole', 'windows', 'pools_solar', 'auto', 'electronics', 'experience', 'real_estate'].includes(vertical))) fails.push(`low-ticket / non-selling business ("${lowStrong[0]}")`)
  else if (!vertical && low) fails.push(`low-ticket / non-selling business ("${low[0]}")`)
  else if (!vertical) fails.push('vertical not in the high-consideration list (prefab, pergole, furniture, windows, pools/solar, dental, aesthetic surgery, auto, electronics, experience, real estate)')
  if (corp) fails.push(`chain or corporation signal ("${corp[0]}")`)
  if (p.followers != null && p.followers > 200000) fails.push(`${p.followers} followers: too big, not an owner-run SMB`)
  if (p.website === null) notes.push('no own website found yet')
  return { pass: fails.length === 0, vertical, fails, notes }
}
