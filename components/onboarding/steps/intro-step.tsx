"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ChannelStrip } from "@/components/onboarding/channel-strip"
import { isServiceNiche, isQuoteNiche } from "@/lib/onboarding/tour-slots"

interface IntroStepProps {
  brandColor?: string
  clientName?: string
  niche?: string | null
  /** cinematic still generated per tenant by generate_intro_art.mjs */
  artUrl?: string | null
  /** their real logo, scraped from their site — composited, never rendered by the model */
  logoUrl?: string | null
  /** a store people come into (Business Sheet): messages become visits, not orders */
  inStore?: boolean
  /** guests reserve dates (a hotel) */
  stays?: boolean
  onNext: () => void
}

/**
 * The first frame a lead ever sees of SmartFlow.
 *
 * The layout and the photograph are designed against each other deliberately.
 * An earlier version centred the type and laid a full-frame vertical scrim under
 * it — which put the headline directly on top of the one lit element in the shot
 * and crushed everything else to black. The picture was paying for the text.
 *
 * So the frame is split on a diagonal instead: type occupies the lower-left,
 * where the render is instructed to keep deep empty shadow, and the scrim is a
 * horizontal falloff that dies before mid-frame. The upper right — the lit screen
 * and the finished work stacked beside it — stays untouched at full brightness.
 * Reading order becomes headline → then right, into the payoff.
 */
export function IntroStep({ brandColor = "#10b981", clientName, niche, artUrl, logoUrl, inStore, stays, onNext }: IntroStepProps) {
  const reduce = useReducedMotion()
  // "Termini izlaze" to a perfumery is nonsense — the outcome noun has to follow
  // the business, here and everywhere else the line is repeated.
  const quote = isQuoteNiche(niche)
  const outcome = quote ? "postaju ponude." : stays ? "postaju rezervacije." : isServiceNiche(niche) ? "postaju termini." : inStore ? "postaju kupci u radnji." : "postaju porudžbine."

  return (
    <div className="fixed inset-0 z-[300] overflow-hidden" style={{ background: "#05080c" }}>
      {artUrl ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <img src={artUrl} alt="" className="w-full h-full object-cover object-right" />
        </motion.div>
      ) : (
        <>
          {/* No tenant-specific art yet: fall back to the shared backdrop rather than a flat dark screen. */}
          <img src="/onboarding/intro-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-right opacity-60" />
          <div
            className="absolute right-[18%] top-1/2 -translate-y-1/2 w-[42rem] h-[42rem] rounded-full blur-[170px]"
            style={{ background: `${brandColor}1c` }}
          />
        </>
      )}

      {/* Scrim: darkens the left column for type, then gets out of the way entirely. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(100deg, #05080c 0%, rgba(5,8,12,0.94) 26%, rgba(5,8,12,0.66) 44%, rgba(5,8,12,0.18) 62%, rgba(5,8,12,0) 76%)",
        }}
      />
      {/* a low vignette so the CTA never sits on a bright floor highlight */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(5,8,12,0) 0%, rgba(5,8,12,0.7) 100%)" }}
      />

      <div className="relative h-full flex items-center px-8 md:px-16 lg:px-24">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[34rem]"
        >
          {/* Their actual mark, composited. The image model was given the logo as a
              reference and produced a convincing crest that was not theirs — a
              counterfeit logo undoes the trust this whole frame is built to earn. */}
          {logoUrl && (
            <div className="mb-5 inline-flex items-center rounded-xl bg-white/95 px-3.5 py-2.5">
              <img src={logoUrl} alt={clientName || ""} className="h-7 md:h-8 w-auto object-contain" />
            </div>
          )}
          <div className="flex items-center gap-2.5 mb-5">
            <span className="h-px w-8" style={{ background: brandColor }} />
            <span className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: brandColor }}>
              {/* "za" + the business name needs a declension we can't do reliably; a separator can't be wrong */}
              Smartflow{clientName ? ` · ${clientName}` : ""}
            </span>
          </div>

          <h1 className="text-[38px] md:text-[58px] font-bold text-white font-outfit leading-[0.95] tracking-[-0.035em]">
            Vaše poruke<br />
            <span style={{ color: brandColor }}>{outcome}</span>
          </h1>

          <p className="text-[15px] md:text-[17px] text-[#dbe6e4] leading-relaxed mt-6 max-w-[30rem]">
            Instagram, Facebook, WhatsApp i sajt: sve poruke stižu na jedno mesto, a agent svaku vodi do
            {quote ? " ponude" : stays ? " rezervacije" : isServiceNiche(niche) ? " termina" : inStore ? " dolaska u radnju" : " porudžbine"}. Za dva minuta vidite kako to izgleda na Vašim{" "}
            {isServiceNiche(niche) && !quote ? "uslugama" : "proizvodima"} i cenama. Pravi sistem pravimo zajedno, po Vašem načinu rada.
          </p>

          {/* the hero art carries this as an abstract braid; this makes it undeniable */}
          <div className="mt-7">
            <ChannelStrip brandColor={brandColor} delay={0.9} />
          </div>

          <motion.button
            onClick={onNext}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="mt-8 inline-flex items-center gap-2 text-[15px] font-bold px-8 py-4 rounded-2xl text-[#05080c] transition-transform active:scale-[0.97] hover:scale-[1.02]"
            style={{ background: brandColor, boxShadow: `0 18px 50px -14px ${brandColor}` }}
          >
            Pokažite mi kako radi →
          </motion.button>

          <p className="text-[11px] text-[#8b9d9a] mt-4">Iz obilaska možete izaći bilo kada.</p>
        </motion.div>
      </div>
    </div>
  )
}
