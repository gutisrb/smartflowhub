// E1 body, built deterministically from the approved Crowndental email.
//
// Generating the body left paragraphs 2-5 free-form at temperature 0.85, so every run
// re-invented them and no two leads got the same argument. Only the opener was pinned,
// which is why openers matched and nothing else did. The approved text is now the template
// and the niche fills slots in it — same email, same quality, every lead.

const PROFILES = {
  // booking-led
  stomatologija: {
    customerPl: 'pacijenti', customerInst: 'pacijentima', customerDat: 'pacijentu',
    ownerNom: 'ordinacija', ownerDat: 'ordinaciji', ownerGen: 'ordinacije', ownerLoc: 'ordinaciji',
    ownerFem: true,
    offer: 'uslugama i cenama',
    record: 'termini koji ulaze u kalendar sa uslugom i cenom',
    escalation: 'pitanje koje traži lekara',
    convert: 'zakažu', convertNeg: 'ne zakažu',
  },
  klinika_wellness: {
    customerPl: 'pacijenti', customerInst: 'pacijentima', customerDat: 'pacijentu',
    ownerNom: 'klinika', ownerDat: 'klinici', ownerGen: 'klinike', ownerLoc: 'klinici',
    ownerFem: true,
    offer: 'uslugama i cenama',
    record: 'termini koji ulaze u kalendar sa uslugom i cenom',
    escalation: 'pitanje koje traži lekara',
    convert: 'zakažu', convertNeg: 'ne zakažu',
  },
  // order-led
  namestaj: {
    customerPl: 'kupci', customerInst: 'kupcima', customerDat: 'kupcu',
    ownerNom: 'salon', ownerDat: 'salonu', ownerGen: 'salona', ownerLoc: 'salonu',
    ownerFem: false,
    offer: 'proizvodima i cenama',
    record: 'porudžbine sa proizvodom i cenom',
    escalation: 'pitanje koje traži Vašu odluku',
    convert: 'kupe', convertNeg: 'ne kupe',
  },
  fashion: {
    customerPl: 'kupci', customerInst: 'kupcima', customerDat: 'kupcu',
    ownerNom: 'brend', ownerDat: 'brendu', ownerGen: 'brenda', ownerLoc: 'brendu',
    ownerFem: false,
    offer: 'proizvodima i cenama',
    record: 'porudžbine sa proizvodom i cenom',
    escalation: 'pitanje koje traži Vašu odluku',
    convert: 'kupe', convertNeg: 'ne kupe',
  },
  beauty: {
    customerPl: 'kupci', customerInst: 'kupcima', customerDat: 'kupcu',
    ownerNom: 'parfimerija', ownerDat: 'parfimeriji', ownerGen: 'parfimerije', ownerLoc: 'parfimeriji',
    ownerFem: true,
    offer: 'proizvodima i cenama',
    record: 'porudžbine sa proizvodom i cenom',
    escalation: 'pitanje koje traži Vašu odluku',
    convert: 'kupe', convertNeg: 'ne kupe',
  },
  fitnes: {
    customerPl: 'kupci', customerInst: 'kupcima', customerDat: 'kupcu',
    ownerNom: 'prodavnica', ownerDat: 'prodavnici', ownerGen: 'prodavnice', ownerLoc: 'prodavnici',
    ownerFem: true,
    offer: 'proizvodima i cenama',
    record: 'porudžbine sa proizvodom i cenom',
    escalation: 'pitanje koje traži Vašu odluku',
    convert: 'kupe', convertNeg: 'ne kupe',
  },
  // quote-led (custom work: an inquiry becomes an offer, not a basket)
  usluge: {
    customerPl: 'klijenti', customerInst: 'klijentima', customerDat: 'klijentu',
    ownerNom: 'firma', ownerDat: 'firmi', ownerGen: 'firme', ownerLoc: 'firmi',
    ownerFem: true,
    offer: 'uslugama i cenama',
    record: 'upiti zavedeni sa traženom uslugom i cenom',
    escalation: 'pitanje koje traži Vašu procenu',
    convert: 'zatraže ponudu', convertNeg: 'ne zatraže ponudu',
  },
};

const FALLBACK = PROFILES.usluge;
export const profileFor = (niche) => PROFILES[niche] || FALLBACK;

/**
 * The approved email, with the niche in its slots. Deterministic: same lead, same text.
 */
export function buildE1({ company, greeting, nicheNoun, bQualifier, niche }) {
  const p = profileFor(niche);
  const b = bQualifier ? `${nicheNoun} ${bQualifier}, ali čija` : `${nicheNoun} čija`;
  const owns = p.ownerFem ? 'sama' : 'sam';

  return `${greeting}

Radimo sa ${b} komercijalna strana još uvek ne koristi ono što veštačka inteligencija danas omogućava: jedinstven sistem koji vodi celokupnu prodaju i komunikaciju sa ${p.customerInst} i od svakog razgovora pravi podatak koji ${p.ownerDat} trajno ostaje.

Sistem ne odgovara samo na pitanja. Vodi razgovor prema ${p.offer} ${p.ownerGen}, prepoznaje kada ${p.customerDat} ponuda ne odgovara i predlaže alternativu umesto da pusti razgovor da se ugasi. Razume fotografije i snimke koje ${p.customerPl} šalju, kao i odgovore na priče. Zna i granicu sopstvene nadležnosti: ${p.escalation} ne dira, nego ga označava i prosleđuje, a razgovor u svakom trenutku može da preuzme čovek. Takav nivo se ne sklapa za petnaest minuta u gotovom rešenju; iza njega stoje meseci podešavanja.

Sve što se u tim razgovorima desi ostaje ${p.ownerDat}: baza ${p.customerPl === 'pacijenti' ? 'pacijenata' : p.customerPl === 'kupci' ? 'kupaca' : 'klijenata'} koja se sama popunjava, ${p.record}, i jasna slika sopstvenog tržišta — šta se najviše traži, šta ${p.customerPl} pitaju pre nego što ${p.convert} i zbog čega neki ${p.convertNeg}. To je znanje koje se do sada gubilo u prepisci.

Sistem je Meta-verifikovan za Instagram, Facebook i WhatsApp i ne zaustavlja se na porukama. Jednom postavljen, pokriva i svaki drugi proces u ${p.ownerLoc}, a obim određuje ${owns} ${p.ownerNom}.

Za ${company} je već podešen sa Vašim ${p.offer}, pa se može videti kako radi umesto da se opisuje. Podaci za pristup su na dnu ovog mejla.

Ako ima smisla da ga prođemo zajedno, termin je ovde: https://cal.com/smartflow.rs/20min

Srdačan pozdrav,

Nikola Guteša
Smartflow | smartflow.rs | +381 64 118 2200`;
}
