// Red flags in cold-email copy, each one a line Nikola rejected. A blacklist only catches repeats; the recipient
// read (vault wiki/offer-voice.md §10) is the real test. This is the floor under it: `node lint_copy.mjs <file>`
// runs on every draft before it is shown, and qc_drafts.mjs runs it on every stored draft.

export const COLD_EMAIL_RED_FLAGS = [
  [/pristup\w*\s+(Vaš\w*\s+)?nalo[gz]/i, 'asks for account access ("a BIG RED FLAG", 2026-10-29)'],
  [/od Vas (je|su|mi) potreb|treba mi od Vas|potrebno je da (mi )?pošalj/i, 'asks the recipient for something ("I\'m not a beggar")'],
  [/prodajete više|više prodaje|povećaćete prodaju|garantuj/i, 'sales promise nobody can prove from a stranger'],
  [/usko grlo|uska grla/i, '"usko grlo"'],
  [/nekoliko firmi|više firmi|nekoliko kompanij/i, 'several businesses (he is looking for one)'],
  [/za manje nego (što košta )?(jedan |jednog )?zaposlen|jeftinij|deo cene/i, 'cheapness as the value'],
  [/\b(168|48)\s?(h\b|sati)/i, 'hours math'],
  [/besplatno i bez obaveza/i, '"besplatno i bez obaveza"'],
  [/Meta verifikacij/i, 'paperwork in a cold email (belongs in the Ponuda)'],
  [/prvi mesec (ne naplaćujem|je besplatan|besplatno)|besplatan prvi mesec|ne plaćate ništa/i, 'first month free (dropped 2026-11-01: they stay only if completely satisfied)'],
  [/garancij\w* povra[ćc]aj|povra[ćc]aj novca|money.?back/i, 'a plain money-back guarantee "sounds uncertain" (2026-11-01)'],
  [/Instagram\w*,? (i )?Facebook|Facebook\w*,? (i )?(Instagram|WhatsApp)/i, 'lists platforms one by one; say "društvene mreže i sajt" (2026-10-28, again 2026-11-01)'],
  [/mladi preduzetnik|posvetiti sav svoj rad|veruje kao i ja|sve u Smartflowu radim/i, 'too personal ("way too personal", 2026-11-01)'],
  [/AI prodav\w*|AI prodajn\w* sistem/i, 'a second label: the product is the app ("still calling it AI PRODAVAC… two steps back", 2026-11-01)'],
  [/svaki dinar/i, 'refunds a payment the email never mentioned (say "sve što ste platili")'],
  [/AI aplikacij/i, '"AI aplikacija" reads as woo-woo, "a simple chatbot I made in 30 mins" (2026-11-01)'],
  [/inovativn\w* (i perspektivn\w* )?firm/i, '"tražim inovativnu firmu" is "not how I would phrase it" (2026-11-01)'],
  // 2026-11-02: v10 promised this and the demo cannot show it: analytics "Odakle dolaze kupci" counts channels, not ads.
  [/oglas\w* (donos|dovod)/i, 'claims the demo shows which ads bring sales; its analytics shows channels only (2026-11-02)'],
  // 2026-11-04: "how about we keep the offer out the email? simply in the PONUDA tab". The email gets them into the demo;
  // the process, the guarantee and the call live in the Ponuda, which closes.
  [/za oko 10 dana|ako krenemo|posle prvog meseca|vra[ćc]am Vam|rastajemo se|potpuno zadovoljn|mesečn\w* iznos|termin od 20 minuta|cal\.com/i,
    'offer terms or the call in the email; the offer lives in the Ponuda tab (2026-11-04)'],
  // 2026-11-05, on v15 ("Kako bi AI odgovarao kupcima Varmusa" / "U demou AI odgovara odmah"): "I don't want to seem
  // like a stupid little chatbot… if someone started building AI chat this week, he'll probably have the same email
  // as us." Answering is what every chatbot does; the AI leads the sale (lib/e1-template.mjs).
  [/\bAI\s+(\S+\s+)?odgovar\w*|odgovar\w* (na upite|na poruke|kupcima|pacijentima|klijentima|odmah)/i,
    '"AI odgovara" frames it as a chatbot (2026-11-05): say what it does to the sale ("vodi razgovor", "prodajni proces")'],
  [/\bu demou?\b/i, '"u demou" sounds weird (2026-11-05): the email already said what the demo is'],
  // 2026-11-05 (later): "u shouldnt direct it towards a specific example… i hate guessing business scenarios and
  // processes… not being accurate could result in them thinking 'this isnt relatable to me so i dont need it'"
  [/„[^“]{6,}“|šta radi kada|kako vodi (pitanje|razgovor)|pogledajte kako/i,
    'points the owner at a specific chat or scenario; describe what it does and the data, never a guessed case (2026-11-05)'],
  // "the model and basically 'script', which i dont want called that since… an 'automated', unhuman feel" (2026-11-05)
  [/skript|scenari/i, '"skripta/scenario" gives an automated, unhuman feel; say "prodajni proces" / "pristup" (2026-11-05)'],
  // 2026-11-05, on v18: "Please remove this I've been developing this for months… 'I'm looking for one good company'
  // that's a very weird thing to say… you took what I said too literally… Do not leave the scope of common sense."
  [/razvijam (ga |ovo )?mesecima|mesecima razvijam|tražim (jednu )?(dobru )?firmu/i,
    'backstory / "tražim jednu dobru firmu" reads weird and too literal (2026-11-05)'],
  [/zanemarite ovaj mejl/i, 'outro "slobodno zanemarite ovaj mejl" is weird (2026-11-05)'],
  // 2026-11-09: "'mozete besplatno da vidite..' kinda sounds like an ad… make the first line more friendly… spoken from
  // the heart". A benefit + "besplatno" + a call to action is how ads talk; a person says why he is writing.
  [/možete besplatno|besplatno (da )?(pogledate|vidite|isprobate)|pogledajte besplatno|najnovija primena AI/i,
    'ad register ("kinda sounds like an ad", 2026-11-09): say why you are writing, as a person'],
]

