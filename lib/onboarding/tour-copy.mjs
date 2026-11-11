// The words on the onboarding cards. Pure, so the tour component, the seeder that writes the
// inbox card and `owner_read.mjs` (which prints every card for a human to read) share one source.
//
// Step 1 is the same card on EVERY demo. Its job is to make the owner believe four things in one
// glance: the agent sells, it runs a real sales process written for their business, they stay in
// control, and it is how selling is done now. The chat running beside it is the proof and carries all
// business-specific detail. Register (Nikola, 2026-10-28): calm authority, process as the subject.
// Rejected on the way: a made-up customer's story, a plain description of the function, one handled
// situation, per-demo objection pairs, and "i to vrhunski" / "postaju novac" (cringe, too bold). Off
// limits in this card: superlatives, the word novac, claims about their inbox. See wiki/offer-voice.md.
//
// Rules that hold (vault copywriting §2-§5): no price, no hours/headcount/cost-saving framing, no
// claim about their team or their losses, no "besplatno i bez obaveza", vocabulary klijenti / poruke
// / AI agent / prilagođeno, never automatizacija / bot / chatbot / alat / leadovi / jeftino; the
// process is built WITH the client on the call, nothing is "set up from the website"; formal Vi,
// read aloud.

/** Who the business serves, and who it hands judgment calls to, in the right grammatical case. */
export function tourVocabulary(niche, expertWord = null) {
  const n = (niche || '').toLowerCase()
  const clinic = n === 'dental' || n === 'medical'
  // 2026-11-10 (Tandem, LOGERA, Varmus fact-checks): "trener" for a skydiving school and "stručnjak" for a tiny-house maker.
  // A niche label does not name the people who work there. The role is a clinic's "lekar", or the business's own word
  // (flows.expert, set from its site), and otherwise there is no role at all: the card says "Vama" instead.
  const expert = clinic ? { nom: 'lekar', dat: 'lekaru' } : expertWord
  return {
    patientNom: clinic ? 'pacijent' : 'klijent',
    patientAcc: clinic ? 'pacijenta' : 'klijenta',
    expert: expert?.nom || null,
    // "karton" is a patient's medical file: right for a clinic, meaningless anywhere else
    recordNom: clinic ? 'Karton' : 'Profil klijenta',
    recordLoc: clinic ? 'kartonu' : 'profilu klijenta',
    expertDat: expert?.dat || null,
  }
}

/** The first card, identical on every demo. */
export const FIRST_CARD = {
  eyebrow: 'AI agent za prodaju',
  title: 'Agent vodi Vaš prodajni proces.',
  body: 'Vodi razgovor ka prodaji, a prigovore rešava po Vašim uslovima, u svako doba. Proces pišemo zajedno, a ono što agent ne sme da odluči, prosleđuje Vama.',
  punch: 'Više prodaje iz svakog razgovora.',
}

/**
 * Every card of the tour, keyed by slot (lib/onboarding/tour-slots.ts).
 * `model`: booking | quote | order. Nothing here is per-demo except the nouns the business uses.
 * @param {{ model: string, niche?: string | null, flows?: any }} p
 * @returns {Record<string, { eyebrow: string, title: string, body: string, punch: string, cta?: string }>}
 */
