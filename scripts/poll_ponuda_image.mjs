/** Resume polling an existing Kie taskId, retrying on transient network errors. */
import { readFileSync, writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n")) {
  const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim()
}
const KEY = process.env.KIE_API_KEY
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const taskId = process.argv[2]
const out = process.argv[3] || "../public/onboarding/ponuda-hero.jpg"

async function safeFetch(url, opts, tries = 5) {
  for (let t = 0; t < tries; t++) {
    try { return await fetch(url, opts) }
    catch (e) { console.log("retry fetch", t, e.cause?.code || e.message); await sleep(4000) }
  }
  throw new Error("fetch failed after retries")
}

for (let i = 0; i < 80; i++) {
  await sleep(5000)
  let info
  try {
    info = await (await safeFetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, { headers: H })).json()
  } catch (e) { console.log("poll err", e.message); continue }
  const state = info?.data?.state
  console.log(`[${i}] ${state}`)
  if (state === "success") {
    const url = JSON.parse(info.data.resultJson).resultUrls[0]
    const buf = Buffer.from(await (await safeFetch(url, {})).arrayBuffer())
    writeFileSync(resolve(__dirname, out), buf)
    console.log("saved", out, buf.length, "bytes")
    break
  }
  if (state === "fail" || state === "failed") { console.error("FAILED", JSON.stringify(info.data)); break }
}