// A thing named before it is introduced (2026-11-02: "'demo for varmus'?? a demo of what? 'u demou za varmus..' come on
// man"). The subject must say what it is; the body must not open inside a demo the reader has never heard of.
export const DANGLING_RED_FLAGS = [
  [/^\s*demo( verzija)?( za)? [^:,]+$/i, 'subject: "Demo za X" says nothing about what the demo is of (2026-11-02)', 'subject'],
  [/^(u (ovom )?demou?|u demo verziji|demo je|ovaj demo)/i, 'line 1 opens inside a demo the reader has never heard of (2026-11-02)', 'first'],
  // "za varmus: ai koji.. this sounds automated. not the genuine angle i want at all" (2026-11-02): "{Firma}: {pitch}"
  // is what mail-merge tools produce. The subject reads as a person talking.
  [/^[^:]{2,40}:\s*\S/, 'subject "X: pitch" reads like a mail merge ("sounds automated", 2026-11-02)', 'subject'],
  // 2026-11-05: "Kako bi izgledala prodaja Varmusa…" reads as "how the SALE OF Varmus would look" (selling the
  // company, as in "prodaja Telekoma"). Their sales = "prodajni proces Varmusa" / "prodaja u Varmusu".
  [/\bprodaj[aeiu] [A-ZČĆŠŽĐ]/u, 'subject "prodaja {Firma}" reads as selling the company; say "prodajni proces {Firme}"', 'subject'],
]

