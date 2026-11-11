// The words of the Ponuda tab, per business model. Pure, so the page (offer-content.tsx) and
// `owner_read.mjs` read the same text.
// 2026-11-04 (Nikola: "keep the offer out the email… simply in the PONUDA tab… make sure that it CLOSES the deal"):
// the email only gets them into the demo; this page carries the whole offer and closes. Written in Nikola's first
// person ("Sve podešavam i testiram ja"), the same voice as the email; "zajedno" only where it is work with the owner.
// 2026-11-10 (Nikola, with screenshots: "very hard to read and very bland… no one is going to read this amount of
// text… it has to be 300% better"): ~544 visible words cut to ~320 (FAQ answers sit behind a click). The page is a
// short proposal the owner can scan in a minute: the offer in one line → what they get → made for them → how it goes (with who does what) → the catch →
// the three questions that decide it → one call. Same facts as before, fewer words; the layout does the rest
// (offer-content.tsx). Dropped: the "30 ljudi pitalo za cenu" stat (Nikola: unreliable and not powerful) and the
// close "Ovo uvodim u jednu firmu i sa njom radim lično" (the same "one firm" idea he called weird on 2026-11-05).
// 2026-11-10 (second pass, Nikola: "you just made its BACKGROUND WHITE… too bright… design it objectively, everything should have a
// reason and a purpose"): "Šta dobijate" is gone (the 8-card tour has just shown it) and "built with you" is one FAQ answer; every
// block now answers one question the owner has, in order: what is the offer → how does it go and what is on me → what is the catch
// → price and lock-in → next step. ~175 visible words (was ~544 on 11-04).
// 2026-11-11 (Nikola: "make this way easier to say yes to… not a sales pitch… why wouldn't you emphasize that I'm willing to give them this
// opportunity… for free"): the page now LEADS with the offer, and the offer changed: setup and the first month are free (reverses the
// 2026-11-01 "no free first month"), the satisfaction guarantee stays ("ostajete samo ako ste potpuno zadovoljni… rastajemo se kao
// prijatelji"; "vraćam svaki dinar" is gone because nothing is paid in month one), and ONE plain sentence says why ("zauzvrat tražim samo
// da smem da pokažem rezultat"), his explicit exception to the 2026-11-05 rule against "test/case study/first client" in copy. Still no
// price, no "besplatno i bez obaveza", no "ne plaćate ništa" (after month one it is paid). Every FAQ answer below states only terms he has
// settled (vault strategy "THE OFFER", offer-voice, the 11-10/11-11 messages); nothing is invented.
// Offer (Nikola, 2026-11-01, replaces the free first month of
// 2026-10-24): they pay, and after the first month on their real messages they stay only if completely
// satisfied; if not, every dinar back and we part as friends. Never a plain "garancija povraćaja novca"
// (it "sounds uncertain"), never "besplatno i bez obaveza". No price on the page. No hours-of-labour, headcount or cost-saving arithmetic.
// The steps carry Nikola's timeline (2026-10-29): accounts and Meta verification in the first 7 days,
// then process and testing; live around day 10, only once tested and approved by the owner.
// The improvement loop (Nikola, 2026-11-05: "birali bismo zajedno… tamo gde podaci pokažu da može bolje") sits in
// builtLead, once.

/**
 * `model`: booking | quote | order. `flows`: Business Sheet flows (inStore, orderTracking, stays).
 * @param {{ model: string, niche?: string | null, flows?: any }} p
 */
