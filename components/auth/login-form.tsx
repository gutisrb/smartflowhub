"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"
import { Lock, Mail, ArrowRight, MessageCircle, BarChart3, Zap } from "lucide-react"

interface LoginFormProps {
    onLoginSuccess: () => void
}

const TEAL = "#0dd6ca"
const TEAL_DIM = "rgba(13,214,202,0.12)"
const TEAL_BORDER = "rgba(13,214,202,0.20)"

const features = [
    {
        icon: MessageCircle,
        label: "AI Agent odgovara kupcima 24/7",
        desc: "Instagram, Facebook, web — sve na jednom mestu",
    },
    {
        icon: BarChart3,
        label: "CRM koji se sam popunjava",
        desc: "Svaki razgovor automatski postaje kontakt u bazi",
    },
    {
        icon: Zap,
        label: "Analitika u realnom vremenu",
        desc: "Pratite konverzije, trendove i razgovore uživo",
    },
]

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError("Pogrešan email ili lozinka.")
            setLoading(false)
        } else {
            onLoginSuccess()
        }
    }

    return (
        <div className="flex h-screen bg-[#0c1015] overflow-hidden">

            {/* ══ LEFT: Login panel ══ */}
            <div className="relative flex flex-col items-center justify-center w-full md:w-[44%] px-8 shrink-0">

                {/* Ambient glow */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full"
                        style={{ background: "radial-gradient(circle, rgba(13,214,202,0.055) 0%, transparent 65%)" }} />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 22, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 w-full max-w-[340px]"
                >
                    {/* Logo + label */}
                    <div className="mb-8 flex flex-col items-start gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="https://res.cloudinary.com/dyarnpqaq/image/upload/v1773751432/SmartflowNovi_bz9fvr.png"
                            alt="SmartFlow"
                            className="w-11 h-11 object-contain rounded-xl"
                        />
                        <div>
                            <p className="text-white text-[15px] font-semibold tracking-tight leading-none">
                                Vaš dashboard
                            </p>
                            <p className="text-zinc-500 text-[11px] mt-1 font-mono uppercase tracking-[0.2em]">
                                smartflow
                            </p>
                        </div>
                    </div>

                    {/* Card */}
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                        {/* Teal top accent */}
                        <div className="h-[2px] w-full"
                            style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 40%, ${TEAL} 60%, transparent)` }} />

                        <div className="px-6 pt-6 pb-7">
                            <form onSubmit={handleLogin} className="space-y-3">

                                {/* Email */}
                                <div className="relative group">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 transition-colors duration-200 group-focus-within:text-[#0dd6ca]" />
                                    <input
                                        type="email"
                                        placeholder="email adresa"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm font-outfit placeholder:text-zinc-600 outline-none transition-all duration-200 focus:border-[#0dd6ca]/35 focus:bg-white/[0.07]"
                                    />
                                </div>

                                {/* Password */}
                                <div className="relative group">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 transition-colors duration-200 group-focus-within:text-[#0dd6ca]" />
                                    <input
                                        type="password"
                                        placeholder="lozinka"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm font-outfit placeholder:text-zinc-600 outline-none transition-all duration-200 focus:border-[#0dd6ca]/35 focus:bg-white/[0.07]"
                                    />
                                </div>

                                {/* Error */}
                                {error && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-outfit"
                                    >
                                        {error}
                                    </motion.p>
                                )}

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group relative w-full h-11 rounded-xl font-bold text-sm font-outfit overflow-hidden transition-all duration-200 disabled:opacity-60 mt-1"
                                    style={{ background: `linear-gradient(135deg, ${TEAL}, #0ba8a0)` }}
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2 text-[#0c1015]">
                                        {loading ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-[#0c1015]/25 border-t-[#0c1015] rounded-full animate-spin" />
                                                <span>Prijavljivanje...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Prijavite se</span>
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-150" />
                                            </>
                                        )}
                                    </span>
                                    {/* Shimmer on hover */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                        style={{ background: "linear-gradient(135deg, #14e8dc, #0dd6ca)" }} />
                                </button>
                            </form>
                        </div>
                    </div>

                    <p className="mt-5 text-center text-[11px] text-zinc-600 font-mono tracking-wide">
                        © {new Date().getFullYear()} SmartFlow · Beograd
                    </p>
                </motion.div>
            </div>

            {/* ══ Vertical divider ══ */}
            <div className="hidden md:block w-px shrink-0"
                style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent)", margin: "3rem 0" }} />

            {/* ══ RIGHT: Brand panel ══ */}
            <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="hidden md:flex flex-col items-start justify-center flex-1 relative overflow-hidden px-14 lg:px-20"
            >
                {/* Atmosphere */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-40 -right-20 w-[650px] h-[650px] rounded-full"
                        style={{ background: "radial-gradient(circle, rgba(13,214,202,0.07) 0%, transparent 60%)" }} />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full"
                        style={{ background: "radial-gradient(circle, rgba(11,168,160,0.05) 0%, transparent 65%)" }} />
                    {/* Grid */}
                    <div className="absolute inset-0 opacity-[0.022]"
                        style={{
                            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                            backgroundSize: "52px 52px",
                        }} />
                </div>

                <div className="relative z-10 max-w-[420px]">

                    {/* Big logo */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="https://res.cloudinary.com/dyarnpqaq/image/upload/v1773751432/SmartflowNovi_bz9fvr.png"
                        alt="SmartFlow"
                        className="w-[88px] h-[88px] object-contain mb-8 rounded-2xl"
                    />

                    {/* Headline */}
                    <h1 className="text-[2.6rem] font-bold text-white leading-[1.15] tracking-tight mb-5">
                        Prodajte više.<br />
                        <span style={{ color: TEAL }}>Radite manje.</span>
                    </h1>

                    <p className="text-zinc-400 text-[15px] leading-relaxed mb-10 max-w-[360px]">
                        SmartFlow automatizuje komunikaciju s kupcima, prati prodaju i generiše izveštaje — za sve vaše brendove odjednom.
                    </p>

                    {/* Features */}
                    <div className="space-y-5">
                        {features.map(({ icon: Icon, label, desc }) => (
                            <div key={label} className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                                    style={{ background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}` }}>
                                    <Icon className="w-[17px] h-[17px]" style={{ color: TEAL }} />
                                </div>
                                <div className="pt-0.5">
                                    <p className="text-white text-sm font-medium leading-snug">{label}</p>
                                    <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
