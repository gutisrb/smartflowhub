"use client"

import type { CSSProperties } from "react"
import { Phone, Mail, CalendarClock, Plus } from "lucide-react"
import { salesModel } from "@/lib/onboarding/tour-slots"
import { offerCopy } from "@/lib/onboarding/offer-copy.mjs"
import s from "./offer-content.module.css"

const CAL_LINK = "https://cal.com/smartflow.rs/20min"
const PHONE = "+381 64 118 2200"
const MAIL = "nikola@smartflow.rs"

interface OfferContentProps {
  brandName: string
  brandColor?: string
  niche?: string | null
  /** Business Sheet flows: a store people visit, a shop that ships */
  flows?: { inStore?: boolean; orderTracking?: boolean; stays?: boolean } | null
  onPrimary?: () => void
}

/** Text colour that reads on the owner's brand colour: white or near-black, whichever has more contrast. */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return "#ffffff"
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]
  const lin = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
  // contrast with white = 1.05 / (L + 0.05); with near-black (L≈0.003) = (L + 0.05) / 0.053
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.053 ? "#ffffff" : "#0b0d0c"
}

/**
 * The close. One job: a booked 20-minute call.
 *
 * Rewritten 2026-10-26 from the buyer's side (it does not say the system configures itself from the website: Nikola builds the
 * sales process, CRM, analytics and marketing hook-up WITH each client). 2026-11-04: the email no longer carries the offer, so this
 * page is the whole offer and the close. 2026-11-10, three passes on Nikola's screenshots: dark-and-grey ("hard to read"), then a
 * white sheet ("too bright, pops out"), then this: the app's own dark surface tiers, text well above the old grey, ~175 visible
 * words, the owner's brand colour only on the call button and the "live" node. Blocks, each answering one question in order: what is
 * the offer, how does it go and what is on me, what is the catch, what decides it (price, lock-in), next step. "Šta dobijate" is gone
 * (the tour just showed it). Words: lib/onboarding/offer-copy.mjs (owner_read.mjs prints the same). Styles and tokens:
 * offer-content.module.css; contrast is checked by scripts/check_ponuda_contrast.mjs.
 *
 * Offer (2026-11-01): after the first month on their real messages they stay only if completely satisfied, otherwise every dinar
 * back. Said once, as confidence, never as a plain money-back guarantee or "besplatno i bez obaveza". No price on the page, no
 * hours-of-labour or cost-saving arithmetic (vault copywriting §2). No demand statistic: Nikola dropped it (2026-11-10).
 */
export function OfferContent({ brandName, brandColor = "#10b981", niche, flows, onPrimary }: OfferContentProps) {
  const brand = brandName || "Vaš brend"
  const d = new Date()
  const today = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}.`
  const c = offerCopy({ model: salesModel(niche), niche, flows })
  const you = c.effortYou.length > 1 ? `${c.effortYou.slice(0, -1).join(", ")} i ${c.effortYou[c.effortYou.length - 1]}` : c.effortYou[0]

  const cta = (
    <div className={s.cta}>
      <a href={CAL_LINK} target="_blank" rel="noreferrer" onClick={() => onPrimary?.()} className={s.btn}>
        <CalendarClock size={20} aria-hidden /> Zakažite razgovor od 20 minuta
      </a>
      <a href={`tel:${PHONE.replace(/\s/g, "")}`} className={s.tel}>
        <Phone size={16} aria-hidden /> ili pozovite {PHONE}
      </a>
      <a href={`mailto:${MAIL}?subject=${encodeURIComponent(`Da, krećemo (${brand})`)}`} className={s.tel}>
        <Mail size={16} aria-hidden /> ili odgovorite sa „da“
      </a>
    </div>
  )

  return (
    <article className={s.sheet} style={{ "--brand": brandColor, "--on-brand": readableOn(brandColor) } as CSSProperties}>
      <header>
        <p className={s.meta}>Ponuda za {brand}, {today}</p>
        <h2 className={s.title}>{c.headline}</h2>
        <p className={s.free}>{c.free}</p>
        <p className={s.lead}>{c.lead}</p>
        {cta}
      </header>

      <section className={s.block}>
        <h3 className={s.h3}>{c.stepsTitle}</h3>
        <ol className={s.steps}>
          {c.steps.map((st: { when: string; title: string; body: string; live?: boolean }) => (
            <li key={st.title} className={st.live ? `${s.step} ${s.live}` : s.step}>
              <span className={s.node} aria-hidden />
              <p className={s.when}>{st.when}</p>
              <p className={s.stepTitle}>{st.title}</p>
              <p className={s.stepBody}>{st.body}</p>
            </li>
          ))}
        </ol>
        <div className={s.split}>
          <p className={s.you}><strong>{c.effortLabel}:</strong> {you}.</p>
          <p className={s.me}>{c.effortMe}</p>
        </div>
      </section>

      <section className={s.band}>
        <p className={s.bandTitle}>{c.catchTitle}</p>
        <p className={s.bandBody}>{c.catchBody}</p>
      </section>

      <section className={s.block}>
        <h3 className={s.h3}>{c.faqTitle}</h3>
        <div className={s.faq}>
          {c.faq.map((f: { q: string; a: string }) => (
            <details key={f.q} className={s.qa}>
              <summary><span>{f.q}</span><Plus size={22} aria-hidden /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className={s.close}>
        <h3 className={s.closeTitle}>{c.closeTitle}</h3>
        <p className={s.closeLine}>{c.closeLine}</p>
        {cta}
        <p className={s.sign}>{c.closeSign}</p>
      </footer>
    </article>
  )
}
