// Business type of a lead (name, niche, bio, site, handle). Used to SEE the mix (funnel_by_family.mjs) and to spread a limited measuring budget across types.
// It is NOT a restriction: Nikola 2026-11-15 noticed the pattern and asked where it comes from; he did not ask to cap any type.
export const FAMILIES = [
  ['dental/medical', /stomat|dental|dentist|ordinacij|klinik|hirurg|estetsk|medic|zubar/i],
  ['furniture', /namestaj|nameštaj|furniture|enterijer|interior|kuhinj|plakar|stolar|garnitur|krevet|lezaj|ležaj|stolic/i],
  ['prefab/windows/pergolas', /kontejner|montazn|montažn|tiny|pergol|tende|pvc|aluminij|stolarij|fasad|vikendic|zastakljiv/i],
  ['fashion/shoes/accessories', /fashion|odeca|odeća|obuc|obuć|haljin|cipel|clothing|butik|garderob|patike|nakit|torb|satov|naocar/i],
  ['beauty/cosmetics/hair', /kozmet|beauty|hair|kosa|frizer|nokti|lash|laser|cosmetic|sminka|šminka|parfem/i],
  ['kids/toys/baby', /bebi|beba|deca|decij|igracke|igračke|kids|toys/i],
  ['auto/bike/tech', /auto |moto|bike|bicikl|vozil|gume|mobiln|telefon|racunar|računar|elektron/i],
  ['food/drink/farm', /hrana|food|farm|ketering|torta|slatk|vino|vinar|catering|sok/i],
  ['home textile/decor', /posteljin|tekstil|zavese|tepih|dekor|decor/i],
  ['sport/fitness', /fitnes|fitness|sport|teretana|sprava/i],
]
export const familyOf = (r, bio = r?.intake_data?.enrichment?.instagram_profile?.bio || '') => {
  const t = [r.company_name, r.niche, bio, r.website, r.instagram_handle].join(' ')
  for (const [name, re] of FAMILIES) if (re.test(t)) return name
  return 'other'
}
/** Round-robin across types so a batch is not 35% one type: [a1,a2,b1,b2,c1] -> a1,b1,c1,a2,b2 (each type keeps its own order). */
export function interleave(items, key) {
  const groups = new Map()
  for (const it of items) { const k = key(it); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it) }
  const out = []
  for (let i = 0; out.length < items.length; i++) for (const g of groups.values()) if (g[i]) out.push(g[i])
  return out
}
