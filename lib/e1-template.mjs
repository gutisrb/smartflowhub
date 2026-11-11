// E1 (v20 final, 2026-11-10: Nikola picked between v19 and v20; v20 + his own edit "Sve što zahteva Vašu pažnju"): the cold email, one skeleton for every lead, per-lead nouns from its hand sheet.
//
// v16 (same day) changed the angle: "I don't want to seem like a stupid little chatbot… give it a proper terminology,
// a proper name, a proper angle". The AI LEADS the sale ("vodi"), it never "answers"; no speed or hours; no "u demou".
//
// v17 (Nikola, 2026-11-05, on v16): "u shouldnt direct it towards a specific example. cuz im not very confident in the
// real world actuality of these examples and i hate guessing business scenarios and processes… not being accurate
// could result in them thinking 'this isnt relatable to me so i dont need it'… put more emphasis on the DATA and logs…
// most wanted product, most common questions, requests, most popular treatments/times… we will ALSO use this to
// continuously improve and track the selling and conversion rate of the AI model… 'together we would agree/come up
// with the best sequences for highest conversion, and look for clues in the data'… the subject line and the intro
// line could be better. more baity. more incentivizing."
//
//   - No business scenario, no quoted chat, no "look at how it handles X". Per lead only: its name, what it sells
//     (modeli, paketi, telefoni, usluge), where its sale ends (naruči, kupi, zakaže). Everything else is category-level
//     and is what the demo's analytics really shows (chatbot-analytics-module: Najtraženiji proizvodi / Za šta se
//     najviše raspituju, Potražnja, Špic sati / Najtraženiji termini, Zašto ljudi ne kupe|zakažu|traže ponudu, Konverzija).
//   - Subject = the question every owner has: "Zašto neko naruči kod Varmusa, a neko ne". Line 1 answers it: the demo
//     leads the sale AND turns every conversation into a record of what was asked and, if they didn't buy, why.
//   - The data gets two paragraphs: what the numbers show → the next post and ad; and the same numbers measure how
//     well the AI sells, the approach is chosen TOGETHER and changed where the data says (never "skripta").
//
// v18 moved the demo link up (2026-11-05: "you put it at the bottom… it will seem like we're trying to… sell them something").
//
// v19 (Nikola, 2026-11-05, on v18): "instead of saying 'I built a demo in which..', 'here's how the latest AI implementation
// for <their niche> would look like for VARMUS FOR FREE'… I don't like this 'I did this', 'I made this' talk… I wanna talk
// about them… Your outro of the email is kind of weird. Please remove this I've been developing this for months… 'I'm
// looking for one good company' — that's a very weird thing to say… Do not leave the scope of common sense… Every line
// should have a purpose and its order of words should be fully 100% intended."
//   - Line 1 is about THEM and carries the hook: "Možete besplatno da vidite kako bi najnovija primena AI-ja u prodaji
//     modularnih objekata izgledala u Varmusu." Word by word: you · free · just look · the newest AI · in your industry
//     (their own site's words) · at your company (end of the sentence = the stress in Serbian).
//   - The effort shows through what the demo is made of, never "napravio sam": "Demo verzija je napravljena od Vaših
//     modela sa sajta i pitanja koja Vam kupci ostavljaju ispod objava."
//   - No backstory ("razvijam mesecima"), no "tražim jednu dobru firmu", no "slobodno zanemarite ovaj mejl".
//
// v20 (Nikola, 2026-11-09, on v19): "make the first line more friendly… 'mozete besplatno da vidite..' kinda sounds like an
// ad, instead of… more accurate to my situation, 'spoken from the heart'… if we spin our story good… since its pretty much
// true… we have an offer nearly impossible to resist." v19's line 1 was an ad (benefit + "besplatno" + call to action)
// and copied his example almost word for word. v20 opens the way a person writes to another: why he is writing (a
// belief about where AI helps THEIR kind of business most) → why a demo and not a pitch ("lakše je to pokazati nego
// objasniti") → that it is theirs ("pripremio sam Vam demo na Vašem primeru", "Vam" = for you) → the honest catch
// ("Hteo sam da prvo vidite kako bi to izgledalo kod Vas": "prvo" = more comes later, said honestly; v15-v19's "pre nego
// što Vam bilo šta predložim" was dropped because the demo itself ends on the Ponuda tab, so the promise was false)
// → free, nothing to connect, a few minutes. The predicament (case study, no
// money pressure) stays a reason for our behaviour, never a line.
//
// Structure map (each paragraph answers the question the one before it raised; vault wiki/offer-voice.md §10 3d):
//   subject  why does one buy and another not?                          curiosity → dream ↑
//   P1       who is this, why is he writing to ME? → his belief about where AI helps firms like mine most; easier
//            shown than explained, so he prepared a demo on my business, from my models and my customers' comments
//                                                                         likelihood ↑, effort shown, no pitch
//   P2       what does it do? → leads every conversation like a salesperson who knows the offer; records why someone
//            didn't buy (the subject's answer)                              dream ↑
//   P3       what's the catch, what does it take? → he wanted me to see it first (more later, honestly); free, nothing to
//            connect, a few minutes, link                                   no catch, effort ↓, time ↓ (~100 words in)
//   P5       will it decide things it shouldn't? → what needs my decision comes to me; one place; one-click takeover
//   P6       what else do I get? → the numbers, then the next post and ad   dream ↑
//   P7       will it get better? → it measures its own selling; the approach would be chosen together   likelihood ↑
//   P8       a question? → reply                                            effort ↓

