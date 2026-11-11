import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { buildE1, missingSlots } from './e1-template.mjs'
import { redFlags, wordsBeforeLink } from './copy-red-flags.mjs'

const DIR = resolve(__dirname, '../sheets')
const withE1 = readdirSync(DIR).filter((f) => f.endsWith('.json'))
  .map((f) => ({ f, e: JSON.parse(readFileSync(resolve(DIR, f), 'utf8')).e1 }))
  .filter((x) => x.e)

describe('E1 template', () => {
  it('has at least the five hand-sheet leads', () => {
    expect(withE1.length).toBeGreaterThanOrEqual(5)
  })

  it('every e1 block is complete and builds with no red flag', () => {
    for (const { f, e } of withE1) {
      expect(missingSlots(e), f).toEqual([])
      const { subject, body } = buildE1(e)
      expect(redFlags({ subject, body }).flags, f).toEqual([])
      expect(body, f).toContain('{link}')
    }
  })

  it('subject is the owner\'s question; paragraph 2 answers it with the data', () => {
    for (const { f, e } of withE1) {
      const { subject, body } = buildE1(e)
      expect(subject, f).toMatch(/^Zašto neko .+, a neko ne$/)
      expect(body, f).toMatch(/iz svakog beleži šta je .+ tražio i, ako .+, zašto\./)
    }
  })

  // 2026-11-05: "u shouldnt direct it towards a specific example… i hate guessing business scenarios"
  it('points at no specific chat or scenario, and never at "AI odgovara"', () => {
    for (const { f, e } of withE1) {
      const { text } = buildE1(e)
      expect(text, f).not.toMatch(/„|šta radi kada|pogledajte kako/i)
      expect(text, f).not.toMatch(/AI\s+(\S+\s+)?odgovar/i)
    }
  })

  // "we will ALSO use this to continuously improve and track the selling and conversion rate… together"
  it('carries the data paragraph and the improvement loop chosen together', () => {
    for (const { f, e } of withE1) {
      const { body } = buildE1(e)
      expect(body, f).toMatch(/Kada se svi razgovori saberu/)
      expect(body, f).toMatch(/koliko razgovora se završi [\s\S]+ birali bismo zajedno/)
    }
  })

  // "you put it at the bottom… it will seem like we're trying to… sell them something" (2026-11-05)
  it('puts the demo link before what is inside', () => {
    for (const { f, e } of withE1) {
      const { body } = buildE1(e)
      expect(wordsBeforeLink(body), f).toBeLessThanOrEqual(130)
      expect(body.indexOf('{link}'), f).toBeLessThan(body.indexOf('AI prosleđuje Vama'))
      expect(body.indexOf('Hteo sam da prvo vidite'), f).toBeLessThan(body.indexOf('{link}'))
      // the demo ends on the Ponuda tab, so "before I propose anything" would be false (2026-11-09)
      expect(body, f).not.toMatch(/pre nego što Vam bilo šta predložim/)
    }
  })

  // "here's how the latest AI implementation for <their niche> would look like for VARMUS FOR FREE… I don't like this
  // 'I did this', 'I made this' talk" + "remove… developing this for months… 'I'm looking for one good company'" (2026-11-05)
  it('opens on what they get, never on the sender; no backstory, no odd outro', () => {
    for (const { f, e } of withE1) {
      const { body } = buildE1(e)
      const p1 = body.split('\n\n')[1]
      // v20 (2026-11-09): a person saying why he writes, never an ad ("mozete besplatno da vidite.. sounds like an ad")
      expect(p1, f).toMatch(/^javljam Vam se jer verujem da AI danas najviše može da pomogne .+, a to je lakše pokazati nego objasniti\. Zato sam Vam pripremio demo na Vašem primeru/)
      expect(p1, f).not.toMatch(/možete besplatno|najnovija primena/)
      expect(p1, f).not.toMatch(/napravio sam|sam napravio|sam pripremio/)
      expect(body, f).not.toMatch(/razvijam|tražim jednu|zanemarite|besplatno i bez obaveza|testir|studij\w* slučaja/i)
    }
  })
})

describe('red flags added 2026-11-05', () => {
  it('flag a demo link buried under the pitch', () => {
    const body = 'Poštovani,\n\n' + 'reč '.repeat(150) + '\n{link}\n'
    expect(redFlags({ subject: 'Zašto neko naruči kod Varmusa, a neko ne', body }).flags.join(' | ')).toMatch(/demo link after/)
  })

  it('flag the v15 lines Nikola rejected', () => {
    const v15 = redFlags({
      subject: 'Kako bi AI odgovarao kupcima Varmusa',
      body: 'Poštovani,\n\nU demou AI odgovara odmah, i noću i vikendom, zna svaki Vaš model.',
    }).flags.join(' | ')
    expect(v15).toMatch(/chatbot/)
    expect(v15).toMatch(/u demou/)
  })

  it('flag a subject that reads as selling the company', () => {
    const f = redFlags({ subject: 'Kako bi izgledala prodaja Varmusa uz veštačku inteligenciju', body: 'Poštovani,\n\nza Varmus sam pripremio demo.' }).flags
    expect(f.join(' | ')).toMatch(/selling the company/)
  })

  it('flag a guessed scenario and the word "skripta"', () => {
    const f = redFlags({
      subject: 'Zašto neko naruči kod Varmusa, a neko ne',
      body: 'Poštovani,\n\nza Varmus sam pripremio demo. Pogledajte kako vodi pitanje „Cena sa prevozom?“ i skriptu prodaje.',
    }).flags.join(' | ')
    expect(f).toMatch(/specific chat or scenario/)
    expect(f).toMatch(/skripta/)
  })
})