// Length is a WARNING band set by Nikola's own reactions, never a target to cut to: 212 words (v7) was "wayyyy too long
// and way too personal" (2026-11-01); 125 (v10, v11) was "too simplistic… too fucking short… why did u do that for no
// reason?" (2026-11-02). The old hard 125 cap was my number, not his, and every draft after it was cut to fit and lost
// sense and voice. Links, the login line and the signature don't count.
export const MIN_WORDS = 140
export const MAX_WORDS = 190
export function bodyWords(body) {
  const core = body.replace(/^\s*Poštovani[^\n]*\n/i, '').split(/\n(Veliki pozdrav|Srdačan pozdrav|Pozdrav)/i)[0]
  return core.split('\n').filter(l => !/^\s*(\{|\(prijava|https?:)/.test(l)).join(' ').split(/\s+/).filter(Boolean).length
}

// The first words decide whether the rest is read: never the sender, never an observation about them.
export const OPENER_RED_FLAGS = [
  [/^(napravio sam|ja\b|želim|hteo bih|zovem se|moje ime)/i, 'opens about the sender'],
  [/^(ispod Vaših|primetio sam|primećujem|video sam|pratim)/i, 'opens with an observation, not the incentive'],
  // 2026-11-05: "I don't like this 'I did this', 'I made this' talk, it talks about me and I wanna talk about them"
  [/^za [^.,]{2,40} sam (napravio|pripremio)/i, 'line 1 "za X sam napravio…" talks about the sender; open with what they get'],
]

export const WARNINGS = [
  [/lozink|šifr/i, 'a password from a stranger reads as phishing (fix: one-click demo link)'],
  // 2026-11-02: a stranger who knows "the questions your customers ask you" reads as "he read my DMs"; say the source.
  [/pitanja koja (Vam )?kupci (zaista )?(Vam )?postavljaju(?! ispod)/i, 'a stranger knowing what customers ask you reads as "he read my DMs": say where it is from ("ispod Vaših objava")'],
]

// 2026-11-05: "you put it at the bottom so you gonna have to read through the entire email and pitch to get them
// interested… if you put it last and after this block of text it will seem like we're trying to… sell them something."
// The demo link comes as soon as the reasons not to click are gone; what is inside follows it.
export const MAX_WORDS_BEFORE_LINK = 130
export function wordsBeforeLink(body) {
  const at = body.search(/\{link\}|https?:\/\/app\./)
  return at < 0 ? null : bodyWords(body.slice(0, at))
}

export function redFlags({ subject = '', body = '' }) {
  const text = `${subject}\n${body}`
  const first = body.replace(/^\s*Poštovani[^\n]*\n+/i, '').trim()
  const beforeLink = wordsBeforeLink(body)
  return {
    flags: [
      ...COLD_EMAIL_RED_FLAGS.filter(([r]) => r.test(text)).map(([, l]) => l),
      ...OPENER_RED_FLAGS.filter(([r]) => r.test(subject.trim()) || r.test(first)).map(([, l]) => l),
      ...DANGLING_RED_FLAGS.filter(([r, , where]) => r.test(where === 'subject' ? subject.trim() : first)).map(([, l]) => l),
      ...(beforeLink !== null && beforeLink > MAX_WORDS_BEFORE_LINK
        ? [`demo link after ${beforeLink} words: it reads as a pitch first ("it will seem like we're trying to… sell them something", 2026-11-05)`] : []),
    ],
    warnings: [
      ...(bodyWords(body) > MAX_WORDS ? [`${bodyWords(body)} words: 212 was "wayyyy too long" (2026-11-01)`] : []),
      ...(bodyWords(body) < MIN_WORDS ? [`${bodyWords(body)} words: 125 was "too simplistic… too short" (2026-11-02)`] : []),
      // 2026-11-04: line 1 must say what this email IS (a demo built for them, and what it shows) before any claim:
      // "the first line is just too direct… you haven't explained the context". The context is never "ja sam Nikola"
      // ("why the FUCK would it be good to say 'im nikola gutesa' in the first line?"), which OPENER_RED_FLAGS catches.
      ...(!/\bdemo/i.test(first.split(/\n\s*\n/)[0] || '') ? ['line 1 does not say what this email is (the demo made for them)'] : []),
      // No person in the email = "sounds automated" (2026-11-02)
      ...(!/\b(sam|ja|vodim|radim|testiram|podešavam|napravio)\b/i.test(body) ? ['no person in it: reads automated'] : []),
      ...WARNINGS.filter(([r]) => r.test(text)).map(([, l]) => l),
      // 2026-11-01: "AI sistem" alone reads as something running behind Instagram; the owner must see where he looks
      ...(/\b(sistem|agent)/i.test(text) && !/aplikacij|ekran|platform|jednom mestu/i.test(text)
        ? ['names the product only as a system/agent: the owner cannot picture where he sees it'] : []),
    ],
  }
}
