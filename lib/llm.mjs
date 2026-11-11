// One LLM client for the whole pipeline: OpenAI-shaped (`client.chat.completions.create`), backed by Gemini.
//
// Nikola, 2026-11-10: "No top-up, Gemini only." OpenAI had run out of credits and every new demo build, Business Sheet extraction and
// objection analysis stalled with it. Every script used to build its own `new OpenAI(...)`; they now call `makeLlm()`, so the provider is
// chosen in ONE place and every answer says which model wrote it (`resp.provider`). No silent fallback: if Gemini fails, the caller sees the
// error and treats the step as failed, exactly as it did with OpenAI (extractSheet returns { failed }, never a made-up sheet).
//
// Only what the pipeline uses is translated: messages (system/user/assistant, text and image_url parts), temperature, max_tokens and
// response_format json_object. `model` in the call is ignored (it used to name a gpt model); set GEMINI_MODEL to change it.
const DEFAULT_MODEL = 'gemini-2.5-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

async function imagePart(url) {
  if (/^data:/.test(url)) { const m = url.match(/^data:([^;]+);base64,(.*)$/); return m ? { inline_data: { mime_type: m[1], data: m[2] } } : null }
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`image fetch ${r.status}: ${url}`)
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0]
  return { inline_data: { mime_type: mime, data: Buffer.from(await r.arrayBuffer()).toString('base64') } }
}

/** OpenAI chat messages -> Gemini { systemInstruction, contents }. */
export async function toGemini(messages) {
  const system = []
  const contents = []
  for (const m of messages || []) {
    const parts = []
    for (const p of Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content ?? '') }]) {
      if (p.type === 'text') parts.push({ text: p.text })
      else if (p.type === 'image_url') { const ip = await imagePart(p.image_url?.url || p.image_url); if (ip) parts.push(ip) }
    }
    if (m.role === 'system' || m.role === 'developer') system.push(...parts.filter((p) => p.text))
    else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts })
  }
  return { systemInstruction: system.length ? { parts: system } : undefined, contents }
}

export function makeLlm({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || DEFAULT_MODEL } = {}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (.env.local): the pipeline has no LLM')
  return {
    provider: `gemini:${model}`,
    chat: {
      completions: {
        async create(req) {
          const { systemInstruction, contents } = await toGemini(req.messages)
          const body = {
            ...(systemInstruction ? { systemInstruction } : {}),
            contents,
            generationConfig: {
              temperature: req.temperature ?? 0,
              ...(req.max_tokens || req.max_completion_tokens ? { maxOutputTokens: req.max_tokens || req.max_completion_tokens } : {}),
              ...(req.response_format?.type === 'json_object' || req.response_format?.type === 'json_schema' ? { responseMimeType: 'application/json' } : {}),
              thinkingConfig: { thinkingBudget: 0 }, // extraction and writing, not reasoning: no hidden tokens, deterministic JSON
            },
          }
          let lastErr
          for (let attempt = 0; attempt < 3; attempt++) {
            const r = await fetch(`${BASE}/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })
            const j = await r.json().catch(() => ({}))
            if (r.ok) {
              const cand = j.candidates?.[0]
              const text = (cand?.content?.parts || []).map((p) => p.text || '').join('')
              if (!text) throw new Error(`gemini returned no text (${cand?.finishReason || j.promptFeedback?.blockReason || 'unknown'})`)
              return { provider: `gemini:${model}`, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: cand.finishReason === 'MAX_TOKENS' ? 'length' : 'stop' }], usage: { prompt_tokens: j.usageMetadata?.promptTokenCount, completion_tokens: j.usageMetadata?.candidatesTokenCount } }
            }
            lastErr = new Error(`gemini ${r.status}: ${j.error?.message || 'request failed'}`)
            if (![429, 500, 503].includes(r.status)) break
            await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)))
          }
          throw lastErr
        },
      },
    },
  }
}