export function tourCopy({ model, niche, flows }) {
  const service = model !== 'order'
  const quote = model === 'quote'
  // a store people come into: the conversation ends in a visit, not a shipped order
  const store = !service && !!flows?.inStore && !flows?.orderTracking
  const ships = !service && !!flows?.orderTracking
  // guests reserve dates (a hotel), not a time slot
  const stays = !!flows?.stays
  const v = tourVocabulary(niche, flows?.expert || null)
  // the appointment-like thing this business ends a conversation with: nominative (the calendar card),
  // accusative ("upisuje … ponudu") and the matching relative pronoun ("rezervacija koju")
  const termNom = quote ? 'ponuda' : stays ? 'rezervacija' : 'termin'
  const termAcc = quote ? 'ponudu' : stays ? 'rezervaciju' : 'termin'
  const termRel = termNom === 'termin' ? 'koji' : 'koju'

  return {
    inbox: FIRST_CARD,
    'inbox-intervencija': {
      eyebrow: 'Granica',
      title: service ? (v.expert ? `Ono što sme samo ${v.expert}, ide ${v.expertDat}.` : 'Ono što agent ne sme da odluči, ide Vama.') : 'Reklamaciju rešavate Vi.',
      body: service
        ? `${v.expert ? `Pitanje na koje sme da odgovori samo ${v.expert} agent ne nagađa.` : 'Na pitanje na koje ne sme da odgovori, agent ne nagađa.'} Upisuje ${v.patientAcc}, odmah Vam javlja, a razgovor ostaje otvoren dok ga ne preuzmete.`
        : 'Agent reklamaciju ne rešava sam. Upisuje kupca, odmah Vam javlja, a razgovor ostaje otvoren dok ga ne preuzmete.',
      punch: 'Vi odlučujete šta agent sme sam.',
    },
    'inbox-odgovor': {
      eyebrow: 'Vi preuzimate',
      title: 'Razgovor je Vaš čim ga zatražite.',
      body: `${service ? 'Dragana' : 'Jelena'} čeka u Intervencijama. Otvorite razgovor i pišite joj direktno; agent ćuti dok mu ga ne vratite.`,
      punch: 'Razgovor mu vraćate jednim klikom.',
    },
    crm: {
      eyebrow: service ? v.recordNom : 'Kartica kupca',
      title: service ? 'Svaki razgovor ostaje Vaš: ko je pisao, šta traži, dokle je stigao.' : 'Svaka porudžbina ostaje Vaša, sa kupcem, artiklom i adresom.',
      body: service
        ? `Agent upisuje razgovor, ${termAcc} i razlog odluke u ${v.recordLoc}. Podaci ostaju kod Vas, a polja i statusi se prave po Vašem načinu rada.`
        : store ? 'Artikal, najavljen dolazak i razlog odluke upisani su kod kupca. Podaci ostaju kod Vas, a polja i statusi se prave po Vašem načinu rada.'
        : ships ? 'Porudžbina, adresa i stanje isporuke upisani su kod kupca. Kad pita gde je porudžbina, agent odgovara iz istog podatka.'
        : 'Artikal, adresa i način plaćanja upisani su kod kupca. Podaci ostaju kod Vas, a polja i statusi se prave po Vašem načinu rada.',
      punch: 'Vidite svakog ko Vam je pisao.',
    },
    // the customer who did not buy. The card says what the file holds for ANYONE who leaves; who this
    // particular one is, and what they said, is in the file the ring is on.
    'crm-izgubljen': {
      eyebrow: service ? (stays ? 'Ko nije rezervisao' : quote ? 'Ko nije tražio ponudu' : 'Ko nije zakazao') : 'Ko se žalio',
      title: service ? `I onaj ko odustane ostaje u ${v.recordLoc}, sa razlogom.` : 'I žalba ostaje zapisana, sa razlogom.',
      body: service
        ? `Agent upisuje poslednju poruku, razlog zbog kog je otišao i ${quote ? 'ponudu koju je predložio' : stays ? 'datume koje je predložio' : 'prvi korak koji je ponudio'}. Znate koga da pozovete i šta da mu kažete.`
        : 'Ceo razgovor i razlog žalbe su zapisani i prosleđeni Vama, pa kupca zovete sa svim što je rekao.',
      punch: service ? 'Znate kome da se javite.' : 'Svaki problem ima ime i razlog.',
    },
    katalog: {
      eyebrow: 'Nacrt',
      title: 'Agent prodaje samo ono što Vi prodajete.',
      body: service
        ? `${quote ? 'Proizvodi' : 'Usluge'}, cene i uslovi sa Vašeg sajta su prvi nacrt. Na razgovoru ih usklađujemo sa onim kako zaista prodajete, a agent koristi svaku izmenu odmah.`
        : store ? 'Artikli i cene sa Vašeg sajta su prvi nacrt. Na razgovoru dogovaramo kako agent prodaje i šta nudi uz artikal.'
        : 'Artikli i cene su prvi nacrt, svaki sa linkom ka Vašoj stranici. Na razgovoru dogovaramo kako agent prodaje, šta nudi uz artikal i kako uzima porudžbinu.',
      punch: 'Prodajni proces pišemo zajedno.',
    },
    termini: {
      eyebrow: 'Raspored',
      title: service ? 'Kalendar se puni dok Vi radite.' : 'Porudžbine stižu dok Vi radite.',
      body: service
        ? `${cap(termNom)} ${termRel} agent dogovori ulazi u kalendar čim ga ${v.patientNom} izabere, sa uslugom i cenom. Dan po dan vidite ko dolazi.`
        : 'Sve što agent dogovori stiže ovde, sa artiklom i cenom: danas, sutra i sledeće nedelje.',
      punch: service ? 'Kalendar je uvek ažuran.' : 'Ništa se ne prekucava.',
    },
    analitika: {
      eyebrow: 'Uvid',
      title: 'Vidite zašto neko nije kupio, u brojevima.',
      body: 'Razlozi zbog kojih ljudi odustaju su izbrojani, od cene do „razmisliću“, uz najčešća pitanja i sate kada Vas najviše traže. Šta se meri, biramo zajedno.',
      punch: 'Sa tim podacima znate šta da promenite.',
    },
    offer: {
      eyebrow: 'Ponuda',
      title: 'Ovo je nacrt. Pravi sistem pravimo sa Vama.',
      body: 'Kako agent prodaje, šta upisuje i šta merite dogovaramo na razgovoru od 20 minuta.',
      punch: 'Pogledajte ponudu.',
      cta: 'Uđite u dashboard',
    },
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
