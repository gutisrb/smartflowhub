import { describe, it, expect } from 'vitest'
import { toGemini, makeLlm } from './llm.mjs'

describe('lib/llm (OpenAI-shaped, Gemini-backed)', () => {
  it('moves system messages to systemInstruction and maps assistant to model', async () => {
    const g = await toGemini([{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'Zdravo' }, { role: 'assistant', content: 'Dobar dan' }])
    expect((g.systemInstruction?.parts[0] as any).text).toBe('Be brief.')
    expect(g.contents.map((c: any) => c.role)).toEqual(['user', 'model'])
  })
  it('keeps text parts and inlines data: images', async () => {
    const g = await toGemini([{ role: 'user', content: [{ type: 'text', text: 'Šta je na slici?' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] }])
    expect(g.contents[0].parts[0]).toEqual({ text: 'Šta je na slici?' })
    expect(g.contents[0].parts[1]).toEqual({ inline_data: { mime_type: 'image/png', data: 'AAAA' } })
  })
  it('refuses to build a client without a key instead of falling back silently', () => {
    expect(() => makeLlm({ apiKey: '' })).toThrow(/GEMINI_API_KEY/)
  })
  it('names its provider so every answer says which model wrote it', () => {
    expect(makeLlm({ apiKey: 'x', model: 'gemini-2.5-flash' }).provider).toBe('gemini:gemini-2.5-flash')
  })
})
