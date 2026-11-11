import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

const DIR = resolve(__dirname, '../sheets')
const sheets = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ f, d: JSON.parse(readFileSync(resolve(DIR, f), 'utf8')) }))

describe('hand sheets', () => {
  it('carry no first tour card: step 1 is the same card on every demo', () => {
    // a hand-written, situation-specific card was rejected three times (2026-10-27)
    for (const { f, d } of sheets) expect(d.hero?.tour, f).toBeUndefined()
  })

  it('every hand-written chat alternates sensibly and ends on the agent', () => {
    for (const { f, d } of sheets) {
      const msgs = d.hero?.msgs
      if (!msgs) continue
      expect(msgs[0][0], f).toBe('user')
      expect(msgs[msgs.length - 1][0], f).toBe('assistant')
    }
  })
})
