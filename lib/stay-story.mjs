// Demo stories for a business whose customers reserve DATES, not a time slot (a hotel or a spa
// resort). Hotel Radan's site says "Unesite datume i rezervišite svoj boravak"; its demo used to
// offer "slobodan termin danas u 15h" for a stay and quote an invented "5.000 RSD". Here the agent
// asks for dates and guests, points to the business's own reservation step, and never names a
// price the site does not list.

const ASK_TEAM = 'To potvrđuje naš tim. Prosleđujem pitanje, pa ćete dobiti tačan odgovor.'
const stop = (s) => (/[.!?…]$/.test(s) ? s : `${s}.`)

/** How the business itself says a stay is reserved, made into the agent's line. */
function reserveLine(sheet) {
  const q = String(sheet?.booking?.quote || '')
  return /unesite\s+datum/i.test(q) ? 'Rezervaciju završavate na sajtu: unesete datume i rezervišete boravak.' : 'Rezervaciju za te datume potvrđuje naš tim.'
}

export function stayStory({ sheet }) {
  const reserve = reserveLine(sheet)
  const msgs = [
    ['user', 'Zdravo, da li imate slobodno za dve osobe od petka do nedelje?'],
    ['assistant', 'Zdravo, Marija 😊 Za te datume ima slobodnih mesta.'],
    ['user', 'Koliko bi to koštalo?'],
    ['assistant', `Cena zavisi od smeštaja i paketa koji izaberete. ${reserve}`],
    ['user', 'Važi, rezervisaću danas.'],
    ['assistant', 'Važi. Pošaljite mi ime i broj telefona, pa upisujem upit za te datume, da Vam niko ne uzme mesto do tada.'],
    ['user', 'Marija Jović, 064 123 4567'],
    ['assistant', 'Hvala, Marija. Upit je upisan. Kad završite rezervaciju na sajtu, vidimo se od petka 😊'],
  ]
  return {
    channel: 'whatsapp', customer: 'Marija Jović', phone: '064 123 4567', msgs,
    crm: { full_name: 'Marija Jović', telefon: '064 123 4567', kategorija: 'Boravak', proizvod: 'Vikend za dve osobe', status: 'Zakazano', razlog: 'Pitala za slobodna mesta za vikend; rezervacija za dve osobe.', izvor: 'WhatsApp' },
    appt: null,
  }
}

export function stayHesitation({ sheet }) {
  const msgs = [
    ['user', 'Zdravo, koliko košta noćenje?'],
    ['assistant', `Zdravo, Nikola 😊 Cena zavisi od smeštaja i datuma. ${reserveLine(sheet)}`],
    ['user', 'Hvala, javiću se.'],
    ['assistant', 'Važi. Kada odaberete datume, pišite mi i proveravam šta je slobodno.'],
  ]
  return {
    channel: 'instagram', customer: 'Nikola Perić', phone: '063 555 1212', msgs,
    crm: { full_name: 'Nikola Perić', telefon: '063 555 1212', kategorija: 'Boravak', proizvod: 'Noćenje', status: 'Zainteresovan', razlog: 'Pitao za cenu noćenja i otišao uz „Hvala, javiću se.“ Agent je ponudio da proveri slobodna mesta i čeka odgovor.', izvor: 'Instagram' },
    appt: null,
  }
}

export function stayQA({ sheet, terms }) {
  const t = terms || {}
  return [
    ['Da li imate slobodno za vikend?', 'Proveravam. Za koliko osoba i od kog datuma?'],
    ['Kako da rezervišem?', reserveLine(sheet)],
    ['Da li je doručak uključen?', t.included?.length ? `U cenu je uključeno: ${t.included.slice(0, 4).join(', ')}.` : ASK_TEAM],
    ['Kako može da se plati?', t.payment_methods ? stop(t.payment_methods) : ASK_TEAM],
    ['Može li otkazivanje rezervacije?', /otkaz/i.test(JSON.stringify(sheet || {})) ? 'Rezervaciju možete da promenite ili otkažete na sajtu.' : ASK_TEAM],
    ['Imate li slobodno za četiri osobe sledećeg meseca?', 'Proveravam raspoloživost. Koji datumi Vam odgovaraju?'],
  ]
}

export function bgStayConvos({ sheet, terms }) {
  const qa = stayQA({ sheet, terms })
  const names = ['Ana Kovačević', 'Petar Nikolić', 'Jovana Ilić', 'Marko Savić', 'Tamara Đorđević', 'Luka Pavlović', 'Milica Jovanović', 'Nemanja Ristić', 'Sara Marković', 'Filip Stojanović', 'Katarina Lukić', 'Stefan Petrović']
  const ch = ['instagram', 'whatsapp', 'facebook', 'website', 'instagram', 'whatsapp', 'instagram', 'website', 'whatsapp', 'facebook', 'instagram', 'website']
  const st = ['Zainteresovan', 'Zakazano', 'Novi', 'Zakazano', 'Zainteresovan', 'Zakazano', 'Završeno', 'Zainteresovan', 'Zakazano', 'Novi', 'Zainteresovan', 'Zakazano']
  return names.map((name, i) => {
    const [q, a] = qa[i % qa.length]
    const msgs = [['user', q], ['assistant', a]]
    if (st[i] === 'Zakazano') msgs.push(['user', 'Rezervisao sam za 12–14.'], ['assistant', 'Super, vidimo se 12. 😊'])
    if (st[i] === 'Završeno') msgs.push(['user', 'Hvala na divnom boravku!'], ['assistant', 'Hvala Vama, dođite opet 🙏'])
    if (st[i] === 'Zainteresovan') msgs.push(['user', 'Razmisliću.'], ['assistant', 'Važi. Kada odaberete datume, pišite mi.'])
    return { name, ch: ch[i], st: st[i], msgs }
  })
}
