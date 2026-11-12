import { describe, it, expect } from 'vitest'
import { cut, scrub, stripLone } from './text-safe.mjs'

describe('text-safe', () => {
  it('cuts by code point, never inside an emoji (SLW caption)', () => {
    const s = 'a'.repeat(139) + '🚚 više'
    expect(cut(s, 140)).toBe('a'.repeat(139) + '🚚')
    expect(s.slice(0, 140)).not.toBe(cut(s, 140)) // the naive slice leaves a lone surrogate
  })
  it('scrubs lone surrogates anywhere in a row', () => {
    const half = '🚚'.slice(0, 1)
    expect(stripLone('x' + half)).toBe('x')
    expect(scrub({ a: ['ok' + half], b: { c: half + 'y' } })).toEqual({ a: ['ok'], b: { c: 'y' } })
  })
})