const KINDS = {
  business: {
    customer: 'kupac', customers: 'kupci', where: 'u prodaji preko društvenih mreža',
    role: 'prodavac koji poznaje celu Vašu ponudu', needs: 'Vašu odluku', whole: 'celu prodaju', profile: 'svakog kupca',
    when: 'kada Vam najviše pišu', win: 'prodajom', measure: 'koliko dobro AI prodaje', best: 'koji najbolje prodaje',
  },
  // "you do not sell to patients" (vault copywriting §1): the clinic hears about patients, appointments and the doctor
  clinic: {
    customer: 'pacijent', customers: 'pacijenti', where: 'u komunikaciji sa pacijentima preko društvenih mreža',
    role: 'koordinator koji poznaje svaku Vašu uslugu', needs: 'procenu lekara', whole: 'sve upite pacijenata',
    profile: 'svakog pacijenta', when: 'koji termini su najtraženiji', win: 'zakazanim terminom',
    measure: 'koliko dobro AI radi', best: 'koji dovodi najviše pacijenata',
  },
}

// hand-written per lead (sheets/<email>.json → "e1"); grammar is per name, so these are whole phrases
export const SLOTS = {
  kind: '"business" or "clinic"',
  subject: 'the owner\'s question, as a person says it: "Zašto neko naruči kod Varmusa, a neko ne". Never "prodaja {Firma}"',
  helps_whom: 'dative plural, the category with their name: "firmama kao što je Varmus" / "ordinacijama kao što je Vaša"',
  made_from: 'what the demo was built from, from their site: "modela sa sajta", "telefona sa sajta", "usluga i cena sa sajta"',
  not_done: 'the subject\'s verb, negated, after "ako": "nije naručio", "nije kupio", "nije zakazao"',
  most_wanted: 'the analytics\' top list in its nouns: "koji modeli su najtraženiji", "za koje usluge se najviše raspituju"',
  gap: 'where its sale ends, after "zbog čega neki odustanu": "pre porudžbine", "pre kupovine", "pre zakazivanja"',
}

export function missingSlots(e = {}) {
  return Object.keys(SLOTS).filter((k) => !String(e[k] || '').trim()).concat(e.kind && !KINDS[e.kind] ? ['kind (unknown)'] : [])
}

const SIGNATURE = `Veliki pozdrav,
Nikola Guteša
Smartflow | smartflow.rs | +381 64 118 2200`

/** Subject on line 1, body below; {link}/{email}/{lozinka} are filled by send_outreach.mjs. */
export function buildE1(lead) {
  const miss = missingSlots(lead)
  if (miss.length) throw new Error(`e1: missing slots ${miss.join(', ')}`)
  const e = { ...KINDS[lead.kind], ...lead }
  const body = `Poštovani,

javljam Vam se jer verujem da AI danas najviše može da pomogne ${e.helps_whom} upravo ${e.where}, a to je lakše pokazati nego objasniti. Zato sam Vam pripremio demo na Vašem primeru, od ${e.made_from} i pitanja koja Vam ${e.customers} ostavljaju ispod objava.

U njemu AI vodi svaki razgovor sa Vaših društvenih mreža i sajta kao ${e.role}, a iz svakog beleži šta je ${e.customer} tražio i, ako ${e.not_done}, zašto.

Hteo sam da prvo vidite kako bi to izgledalo kod Vas. Demo je besplatan, ništa ne treba da povezujete, a za par minuta Vas provede kroz sve:
{link}
(prijava: {email} / {lozinka})

Sve što zahteva Vašu pažnju AI prosleđuje Vama, a ${e.whole} pratite na jednom mestu i svaki razgovor možete da preuzmete jednim klikom.

Kada se svi razgovori saberu, vidite ${e.most_wanted}, šta ${e.customers} najčešće pitaju, ${e.when} i zbog čega neki odustanu ${e.gap}. Tako sledeću objavu i oglas pravite prema onome što ${e.customers} zaista žele.

Isti podaci mere i ${e.measure}: koliko razgovora se završi ${e.win}. Najbolji pristup birali bismo zajedno i menjali ga tamo gde podaci pokažu da može bolje.

Ako Vas bilo šta zanima, samo odgovorite na ovaj mejl.

${SIGNATURE}`
  return { subject: e.subject, body, text: `${e.subject}\n${body}\n` }
}
