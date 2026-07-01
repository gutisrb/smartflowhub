/**
 * gen_ponuda_image.mjs — generate the Ponuda (offer) hero via Kie.ai nano-banana-2.
 * Proven polling: GET /api/v1/jobs/recordInfo?taskId=, state field, resultJson.resultUrls[0].
 */
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

const JOBS = [
  {
    out: "../public/onboarding/ponuda-hero.jpg",
    prompt:
      "Premium dark product photograph, pure obsidian black studio background (#05080c). " +
      "A single sleek modern smartphone floats slightly tilted in the center, its screen glowing with a soft emerald-green light (#10b981). " +
      "From the phone, a luminous stream of small chat message bubbles flows upward and outward, each bubble softly glowing emerald and mint, dissolving into elegant particles of light. " +
      "Volumetric emerald light rays, soft atmospheric haze, subtle reflections on a glossy black floor. " +
      "Calm, luxurious, confident, high-end SaaS brand aesthetic. Deep blacks, controlled emerald glow, cinematic depth, photorealistic, ultra sharp, 4k. " +
      "No text, no words, no people, no faces, no logos.",
    aspect_ratio: "16:9",
  },
]

async function gen(job) {
  const create = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST", headers: H,
    body: JSON.stringify({ model: "nano-banana-2", input: { prompt: job.prompt, aspect_ratio: job.aspect_ratio, resolution: "2K", output_format: "jpg" } }),
  }).then((r) => r.json())
  const taskId = create?.data?.taskId
  if (!taskId) { console.error("no taskId", JSON.stringify(create)); return }
  console.log("taskId", taskId)
  for (let i = 0; i < 60; i++) {
    await sleep(5000)
    const info = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, { headers: H }).then((r) => r.json())
    const state = info?.data?.state
    process.stdout.write(`[${i}] ${state}\n`)
    if (state === "success") {
      const url = JSON.parse(info.data.resultJson).resultUrls[0]
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
      writeFileSync(resolve(__dirname, job.out), buf)
      console.log("saved", job.out, buf.length, "bytes")
      return
    }
    if (state === "fail" || state === "failed") { console.error("FAILED", JSON.stringify(info.data)); return }
  }
  console.error("timeout")
}

for (const j of JOBS) await gen(j)