export function offerCopy({ model, niche, flows }) {
  const service = model !== 'order'
  const quote = model === 'quote'
  const store = !service && !!flows?.inStore && !flows?.orderTracking
  const ships = !service && !!flows?.orderTracking
  const stays = !!flows?.stays
  const clinic = ['dental', 'medical'].includes((niche || '').toLowerCase())

  // what the agent leads every conversation to, and who it talks to, in the right case
  const goal = quote ? 'ponude' : stays ? 'rezervacije' : service ? 'termina' : store ? 'dolaska u radnju' : 'porudžbine'
  const goalMore = quote ? 'upita za ponudu' : stays ? 'rezervacija' : service ? 'zakazanih termina' : store ? 'kupaca u radnji' : 'porudžbina'
  // a quote business talks to buyers (Varmus got "pred pacijentom" until 2026-10-29); only clinics have patients
  const person = clinic ? 'pacijent' : stays ? 'gost' : service && !quote ? 'klijent' : 'kupac'
  const whoIn = { pacijent: 'pacijentom', gost: 'gostom', klijent: 'klijentom', kupac: 'kupcem' }[person]
  const whoTo = { pacijent: 'pacijentu', gost: 'gostu', klijent: 'klijentu', kupac: 'kupcu' }[person]

  // `when` = where it sits on the timeline, `live` = the moment the system goes live on their messages
  const steps = [
    { when: 'Početak', title: 'Razgovor od 20 minuta', body: 'Pričamo kako prodajete, a Vi dobijate tačan mesečni iznos.' },
    { when: 'Prvih 7 dana', title: 'Povezivanje', body: 'Povezujem sajt i naloge i završavam zvaničnu Meta verifikaciju.' },
    { when: 'Oko 10. dana', title: 'Testiranje i start', live: true, body: `Zajedno pišemo kako agent prilazi ${whoTo}, a ja ga testiram. Uživo ide tek kada Vi kažete.` },
    { when: 'Prvi mesec', title: 'Vi odlučujete', body: 'Sve pratite ovde. Posle mesec dana odlučujete da li nastavljamo.' },
  ]

  // what is on them (effort ↓): shown as its own strip under the timeline
  const effortYou = ['razgovor od 20 minuta', 'pristup nalozima', 'pregled probnih razgovora']
  const effortMe = 'Sve ostalo radim ja.'

  return {
    goal, goalMore, whoIn,
    // the offer in one line: what they just saw + how soon; no sales promise, no claim about their inbox
    headline: 'Ovaj sistem Vam uvodim besplatno.',
    lead: `Agent vodi svaki razgovor sa Vaših društvenih mreža i sajta do ${goal}, a ono što treba da odlučite Vi prosleđuje Vama. Uživo je za oko 10 dana.`,
    free: 'Uvođenje i prvi mesec ne naplaćujem. Zauzvrat tražim samo da, ako Vam rezultati odgovaraju, smem da ih pokažem.',
    steps,
    stepsTitle: 'Kako ide dalje',
    catchTitle: 'Ostajete samo ako ste potpuno zadovoljni.',
    catchBody: 'Prvi mesec je besplatan. Posle njega nastavljate samo ako ste potpuno zadovoljni, a ako niste, rastajemo se kao prijatelji. Razgovori i podaci ostaju Vama. Ceo rizik preuzimam ja.',
    effortYou, effortMe,
    effortLabel: 'Vaš deo',
    effort: `Vaš deo: ${effortYou.slice(0, -1).join(', ')} i ${effortYou[effortYou.length - 1]}. ${effortMe}`,
    faqTitle: 'Česta pitanja',
    faq: [
      { q: 'Zašto besplatno?', a: 'Zato što mi je najvažnije da sistem pokažem na jednoj pravoj firmi. Ako Vam rezultati odgovaraju, tražim samo da smem da ih pokažem. Ako ne odgovaraju, ništa ne dugujete.' },
      { q: 'Šta tačno ne plaćam, a šta posle?', a: 'Ne plaćate uvođenje ni prvi mesec. Posle prvog meseca mesečni iznos zavisi od kanala i broja poruka, a tačan iznos dogovaramo na razgovoru od 20 minuta, pre nego što se na bilo šta obavežete.' },
      { q: 'Šta ako mi ne odgovara?', a: 'Onda nastavljamo samo ako ste potpuno zadovoljni. Ako niste, isključujem ga i rastajemo se kao prijatelji, a svi razgovori i podaci ostaju Vama. Ne vezujete se dugoročno: posle prvog meseca nastavljamo iz meseca u mesec.' },
      { q: `Šta ako pogreši pred ${whoIn}?`, a: 'Pre puštanja ga testiram na probnim razgovorima dok ne odgovara tačno, a uživo ide tek kada Vi kažete. Ono u šta nije siguran ne izgovara, nego prosleđuje Vama, a svaki razgovor možete da preuzmete iz istog prozora.' },
      { q: 'Čiji su razgovori i podaci?', a: 'Vaši, u svakom slučaju. Svaki razgovor se upisuje u profil, sa ponudom ili razlogom zašto je nema, i ostaje Vama i ako se rastanemo.' },
      { q: 'Već koristim alat za komentare i poruke. Šta se menja?', a: 'Takav alat šalje link onome ko napiše ključnu reč. Agent vodi razgovor do ' + goal + ' i sa onim ko samo napiše „Cena?“, a svaki razgovor upisuje u profil, sa razlogom ako nije kupio. Kako se to uklapa u ono što već imate, prolazimo zajedno na razgovoru.' },
      { q: 'Da li je ovo već gotov sistem?', a: `Ne. Ovaj nalog je prvi nacrt, napravljen iz Vašeg sajta. Prodajni proces, CRM, analitiku, marketing${ships ? ' i isporuku' : ''} oblikujemo zajedno i menjamo ih tamo gde podaci pokažu da može bolje.` },
      { q: 'Da li piše na srpskom?', a: 'Da, agent piše na srpskom, a razume i latinicu i ćirilicu.' },
    ],
    // the close: what happens next, the person, and a call that costs them nothing
    closeTitle: 'Sledeći korak je razgovor od 20 minuta.',
    closeLine: 'Prolazimo kako bi ovo radilo kod Vas. Ako Vam ne odgovara, tu završavamo.',
    closeSign: 'Nikola Guteša, osnivač Smartflow-a',
  }
}
