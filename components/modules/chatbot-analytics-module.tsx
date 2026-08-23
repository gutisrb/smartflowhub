"use client"

import { useState, useEffect, useCallback } from "react"
import { format, subDays, startOfDay } from "date-fns"
import { motion, type Variants } from "framer-motion"
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
    CartesianGrid,
} from "recharts"
import { TrendingUp, MessageSquare, Users, Zap, Activity, BookOpen, Tag, ShoppingBag, Sparkles, } from "lucide-react"
import { getBookStoreConfig, BookStoreConfig, BOOK_STORE_CLIENTS } from "@/lib/brand-configs"
import { getCrmHarmonijaByClientId, getCrmPublikByClientId, getCrmStelaByClientId, getCrmAleksandarMNByClientId, getCrmMagunaByClientId } from "@/lib/supabase/queries"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { getDemoShift, shiftRows, shiftRowsDays } from "@/lib/demo/time-shift"

interface ChatbotAnalyticsModuleProps {
    clientId: string
    selectedBrandIds?: string[]   // Multi-brand: merge analytics from all selected brands
    demoNiche?: string | null     // When set, render demo analytics from demo_crm table
}

// ── Animation variants ─────────────────────────────────────────────────────────
const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
}
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 28 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function PremiumTooltip({ active, payload, label, unit = "" }: any) {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: "linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, padding: "10px 16px",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6), 0 0 20px -5px rgba(16,185,129,0.15)",
        }}>
            {label && <p style={{ color: "#71717a", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>}
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: "#10b981", fontSize: 14, fontWeight: 700 }}>
                    {p.value} <span style={{ color: "#52525b", fontSize: 11, fontWeight: 400 }}>{unit || p.name}</span>
                </p>
            ))}
        </div>
    )
}

// ── Circular progress ring ─────────────────────────────────────────────────────
function RingProgress({ value, max, color, size = 80 }: { value: number; max: number; color: string; size?: number }) {
    const r = (size - 10) / 2
    const circ = 2 * Math.PI * r
    const pct = max > 0 ? value / max : 0
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
                style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dashoffset 1s ease" }} />
        </svg>
    )
}

function Scanline() {
    return (
        <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none z-10">
            <div className="animate-scanline absolute left-0 right-0 h-[2px] opacity-[0.04]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.8), transparent)", top: 0 }} />
        </div>
    )
}

// ── Glass card shell ───────────────────────────────────────────────────────────
function Panel({ children, className = "", accent = false }: { children: React.ReactNode; className?: string; accent?: boolean }) {
    return (
        <div className={`rounded-2xl overflow-hidden relative grain-overlay ${className}`} style={{
            background: accent
                ? "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(6,182,212,0.04))"
                : "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))",
            border: accent ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.4)",
            padding: "20px",
        }}>
            <Scanline />
            {children}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
//  BOOKSTORE ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

// ── Brand-specific analytics mock data ───────────────────────────────────────
// Each brand gets a distinct dataset reflecting their actual catalog and audience.
// Harmonija: psychology/wellness/self-help non-fiction, adults 25-45
// Publik:    children's books / educational, customers are parents
// Stela:     adult fiction, romance, thriller — mostly women 20-40
const d = (n: number) => subDays(new Date(), n).toISOString()

const MOCK_CRM_DATA_BY_CLIENT: Record<string, any[]> = {
    // ── Harmonija Knjige ──────────────────────────────────────────────────────
    "255db627-c62b-44ce-a9dc-3a7e90dd1b67": [
        { tema: "Psihologija",   knjiga: "Mit o normalnom",            autor: "Gabor Mate",           status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(0)  },
        { tema: "Self-help",     knjiga: "Atomske navike",              autor: "James Clear",          status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(0)  },
        { tema: "Psihologija",   knjiga: "Čovekova potraga za smislom", autor: "Viktor Frankl",        status: "Zainteresovan", razlog: "Pitao za cenu",  izvor: "Instagram", created_at: d(1)  },
        { tema: "Wellness",      knjiga: null,                          autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(1)  },
        { tema: "Roditeljstvo",  knjiga: "Budite oslonac svojoj deci",  autor: "Gabor Mate",           status: "Zainteresovan", razlog: "Nije odgovorio", izvor: "Instagram", created_at: d(1)  },
        { tema: "Self-help",     knjiga: "Moć navike",                  autor: "Charles Duhigg",       status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(2)  },
        { tema: "Psihologija",   knjiga: "Telo pamti",                  autor: "Bessel van der Kolk",  status: "Poručio",       razlog: null,             izvor: "Website",   created_at: d(2)  },
        { tema: "Ishrana",       knjiga: null,                          autor: null,                   status: "Novi",          razlog: null,             izvor: "Instagram", created_at: d(3)  },
        { tema: "Nauka o mozgu", knjiga: "You, Happier",                autor: "Daniel Amen",          status: "Zainteresovan", razlog: "Čeka isporuku",  izvor: "Facebook",  created_at: d(3)  },
        { tema: "Psihologija",   knjiga: "Mit o normalnom",             autor: "Gabor Mate",           status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(4)  },
        { tema: "Wellness",      knjiga: "Snaga sadašnjeg trenutka",    autor: "Eckhart Tolle",        status: "Zainteresovan", razlog: "Pitao za cenu",  izvor: "Instagram", created_at: d(4)  },
        { tema: "Self-help",     knjiga: "Atomske navike",              autor: "James Clear",          status: "Zainteresovan", razlog: "Nije odgovorio", izvor: "Instagram", created_at: d(5)  },
        { tema: "Roditeljstvo",  knjiga: null,                          autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(5)  },
        { tema: "Psihologija",   knjiga: "Telo pamti",                  autor: "Bessel van der Kolk",  status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(6)  },
        { tema: "Ishrana",       knjiga: "Homemade by Mila",            autor: "Mila Vujisić",         status: "Poručio",       razlog: null,             izvor: "Website",   created_at: d(6)  },
        { tema: "Psihologija",   knjiga: "Čovekova potraga za smislom", autor: "Viktor Frankl",        status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(7)  },
        { tema: "Nauka o mozgu", knjiga: "You, Happier",                autor: "Daniel Amen",          status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(7)  },
        { tema: "Wellness",      knjiga: null,                          autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(8)  },
        { tema: "Self-help",     knjiga: "Moć navike",                  autor: "Charles Duhigg",       status: "Zainteresovan", razlog: "Premislio se",   izvor: "Instagram", created_at: d(8)  },
        { tema: "Ishrana",       knjiga: "Narodni travar",              autor: "M. Antonijević",       status: "Zainteresovan", razlog: "Pitao za cenu",  izvor: "Instagram", created_at: d(9)  },
        { tema: "Psihologija",   knjiga: "Mit o normalnom",             autor: "Gabor Mate",           status: "Intervencija",  razlog: null,             izvor: "Instagram", created_at: d(9)  },
        { tema: "Roditeljstvo",  knjiga: "Budite oslonac svojoj deci",  autor: "Gabor Mate",           status: "Poručio",       razlog: null,             izvor: "Facebook",  created_at: d(10) },
        { tema: "Wellness",      knjiga: null,                          autor: null,                   status: "Novi",          razlog: null,             izvor: "Instagram", created_at: d(10) },
        { tema: "Self-help",     knjiga: "Moć navike",                  autor: "Charles Duhigg",       status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(11) },
        { tema: "Psihologija",   knjiga: "Telo pamti",                  autor: "Bessel van der Kolk",  status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(11) },
        { tema: "Ishrana",       knjiga: "Homemade by Mila",            autor: "Mila Vujisić",         status: "Poručio",       razlog: null,             izvor: "Website",   created_at: d(12) },
        { tema: "Nauka o mozgu", knjiga: null,                          autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(12) },
        { tema: "Psihologija",   knjiga: "Čovekova potraga za smislom", autor: "Viktor Frankl",        status: "Zainteresovan", razlog: "Čeka isporuku",  izvor: "Instagram", created_at: d(13) },
        { tema: "Roditeljstvo",  knjiga: "Budite oslonac svojoj deci",  autor: "Gabor Mate",           status: "Zainteresovan", razlog: "Nije odgovorio", izvor: "Instagram", created_at: d(13) },
        { tema: "Self-help",     knjiga: "Atomske navike",              autor: "James Clear",          status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(13) },
    ],
    // ── Publik Praktikum ─────────────────────────────────────────────────────
    "bd12eb98-e62a-4a87-b620-a9881081449b": [
        { tema: "Slikovnice",    knjiga: "Mali svet slika: Farma",     autor: "AUZOU",                status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(0)  },
        { tema: "Bojanka",       knjiga: "Piši-briši: Dinozauri",      autor: "SASSI",                status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(0)  },
        { tema: "Za uzrast 5-8", knjiga: null,                         autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(1)  },
        { tema: "Interaktivne",  knjiga: "Priča sa iskakalicama",      autor: "AUZOU",                status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(1)  },
        { tema: "Enciklopedija", knjiga: "Dinozauri: Velika knjiga",   autor: "SASSI",                status: "Zainteresovan", razlog: "Pitao za cenu",  izvor: "Instagram", created_at: d(2)  },
        { tema: "Bojanka",       knjiga: "Piši-briši: Farma",          autor: "AUZOU",                status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(2)  },
        { tema: "Slikovnice",    knjiga: "Mali svet slika: Okeani",    autor: "AUZOU",                status: "Poručio",       razlog: null,             izvor: "Website",   created_at: d(3)  },
        { tema: "Za uzrast 3-6", knjiga: null,                         autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(3)  },
        { tema: "Priča",         knjiga: "Čarobna slagalica",          autor: "SASSI",                status: "Zainteresovan", razlog: "Čeka isporuku",  izvor: "Instagram", created_at: d(4)  },
        { tema: "Bojanka",       knjiga: "Piši-briši: Dinozauri",      autor: "SASSI",                status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(4)  },
        { tema: "Enciklopedija", knjiga: "Dinozauri: Velika knjiga",   autor: "SASSI",                status: "Zainteresovan", razlog: "Pitao za cenu",  izvor: "Instagram", created_at: d(5)  },
        { tema: "Interaktivne",  knjiga: null,                         autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(5)  },
        { tema: "Slikovnice",    knjiga: "Mali svet slika: Farma",     autor: "AUZOU",                status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(6)  },
        { tema: "Za uzrast 7-10",knjiga: "Moje prve puzle: Životinje", autor: "SASSI",                status: "Poručio",       razlog: null,             izvor: "Website",   created_at: d(6)  },
        { tema: "Bojanka",       knjiga: "Piši-briši: Životinje",      autor: "AUZOU",                status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(7)  },
        { tema: "Priča",         knjiga: "Čarobna slagalica",          autor: "SASSI",                status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(7)  },
        { tema: "Za uzrast 3-6", knjiga: null,                         autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(8)  },
        { tema: "Slikovnice",    knjiga: "Mali svet slika: Okeani",    autor: "AUZOU",                status: "Zainteresovan", razlog: "Premislio se",   izvor: "Instagram", created_at: d(8)  },
        { tema: "Enciklopedija", knjiga: "Dinozauri: Velika knjiga",   autor: "SASSI",                status: "Zainteresovan", razlog: "Pitao za cenu",  izvor: "Instagram", created_at: d(9)  },
        { tema: "Interaktivne",  knjiga: "Priča sa iskakalicama",      autor: "AUZOU",                status: "Intervencija",  razlog: null,             izvor: "Instagram", created_at: d(9)  },
        { tema: "Bojanka",       knjiga: "Piši-briši: Farma",          autor: "AUZOU",                status: "Poručio",       razlog: null,             izvor: "Facebook",  created_at: d(10) },
        { tema: "Za uzrast 5-8", knjiga: null,                         autor: null,                   status: "Novi",          razlog: null,             izvor: "Instagram", created_at: d(10) },
        { tema: "Enciklopedija", knjiga: "Moje prve puzle: Životinje", autor: "SASSI",                status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(11) },
        { tema: "Bojanka",       knjiga: "Piši-briši: Dinozauri",      autor: "SASSI",                status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(11) },
        { tema: "Slikovnice",    knjiga: "Mali svet slika: Farma",     autor: "AUZOU",                status: "Poručio",       razlog: null,             izvor: "Website",   created_at: d(12) },
        { tema: "Priča",         knjiga: null,                         autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(12) },
        { tema: "Interaktivne",  knjiga: "Priča sa iskakalicama",      autor: "AUZOU",                status: "Zainteresovan", razlog: "Čeka isporuku",  izvor: "Instagram", created_at: d(13) },
        { tema: "Za uzrast 7-10",knjiga: null,                         autor: null,                   status: "Zainteresovan", razlog: "Nije odgovorio", izvor: "Instagram", created_at: d(13) },
        { tema: "Bojanka",       knjiga: "Piši-briši: Farma",          autor: "AUZOU",                status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(13) },
    ],
    // ── Stela Knjige ─────────────────────────────────────────────────────────
    "d7337d00-db70-46c3-828b-e9ac82e21717": [
        { tema: "Romantika",         knjiga: "Twisted Love",           autor: "Ana Huang",            status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(0)  },
        { tema: "Kriminalistički",   knjiga: "Tihe vode",              autor: "Angela Marsons",       status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(0)  },
        { tema: "Savremena proza",   knjiga: null,                     autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(1)  },
        { tema: "Romantika",         knjiga: "November 9",             autor: "Colleen Hoover",       status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(1)  },
        { tema: "Triler",            knjiga: "Opake igre",             autor: "Ana Huang",            status: "Zainteresovan", razlog: "Pitao za cenu",  izvor: "Instagram", created_at: d(2)  },
        { tema: "Romantika",         knjiga: "Twisted Love",           autor: "Ana Huang",            status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(2)  },
        { tema: "Saga",              knjiga: "Ptičica na trnju",       autor: "Colleen McCullough",   status: "Poručio",       razlog: null,             izvor: "Website",   created_at: d(3)  },
        { tema: "Triler",            knjiga: null,                     autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(3)  },
        { tema: "Kriminalistički",   knjiga: "Tihe vode",              autor: "Angela Marsons",       status: "Zainteresovan", razlog: "Čeka isporuku",  izvor: "Instagram", created_at: d(4)  },
        { tema: "Romantika",         knjiga: "Ugly Love",              autor: "Colleen Hoover",       status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(4)  },
        { tema: "Triler",            knjiga: "Opake igre",             autor: "Ana Huang",            status: "Zainteresovan", razlog: "Pitao za cenu",  izvor: "Instagram", created_at: d(5)  },
        { tema: "Saga",              knjiga: null,                     autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(5)  },
        { tema: "Romantika",         knjiga: "November 9",             autor: "Colleen Hoover",       status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(6)  },
        { tema: "Kriminalistički",   knjiga: "Vikend",                 autor: "Angela Marsons",       status: "Poručio",       razlog: null,             izvor: "Website",   created_at: d(6)  },
        { tema: "Romantika",         knjiga: "Twisted Love",           autor: "Ana Huang",            status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(7)  },
        { tema: "Savremena proza",   knjiga: "Ptičica na trnju",       autor: "Colleen McCullough",   status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(7)  },
        { tema: "Triler",            knjiga: null,                     autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(8)  },
        { tema: "Romantika",         knjiga: "Ugly Love",              autor: "Colleen Hoover",       status: "Zainteresovan", razlog: "Premislio se",   izvor: "Instagram", created_at: d(8)  },
        { tema: "Kriminalistički",   knjiga: "Tihe vode",              autor: "Angela Marsons",       status: "Zainteresovan", razlog: "Pitao za cenu",  izvor: "Instagram", created_at: d(9)  },
        { tema: "Romantika",         knjiga: "November 9",             autor: "Colleen Hoover",       status: "Intervencija",  razlog: null,             izvor: "Instagram", created_at: d(9)  },
        { tema: "Saga",              knjiga: "Ptičica na trnju",       autor: "Colleen McCullough",   status: "Poručio",       razlog: null,             izvor: "Facebook",  created_at: d(10) },
        { tema: "Triler",            knjiga: null,                     autor: null,                   status: "Novi",          razlog: null,             izvor: "Instagram", created_at: d(10) },
        { tema: "Romantika",         knjiga: "Twisted Love",           autor: "Ana Huang",            status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(11) },
        { tema: "Kriminalistički",   knjiga: "Vikend",                 autor: "Angela Marsons",       status: "Zainteresovan", razlog: "Nema na stanju", izvor: "Instagram", created_at: d(11) },
        { tema: "Savremena proza",   knjiga: null,                     autor: null,                   status: "Novi",          razlog: null,             izvor: "Facebook",  created_at: d(12) },
        { tema: "Romantika",         knjiga: "Ugly Love",              autor: "Colleen Hoover",       status: "Poručio",       razlog: null,             izvor: "Website",   created_at: d(12) },
        { tema: "Triler",            knjiga: "Opake igre",             autor: "Ana Huang",            status: "Zainteresovan", razlog: "Čeka isporuku",  izvor: "Instagram", created_at: d(13) },
        { tema: "Kriminalistički",   knjiga: null,                     autor: null,                   status: "Zainteresovan", razlog: "Nije odgovorio", izvor: "Instagram", created_at: d(13) },
        { tema: "Romantika",         knjiga: "November 9",             autor: "Colleen Hoover",       status: "Poručio",       razlog: null,             izvor: "Instagram", created_at: d(13) },
    ],
    // ── Aleksandar MN (zdravstveni_cilj → tema, proizvod → knjiga) ────────────
    "3255f279-801c-474b-9c16-a75edc336296": [
        { knjiga: "iMMUNITA + D3 vitamin 2000",         autor: "AMN",       status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(0)  },
        { knjiga: "Joint MD Revolution, 30 tab",        autor: "AMN",       status: "Zainteresovan", razlog: "Pitao za cenu",                izvor: "Instagram", created_at: d(0)  },
        { knjiga: "Super Collagen Beauty, 60 tab",      autor: "AMN",       status: "Poručio",       razlog: null,                          izvor: "Facebook",  created_at: d(1)  },
        { knjiga: null,                                 autor: null,        status: "Novi",          razlog: null,                          izvor: "Instagram", created_at: d(1)  },
        { knjiga: "Joint MD Extra Strength, 50 tab",    autor: "AMN",       status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(1)  },
        { knjiga: "Marnys Liposomalni VIT-C 1000",      autor: "Marnys",    status: "Zainteresovan", razlog: "Nema na stanju",               izvor: "Instagram", created_at: d(2)  },
        { knjiga: "CERAMIDE Restorative Serum 30ml",    autor: "AMN",       status: "Poručio",       razlog: null,                          izvor: "Facebook",  created_at: d(2)  },
        { knjiga: null,                                 autor: null,        status: "Novi",          razlog: null,                          izvor: "Website",   created_at: d(2)  },
        { knjiga: "Cognitiva Super nutrijent za mozak", autor: "Cognitiva", status: "Zainteresovan", razlog: "Pitao za cenu",                izvor: "Instagram", created_at: d(3)  },
        { knjiga: "Joint MD Revolution, 30 tab",        autor: "AMN",       status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(3)  },
        { knjiga: "iMMUNITA + D3 vitamin 2000",         autor: "AMN",       status: "Zainteresovan", razlog: "Nije odgovorio",               izvor: "Facebook",  created_at: d(4)  },
        { knjiga: "Marnys Liposomalni Magnezijum 375",  autor: "Marnys",    status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(4)  },
        { knjiga: "Cimsulin + D3 vitamin",              autor: "AMN",       status: "Intervencija",  razlog: "Medicinski upit – eskalacija", izvor: "Facebook",  created_at: d(4)  },
        { knjiga: "Super Collagen + C, 60 tab",         autor: "AMN",       status: "Zainteresovan", razlog: "Čeka isporuku",                izvor: "Instagram", created_at: d(5)  },
        { knjiga: null,                                 autor: null,        status: "Novi",          razlog: null,                          izvor: "Instagram", created_at: d(5)  },
        { knjiga: "Serrap MD Forte 120000 SPU",         autor: "Serrap MD", status: "Zainteresovan", razlog: "Pitao za cenu",                izvor: "Instagram", created_at: d(6)  },
        { knjiga: "iMMUNITA + D3 vitamin 2000",         autor: "AMN",       status: "Poručio",       razlog: null,                          izvor: "Website",   created_at: d(6)  },
        { knjiga: "Cognitiva Super nutrijent za mozak", autor: "Cognitiva", status: "Zainteresovan", razlog: "Premislio se",                 izvor: "Instagram", created_at: d(7)  },
        { knjiga: "Super Collagen Beauty, 60 tab",      autor: "AMN",       status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(7)  },
        { knjiga: null,                                 autor: null,        status: "Novi",          razlog: null,                          izvor: "Facebook",  created_at: d(8)  },
        { knjiga: "Joint MD Extra Strength, 50 tab",    autor: "AMN",       status: "Zainteresovan", razlog: "Nema na stanju",               izvor: "Instagram", created_at: d(8)  },
        { knjiga: "MVS set za ravna stopala",           autor: "MVS",       status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(9)  },
        { knjiga: null,                                 autor: null,        status: "Novi",          razlog: null,                          izvor: "Website",   created_at: d(9)  },
        { knjiga: "Marnys Liposomalni VIT-C 1000",      autor: "Marnys",    status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(10) },
        { knjiga: "Joint MD Revolution, 30 tab",        autor: "AMN",       status: "Zainteresovan", razlog: "Nije odgovorio",               izvor: "Facebook",  created_at: d(10) },
        { knjiga: null,                                 autor: null,        status: "Intervencija",  razlog: "Medicinski upit – eskalacija", izvor: "Instagram", created_at: d(11) },
        { knjiga: "Marnys Liposomalni Magnezijum 375",  autor: "Marnys",    status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(11) },
        { knjiga: "iMMUNITA + D3 vitamin 2000",         autor: "AMN",       status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(12) },
        { knjiga: "CERAMIDE Restorative Serum 30ml",    autor: "AMN",       status: "Zainteresovan", razlog: "Pitao za cenu",                izvor: "Facebook",  created_at: d(12) },
        { knjiga: null,                                 autor: null,        status: "Novi",          razlog: null,                          izvor: "Instagram", created_at: d(13) },
        { knjiga: "Serrap MD Forte 120000 SPU",         autor: "Serrap MD", status: "Poručio",       razlog: null,                          izvor: "Instagram", created_at: d(13) },
        { knjiga: "iMMUNITA + D3 vitamin 2000",         autor: "AMN",       status: "Zainteresovan", razlog: "Čeka isporuku",                izvor: "Website",   created_at: d(13) },
    ],
    // ── Maguna Dizajn (zdravstveni_cilj → kategorija/tema, proizvod → knjiga) ──
    "0c25e7c2-360c-418a-816a-34444d304698": [
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi sto kutija BELI 70×70",       status: "Poručio",       razlog: null,              izvor: "Instagram", created_at: d(0)  },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi radni sto BELI 100×60",       status: "Zainteresovan", razlog: "Pitao za cenu",   izvor: "Instagram", created_at: d(0)  },
        { tema: "Šminkanje",           knjiga: "Stočić za šminkanje sa ogledalom",     status: "Poručio",       razlog: null,              izvor: "Facebook",  created_at: d(1)  },
        { tema: "Sklopivi stolovi",    knjiga: null,                                   status: "Novi",          razlog: null,              izvor: "Instagram", created_at: d(1)  },
        { tema: "Dečiji nameštaj",     knjiga: "Sklopivi dečiji sto i stolica SET",    status: "Poručio",       razlog: null,              izvor: "Instagram", created_at: d(1)  },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi sto kutija BELI 70×70",       status: "Zainteresovan", razlog: "Nema na stanju",  izvor: "Instagram", created_at: d(2)  },
        { tema: "Dečiji nameštaj",     knjiga: "Dečiji sto sa policama BEO",           status: "Poručio",       razlog: null,              izvor: "Facebook",  created_at: d(2)  },
        { tema: "Sklopivi stolovi",    knjiga: null,                                   status: "Novi",          razlog: null,              izvor: "Website",   created_at: d(2)  },
        { tema: "Šminkanje",           knjiga: "Stočić za šminkanje LUKSUZ roza",      status: "Zainteresovan", razlog: "Pitao za cenu",   izvor: "Instagram", created_at: d(3)  },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi radni sto sa policom 120×60", status: "Poručio",       razlog: null,              izvor: "Instagram", created_at: d(3)  },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi sto kutija BELI 70×70",       status: "Zainteresovan", razlog: "Nije odgovorio",  izvor: "Facebook",  created_at: d(4)  },
        { tema: "Dečiji nameštaj",     knjiga: "Sklopivi dečiji sto i stolica SET",    status: "Poručio",       razlog: null,              izvor: "Instagram", created_at: d(4)  },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi radni sto BELI 100×60",       status: "Intervencija",  razlog: null,              izvor: "Facebook",  created_at: d(4)  },
        { tema: "Šminkanje",           knjiga: null,                                   status: "Novi",          razlog: null,              izvor: "Instagram", created_at: d(5)  },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi sto za laptop 60×40",         status: "Zainteresovan", razlog: "Pitao za cenu",   izvor: "Instagram", created_at: d(5)  },
        { tema: "Dečiji nameštaj",     knjiga: "Dečiji sto sa policama BEO",           status: "Zainteresovan", razlog: "Nema na stanju",  izvor: "Instagram", created_at: d(6)  },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi sto kutija BELI 70×70",       status: "Poručio",       razlog: null,              izvor: "Website",   created_at: d(6)  },
        { tema: "Šminkanje",           knjiga: "Stočić za šminkanje sa ogledalom",     status: "Poručio",       razlog: null,              izvor: "Instagram", created_at: d(7)  },
        { tema: "Sklopivi stolovi",    knjiga: null,                                   status: "Novi",          razlog: null,              izvor: "Facebook",  created_at: d(7)  },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi radni sto sa policom 120×60", status: "Zainteresovan", razlog: "Premislio se",    izvor: "Instagram", created_at: d(8)  },
        { tema: "Dečiji nameštaj",     knjiga: "Sklopivi dečiji sto i stolica SET",    status: "Zainteresovan", razlog: "Pitao za cenu",   izvor: "Instagram", created_at: d(8)  },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi radni sto BELI 100×60",       status: "Poručio",       razlog: null,              izvor: "Instagram", created_at: d(9)  },
        { tema: "Šminkanje",           knjiga: "Stočić za šminkanje LUKSUZ roza",      status: "Poručio",       razlog: null,              izvor: "Facebook",  created_at: d(9)  },
        { tema: "Sklopivi stolovi",    knjiga: null,                                   status: "Novi",          razlog: null,              izvor: "Website",   created_at: d(10) },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi sto za laptop 60×40",         status: "Poručio",       razlog: null,              izvor: "Instagram", created_at: d(10) },
        { tema: "Dečiji nameštaj",     knjiga: null,                                   status: "Novi",          razlog: null,              izvor: "Facebook",  created_at: d(11) },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi sto kutija BELI 70×70",       status: "Zainteresovan", razlog: "Nema na stanju",  izvor: "Instagram", created_at: d(11) },
        { tema: "Šminkanje",           knjiga: "Stočić za šminkanje sa ogledalom",     status: "Zainteresovan", razlog: "Pitao za cenu",   izvor: "Instagram", created_at: d(12) },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi radni sto BELI 100×60",       status: "Poručio",       razlog: null,              izvor: "Instagram", created_at: d(12) },
        { tema: "Dečiji nameštaj",     knjiga: "Dečiji sto sa policama BEO",           status: "Zainteresovan", razlog: "Čeka isporuku",   izvor: "Website",   created_at: d(13) },
        { tema: "Sklopivi stolovi",    knjiga: "Sklopivi radni sto sa policom 120×60", status: "Poručio",       razlog: null,              izvor: "Instagram", created_at: d(13) },
    ],
}

function deriveBookstoreMetrics(rows: any[], days = 14) {
    const today = startOfDay(new Date())

    // N-day daily trend
    const dailyMap: Record<string, number> = {}
    for (let i = days - 1; i >= 0; i--) {
        dailyMap[format(subDays(today, i), "d.M")] = 0
    }
    rows.forEach(r => {
        const key = format(new Date(r.created_at), "d.M")
        if (key in dailyMap) dailyMap[key] = (dailyMap[key] || 0) + 1
    })
    const dailyData = Object.entries(dailyMap).map(([day, count]) => ({ day, count }))

    // Funnel — Novi → Zainteresovan → Poručio
    const total = rows.length
    const zainteresovano = rows.filter(r => ['zainteresovan', 'poručio'].includes(r.status?.toLowerCase())).length
    const narucilo = rows.filter(r => r.status?.toLowerCase() === 'poručio').length
    const intervencije = rows.filter(r => r.status?.toLowerCase() === 'intervencija').length
    const nijeNarucilo = rows.filter(r => r.status?.toLowerCase() === 'novi').length

    // Conversion rate = poručio / total
    const conversionRate = total > 0 ? Math.round((narucilo / total) * 100) : 0

    // Top teme (all conversations)
    const temaCount: Record<string, number> = {}
    rows.forEach(r => { if (r.tema) temaCount[r.tema] = (temaCount[r.tema] || 0) + 1 })
    const topTeme = Object.entries(temaCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([name, count]) => ({ name, count }))

    // Top knjige (rows with specific book title)
    const knjigaCount: Record<string, { count: number; autor: string | null }> = {}
    rows.forEach(r => {
        if (r.knjiga) {
            if (!knjigaCount[r.knjiga]) knjigaCount[r.knjiga] = { count: 0, autor: r.autor ?? null }
            knjigaCount[r.knjiga].count++
        }
    })
    const topKnjige = Object.entries(knjigaCount)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5)
        .map(([name, { count, autor }]) => ({ name, count, autor }))

    // Top autori (across all rows that have an autor field)
    const autorCount: Record<string, number> = {}
    rows.forEach(r => { if (r.autor) autorCount[r.autor] = (autorCount[r.autor] || 0) + 1 })
    const topAutori = Object.entries(autorCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))

    // Conversation conclusions — why the conversation ended without ordering
    // razlog field: "Nema na stanju", "Pitao za cenu", "Nije odgovorio", etc.
    const razlogCount: Record<string, number> = {}
    rows.filter(r => r.razlog).forEach(r => {
        razlogCount[r.razlog] = (razlogCount[r.razlog] || 0) + 1
    })
    const topDropoff = Object.entries(razlogCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))

    // Channels
    const kanalCount: Record<string, number> = {}
    rows.forEach(r => {
        const ch = (r.izvor || 'Chatbot').toLowerCase()
        const label = ch.includes('instagram') ? 'Instagram'
            : ch.includes('facebook') ? 'Facebook'
            : ch.includes('website') || ch.includes('sajt') ? 'Website'
            : 'Chatbot'
        kanalCount[label] = (kanalCount[label] || 0) + 1
    })
    const CHANNEL_COLORS: Record<string, string> = {
        Instagram: "#ec4899",
        Facebook: "#3b82f6",
        Website: "#8b5cf6",
        Chatbot: "#10b981",
    }
    const channels = Object.entries(kanalCount).map(([name, value]) => ({
        name, value, color: CHANNEL_COLORS[name] ?? "#52525b"
    })).sort((a, b) => b.value - a.value)

    return { dailyData, total, zainteresovano, narucilo, nijeNarucilo, intervencije, conversionRate, topTeme, topKnjige, topAutori, topDropoff, channels }
}

// Medal emoji for top 3 book/author rankings
const MEDALS = ["🥇", "🥈", "🥉"]
const TEMA_COLORS = ["#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ec4899", "#f97316"]

type AnalyticsPeriod = 'today' | '7d' | '30d'
const ANALYTICS_PERIODS: { key: AnalyticsPeriod; label: string; days: number }[] = [
    { key: 'today', label: 'Danas',  days: 1  },
    { key: '7d',    label: '7 dana', days: 7  },
    { key: '30d',   label: 'Mesec',  days: 30 },
]

function BookstoreAnalytics({ clientId, config, selectedBrandIds }: { clientId: string; config: BookStoreConfig; selectedBrandIds?: string[] }) {
    const [rows, setRows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<AnalyticsPeriod>('30d')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const brandIds = selectedBrandIds && selectedBrandIds.length > 1 ? selectedBrandIds : [clientId]
            const allRows: any[] = []
            for (const bid of brandIds) {
                const cfg = BOOK_STORE_CLIENTS[bid]
                if (!cfg) continue
                let data: any[] = []
                if (cfg.crmTable === 'crm_harmonija') data = await getCrmHarmonijaByClientId(bid) as any[]
                else if (cfg.crmTable === 'crm_publik') data = await getCrmPublikByClientId(bid) as any[]
                else if (cfg.crmTable === 'crm_stela') data = await getCrmStelaByClientId(bid) as any[]
                else if (cfg.crmTable === 'crm_aleksandarmn') data = await getCrmAleksandarMNByClientId(bid) as any[]
                else if (cfg.crmTable === 'crm_maguna') data = await getCrmMagunaByClientId(bid) as any[]
                // Normalize product CRM field names to match deriveBookstoreMetrics expectations
                if (cfg.crmTable === 'crm_aleksandarmn' || cfg.crmTable === 'crm_maguna') {
                    data = data.map(r => ({ ...r, tema: r.zdravstveni_cilj, knjiga: r.proizvod }))
                }
                if (data && data.length > 0) {
                    allRows.push(...data.map(r => ({ ...r, brandId: bid })))
                } else {
                    allRows.push(...(MOCK_CRM_DATA_BY_CLIENT[bid] ?? []).map(r => ({ ...r, brandId: bid })))
                }
            }
            setRows(allRows)
        } catch {
            const brandIds = selectedBrandIds && selectedBrandIds.length > 1 ? selectedBrandIds : [clientId]
            setRows(brandIds.flatMap(bid => (MOCK_CRM_DATA_BY_CLIENT[bid] ?? []).map(r => ({ ...r, brandId: bid }))))
        }
        setLoading(false)
    }, [clientId, config.crmTable, selectedBrandIds])

    useEffect(() => { load() }, [load])

    const activePeriod = ANALYTICS_PERIODS.find(p => p.key === period)!
    const periodCutoff = period === 'today'
        ? startOfDay(new Date())
        : subDays(new Date(), activePeriod.days)
    const filteredRows = rows.filter(r => new Date(r.created_at) >= periodCutoff)

    const m = deriveBookstoreMetrics(filteredRows, activePeriod.days)
    const totalChannels = m.channels.reduce((s, c) => s + c.value, 0)
    const maxKnjiga = m.topKnjige[0]?.count || 1
    const maxAutor  = m.topAutori[0]?.count || 1

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-emerald/30 border-t-emerald rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 pb-16">
            {/* ── Header ── */}
            <motion.div variants={fadeUp} className="flex items-end justify-between px-1">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                            <span className="bg-clip-text text-transparent"
                                style={{ backgroundImage: `linear-gradient(to right, ${config.color}, ${config.color}99)` }}>
                                Analitika
                            </span>
                        </h2>
                        <div className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-1"
                            style={{ background: `${config.color}15`, border: `1px solid ${config.color}30`, color: config.color }}>
                            {selectedBrandIds && selectedBrandIds.length > 1 ? `${selectedBrandIds.length} brenda` : config.brandName}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs font-light" style={{ color: "#52525b" }}>
                            Šta kupci traže · gde odustaju · ko prodaje
                        </p>
                        <span style={{ color: "#3f3f46" }} className="text-xs">·</span>
                        <span className="text-[10px] font-mono" style={{ color: "#3f3f46" }}>{config.instagramHandle}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{ background: `${config.color}0d`, border: `1px solid ${config.color}30` }}>
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: config.color }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: config.color }}>Live</span>
                    </div>
                    {/* Period toggle */}
                    <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        {ANALYTICS_PERIODS.map(p => (
                            <button
                                key={p.key}
                                onClick={() => setPeriod(p.key)}
                                className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200"
                                style={period === p.key
                                    ? { background: `${config.color}20`, color: config.color, border: `1px solid ${config.color}30` }
                                    : { color: "#52525b", border: "1px solid transparent" }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* ── Stat cards ── */}
            <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Ukupno razgovora", value: m.total,          icon: MessageSquare, accent: false, sub: "poslednjih 14 dana" },
                    { label: "Poručilo",         value: m.narucilo,       icon: ShoppingBag,   accent: true,  sub: "narudžbina potvrđena" },
                    { label: "Konverzija",        value: `${m.conversionRate}%`, icon: TrendingUp,    accent: false, sub: "razgovor → narudžbina" },
                    { label: "Intervencije",     value: m.intervencije,   icon: Activity,      accent: false, sub: "čeka odgovor" },
                ].map(({ label, value, icon: Icon, accent, sub }) => (
                    <Panel key={label} accent={accent}>
                        <div className="flex items-start justify-between mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#52525b" }}>{label}</p>
                            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                                style={{ background: accent ? `${config.color}20` : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                                <Icon size={13} style={{ color: accent ? config.color : "#52525b" }} />
                            </div>
                        </div>
                        <p className="text-4xl font-black leading-none text-white">{value}</p>
                        {sub && <p className="text-[10px] mt-2" style={{ color: "#3f3f46" }}>{sub}</p>}
                    </Panel>
                ))}
            </motion.div>

            {/* ── Trend + Channels ── */}
            <div className="grid grid-cols-12 gap-4">
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8">
                    <Panel>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Aktivnost</p>
                                <p className="text-base font-semibold text-white">Razgovori po danu — {activePeriod.label.toLowerCase()}</p>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={150}>
                            <AreaChart data={m.dailyData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="bsGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%"   stopColor={config.color} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={config.color} stopOpacity={0}    />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="day" tick={{ fill: "#3f3f46", fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "#3f3f46", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<PremiumTooltip unit="razgovora" />} />
                                <Area type="monotone" dataKey="count" stroke={config.color} strokeWidth={2}
                                    fill="url(#bsGrad)" dot={false}
                                    style={{ filter: `drop-shadow(0 2px 8px ${config.color}60)` }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Panel>
                </motion.div>

                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-4">
                    <Panel className="flex flex-col h-full">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Kanali</p>
                        <p className="text-base font-semibold text-white mb-4">Odakle dolaze kupci</p>
                        <div className="flex justify-center">
                            <div className="relative">
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                    <p className="text-2xl font-black text-white leading-none">{m.total}</p>
                                    <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: "#52525b" }}>ukupno</p>
                                </div>
                                <ResponsiveContainer width={130} height={130}>
                                    <PieChart>
                                        <Pie data={m.channels} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                                            dataKey="value" strokeWidth={0} paddingAngle={3}>
                                            {m.channels.map((c, i) => (
                                                <Cell key={i} fill={c.color} style={{ filter: `drop-shadow(0 0 6px ${c.color}50)` }} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2.5">
                            {m.channels.map((c, i) => (
                                <div key={i} className="flex items-center gap-2.5">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                                    <span className="text-xs flex-1 font-medium" style={{ color: "#a1a1aa" }}>{c.name}</span>
                                    <div className="w-16 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                                        <div className="h-full rounded-full" style={{ background: c.color, width: `${totalChannels > 0 ? Math.round(c.value / totalChannels * 100) : 0}%` }} />
                                    </div>
                                    <span className="text-xs font-bold w-5 text-right text-white">{c.value}</span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </motion.div>
            </div>

            {/* ── Conversion funnel + Drop-off ── */}
            <div className="grid grid-cols-12 gap-4">
                {/* Funnel: Razgovarali → Poručili */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-7">
                    <Panel>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Konverzija</p>
                        <p className="text-base font-semibold text-white mb-6">Put do narudžbine</p>
                        <div className="grid grid-cols-3 gap-4 md:gap-6">
                            {[
                                { label: "Razgovarali",    count: m.total,          pct: 100,                                                                    color: "#10b981" },
                                { label: "Zainteresovani", count: m.zainteresovano, pct: m.total > 0 ? Math.round(m.zainteresovano / m.total * 100) : 0,         color: "#f59e0b" },
                                { label: "Naručili",       count: m.narucilo,       pct: m.conversionRate,                                                       color: "#06b6d4" },
                            ].map((s, i) => (
                                <div key={i} className="relative flex flex-col gap-3">
                                    <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }}
                                            transition={{ duration: 1.2, delay: 0.2 + i * 0.2, ease: "easeOut" }}
                                            className="absolute top-0 left-0 h-full rounded-full"
                                            style={{ background: s.color, boxShadow: `0 0 8px ${s.color}60` }} />
                                    </div>
                                    <div>
                                        <p className="text-[2.5rem] font-black leading-none" style={{ color: s.color, textShadow: `0 0 20px ${s.color}60` }}>{s.count}</p>
                                        <p className="text-xs font-medium text-white/60 mt-1">{s.label}</p>
                                        <p className="text-[10px] font-bold mt-0.5" style={{ color: s.color }}>{s.pct}%</p>
                                    </div>
                                    {i < 2 && (
                                        <div className="absolute -right-4 top-5 pointer-events-none">
                                            <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                                                <path d="M1 1l6 6-6 6" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round"/>
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 px-4 py-3 rounded-xl flex items-center gap-4"
                            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
                            <p className="text-3xl font-black text-white">{m.conversionRate}<span className="text-sm font-medium text-zinc-500">%</span></p>
                            <div className="h-8 w-px bg-white/5" />
                            <div>
                                <p className="text-xs leading-snug text-zinc-500">od svih razgovora završilo narudžbinom</p>
                                <p className="text-[10px] mt-0.5" style={{ color: "#3f3f46" }}>{m.nijeNarucilo} kupaca je otišlo bez narudžbine</p>
                            </div>
                        </div>
                    </Panel>
                </motion.div>

                {/* Drop-off: topics where people stopped without ordering */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-5">
                    <Panel className="h-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                                <Zap size={13} style={{ color: "#ef4444" }} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#52525b" }}>Gde razgovor staje</p>
                                <p className="text-sm font-semibold text-white">Kako razgovor završava</p>
                            </div>
                        </div>
                        <p className="text-[10px] mb-4 leading-snug" style={{ color: "#52525b" }}>
                            Zašto kupci ne završe narudžbinu — gde agent ili zalihe zakazuju.
                        </p>
                        <div className="space-y-2.5">
                            {m.topDropoff.length === 0 ? (
                                <p className="text-xs italic" style={{ color: "#3f3f46" }}>Nema podataka</p>
                            ) : m.topDropoff.map((t, i) => {
                                const max = m.topDropoff[0].count
                                const pct = Math.round((t.count / max) * 100)
                                return (
                                    <div key={t.name} className="flex items-center gap-3">
                                        <span className="text-xs font-medium w-24 shrink-0 truncate" style={{ color: "#a1a1aa" }}>{t.name}</span>
                                        <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.9, delay: 0.3 + i * 0.07, ease: "easeOut" }}
                                                className="h-full rounded-full"
                                                style={{ background: "rgba(239,68,68,0.5)" }} />
                                        </div>
                                        <span className="text-xs font-bold w-5 text-right shrink-0" style={{ color: "#ef4444" }}>{t.count}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </Panel>
                </motion.div>
            </div>

            {/* ── Teme (pill grid) + Autori ── */}
            <div className="grid grid-cols-12 gap-4">
                {/* Top teme — hidden for product clients (AMN), shown for book clients */}
                {config.tableType !== 'proizvodi' && (
                    <motion.div variants={fadeUp} className="col-span-12 lg:col-span-6">
                        <Panel>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                                    <Tag size={13} style={{ color: "#f59e0b" }} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#52525b" }}>Kategorije</p>
                                    <p className="text-sm font-semibold text-white">Najpopularnije teme</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                                {m.topTeme.map((t, i) => {
                                    const color = TEMA_COLORS[i] ?? "#52525b"
                                    const pct = m.total > 0 ? Math.round((t.count / m.total) * 100) : 0
                                    return (
                                        <div key={t.name} className="relative rounded-xl px-3 py-2.5 overflow-hidden"
                                            style={{
                                                background: `linear-gradient(135deg,${color}14,${color}06)`,
                                                border: `1px solid ${color}28`,
                                            }}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-semibold truncate pr-2" style={{ color: "#e4e4e7" }}>{t.name}</span>
                                                <span className="text-xs font-black shrink-0" style={{ color }}>{t.count}</span>
                                            </div>
                                            <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 1, delay: 0.3 + i * 0.06, ease: "easeOut" }}
                                                    className="h-full rounded-full" style={{ background: color }} />
                                            </div>
                                            <p className="text-[9px] mt-1 font-bold" style={{ color: `${color}90` }}>{pct}% razgovora</p>
                                        </div>
                                    )
                                })}
                            </div>
                            <p className="text-[10px] mt-4 leading-snug" style={{ color: "#3f3f46" }}>
                                Korisno za planiranje zaliha i odabir naslova za promotivne kampanje.
                            </p>
                        </Panel>
                    </motion.div>
                )}

                {/* Top autori / brendovi */}
                <motion.div variants={fadeUp} className={config.tableType === 'proizvodi' ? "col-span-12" : "col-span-12 lg:col-span-6"}>
                    <Panel>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                                <Users size={13} style={{ color: "#8b5cf6" }} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#52525b" }}>Potražnja</p>
                                <p className="text-sm font-semibold text-white">{config.tableType === 'proizvodi' ? "Top brendovi" : "Najpopularniji autori"}</p>
                            </div>
                        </div>
                        {m.topAutori.length === 0 ? (
                            <p className="text-xs italic" style={{ color: "#3f3f46" }}>Nema dovoljno podataka</p>
                        ) : (
                            <div className={config.tableType === 'proizvodi' ? "grid grid-cols-2 md:grid-cols-4 gap-3" : "space-y-3"}>
                                {m.topAutori.map((a, i) => {
                                    const pct = Math.round((a.count / maxAutor) * 100)
                                    const medal = MEDALS[i]
                                    if (config.tableType === 'proizvodi') {
                                        const isTop = i === 0
                                        return (
                                            <div key={a.name} className="relative rounded-xl p-4 flex flex-col gap-2"
                                                style={{
                                                    background: isTop
                                                        ? "linear-gradient(135deg,rgba(139,92,246,0.14),rgba(139,92,246,0.06))"
                                                        : "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))",
                                                    border: isTop ? "1px solid rgba(139,92,246,0.3)" : "1px solid rgba(255,255,255,0.06)",
                                                }}>
                                                <div className="flex items-start justify-between">
                                                    <span className="text-lg leading-none">{medal ?? <span className="text-[11px] font-black" style={{ color: "#52525b" }}>#{i+1}</span>}</span>
                                                    <span className="text-2xl font-black leading-none" style={{ color: isTop ? "#8b5cf6" : "#52525b" }}>{a.count}</span>
                                                </div>
                                                <p className="text-sm font-bold leading-snug" style={{ color: isTop ? "#e4e4e7" : "#a1a1aa" }}>{a.name}</p>
                                                <div className="mt-auto pt-2 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                        transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                                                        className="h-full rounded-full"
                                                        style={{ background: isTop ? "#8b5cf6" : "rgba(255,255,255,0.2)" }} />
                                                </div>
                                            </div>
                                        )
                                    }
                                    return (
                                        <div key={a.name} className="flex items-center gap-3 group">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                                                style={{
                                                    background: i < 3 ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
                                                    border: "1px solid rgba(255,255,255,0.06)",
                                                }}>
                                                {medal ?? <span className="text-[9px] font-black" style={{ color: "#52525b" }}>{i + 1}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate" style={{ color: i < 3 ? "#e4e4e7" : "#a1a1aa" }}>{a.name}</p>
                                                <div className="mt-1.5 h-[4px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                        transition={{ duration: 1, delay: 0.3 + i * 0.09, ease: "easeOut" }}
                                                        className="h-full rounded-full"
                                                        style={{ background: i === 0 ? "#8b5cf6" : i === 1 ? "#a78bfa" : i === 2 ? "#c4b5fd" : "rgba(255,255,255,0.15)" }} />
                                                </div>
                                            </div>
                                            <span className="text-sm font-black w-6 text-right shrink-0"
                                                style={{ color: i < 3 ? "#8b5cf6" : "#52525b" }}>{a.count}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        <p className="text-[10px] mt-5 leading-snug" style={{ color: "#3f3f46" }}>
                            {config.tableType === 'proizvodi'
                                ? "Brendovi koje kupci najčešće traže — koristi za prioritizaciju zaliha i promotivnih kampanja."
                                : "Autori čija dela kupci najčešće traže — koristi za nabavku novih naslova istih autora."}
                        </p>
                    </Panel>
                </motion.div>
            </div>

            {/* ── Top knjige (full width, ranked cards) ── */}
            <motion.div variants={fadeUp}>
                <Panel>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}>
                            <BookOpen size={13} style={{ color: "#06b6d4" }} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#52525b" }}>Direktan signal potražnje</p>
                            <p className="text-sm font-semibold text-white">{config.tableType === 'proizvodi' ? "Najtraženiji proizvodi" : "Najtraženije knjige"}</p>
                        </div>
                    </div>
                    {m.topKnjige.length === 0 ? (
                        <p className="text-xs italic" style={{ color: "#3f3f46" }}>Nema dovoljno podataka</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            {m.topKnjige.map((k, i) => {
                                const pct = Math.round((k.count / maxKnjiga) * 100)
                                const medal = MEDALS[i]
                                const isTop = i === 0
                                return (
                                    <div key={k.name} className="relative rounded-xl p-4 flex flex-col gap-2"
                                        style={{
                                            background: isTop
                                                ? "linear-gradient(135deg,rgba(6,182,212,0.12),rgba(6,182,212,0.04))"
                                                : "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))",
                                            border: isTop ? "1px solid rgba(6,182,212,0.25)" : "1px solid rgba(255,255,255,0.06)",
                                        }}>
                                        <div className="flex items-start justify-between">
                                            <span className="text-lg leading-none">{medal ?? <span className="text-[11px] font-black" style={{ color: "#52525b" }}>#{i+1}</span>}</span>
                                            <span className="text-2xl font-black leading-none" style={{ color: isTop ? "#06b6d4" : "#52525b" }}>{k.count}</span>
                                        </div>
                                        <p className="text-xs font-semibold leading-snug line-clamp-2" style={{ color: isTop ? "#e4e4e7" : "#a1a1aa" }}>{k.name}</p>
                                        {k.autor && (
                                            <p className="text-[10px] truncate" style={{ color: "#52525b" }}>{k.autor}</p>
                                        )}
                                        <div className="mt-auto pt-2 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                                                className="h-full rounded-full"
                                                style={{ background: isTop ? "#06b6d4" : "rgba(255,255,255,0.2)" }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    <p className="text-[10px] mt-4 leading-snug" style={{ color: "#3f3f46" }}>
                        {config.tableType === 'proizvodi'
                            ? "Koliko puta je svaki proizvod pomenut u DM razgovorima — kombiniraj sa statusom dostupnosti u katalogu."
                            : "Koliko puta je svaka knjiga pomenuta u DM razgovorima. Kombinuj sa kolonom Zaliha u Katalogu za potpunu sliku."}
                    </p>
                </Panel>
            </motion.div>
        </motion.div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
//  RECRUITMENT ANALYTICS (unchanged — for SmartFlow / OZ Avala)
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent = false, sub, delay = 0 }: {
    label: string; value: number | string; icon: any; accent?: boolean; sub?: string; delay?: number
}) {
    return (
        <motion.div variants={fadeUp} transition={{ delay }} className="relative rounded-2xl overflow-hidden grain-overlay"
            style={{
                background: accent
                    ? "linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.06))"
                    : "linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))",
                border: accent ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(255,255,255,0.07)",
                boxShadow: accent
                    ? "0 0 40px -10px rgba(16,185,129,0.2), 0 20px 40px -10px rgba(0,0,0,0.4)"
                    : "0 20px 40px -10px rgba(0,0,0,0.3)",
                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", padding: "20px",
            }}>
            {accent && <Scanline />}
            {accent && (
                <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle,rgba(16,185,129,0.3) 0%,transparent 70%)" }} />
            )}
            <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#52525b" }}>{label}</p>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: accent ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <Icon size={14} style={{ color: accent ? "#10b981" : "#52525b" }} />
                </div>
            </div>
            <p className="text-3xl md:text-[2.6rem] font-black leading-none tracking-tighter text-white"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
            {sub && <p className="text-[10px] mt-2" style={{ color: "#3f3f46" }}>{sub}</p>}
        </motion.div>
    )
}

function RecruitmentAnalytics() {
    const FIXED_DAILY = [8, 11, 14, 17, 19, 13, 10, 15, 18, 22, 24, 19, 16, 21]
    const totalConvs  = FIXED_DAILY.reduce((s, v) => s + v, 0)
    const appliedCount = 91; const jobAskCount = 173; const forwardedCount = 84
    const today = startOfDay(new Date())
    const dailyData = FIXED_DAILY.map((count, i) => ({ day: format(subDays(today, 13 - i), "d.M"), count }))
    const jobData = [["Konobar / Sanker",118],["Magacin",97],["Prodavac",74],["Dostava",61],["Cuvar",48],["Ciscenje",33],["Utovarivac",29]]
        .map(([name, value]) => ({ name: name as string, value: value as number }))
    const qData = [{ name: "Prijava za posao", value: 91 },{ name: "Opste informacije", value: 74 },{ name: "Pitanje o plati", value: 63 },{ name: "Pitanje o smeni", value: 49 },{ name: "Slanje dokumenta", value: 28 }]
    const funnelData = [
        { label: "Pokrenuli razgovor", count: totalConvs, color: "#10b981", pct: 100 },
        { label: "Pitali o poslu",     count: jobAskCount, color: "#06b6d4", pct: 76  },
        { label: "Prijavili se",       count: appliedCount, color: "#f59e0b", pct: 40 },
        { label: "Prosleđeni",         count: forwardedCount, color: "#a78bfa", pct: 37 },
    ]
    const pieData = [
        { name: "Instagram", value: 91, color: "#ec4899" },
        { name: "WhatsApp",  value: 68, color: "#10b981" },
        { name: "Facebook",  value: 34, color: "#3b82f6" },
        { name: "Website",   value: 34, color: "#8b5cf6" },
    ]
    const maxJob = jobData[0]?.value || 1

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-16">
            <motion.div variants={fadeUp} className="flex items-end justify-between mb-2 px-1">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#10b981" }}>AI Growth Intelligence</p>
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white">
                        Agent <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Analitika</span>
                    </h2>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full self-start mt-1"
                    style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" style={{ boxShadow: "0 0 8px rgba(16,185,129,0.8)" }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#10b981" }}>Live</span>
                </div>
            </motion.div>
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard accent label="Prosecno Upita/Dan" value={16}          icon={TrendingUp}   sub="razgovora u proseku" />
                <StatCard label="Razgovora Ukupno"          value={totalConvs}  icon={MessageSquare} sub="poslednjih 14 dana" />
                <StatCard label="Trazili Poziciju"          value={jobAskCount} icon={Users}         sub="konkretan upit" />
                <StatCard accent label="Stopa Odgovora"     value="98.7%"       icon={Zap}           sub="AI pokrivenost" />
            </motion.div>
            <div className="grid grid-cols-12 gap-4">
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8 rounded-2xl overflow-hidden grain-overlay relative"
                    style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", boxShadow:"0 20px 40px -10px rgba(0,0,0,0.5)", padding:"20px" }}>
                    <Scanline />
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Aktivnost</p>
                            <p className="text-base font-semibold text-white">Poslednjih 14 dana</p>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={dailyData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
                            <defs>
                                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#10b981" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="day" tick={{ fill: "#3f3f46", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#3f3f46", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<PremiumTooltip unit="razgovora" />} />
                            <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#aGrad)" dot={false}
                                style={{ filter: "drop-shadow(0 2px 8px rgba(16,185,129,0.4))" }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-4 rounded-2xl overflow-hidden grain-overlay relative flex flex-col"
                    style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", boxShadow:"0 20px 40px -10px rgba(0,0,0,0.5)", padding:"20px" }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color:"#52525b" }}>Kanali</p>
                    <p className="text-base font-semibold text-white mb-6">Izvor razgovora</p>
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                <p className="text-2xl font-black text-white leading-none">{totalConvs}</p>
                                <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color:"#52525b" }}>ukupno</p>
                            </div>
                            <ResponsiveContainer width={140} height={140}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={64} dataKey="value" strokeWidth={0} paddingAngle={3}>
                                        {pieData.map((e, i) => <Cell key={i} fill={e.color} style={{ filter:`drop-shadow(0 0 6px ${e.color}50)` }} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-5 space-y-3">
                        {pieData.map((d,i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                                <span className="text-xs flex-1 font-medium" style={{ color:"#a1a1aa" }}>{d.name}</span>
                                <div className="w-20 h-[3px] rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.05)" }}>
                                    <div className="h-full rounded-full" style={{ background: d.color, width:`${Math.round(d.value/totalConvs*100)}%` }} />
                                </div>
                                <span className="text-xs font-bold w-6 text-right text-white">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
            <motion.div variants={fadeUp} className="rounded-2xl overflow-hidden grain-overlay relative"
                style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", boxShadow:"0 20px 40px -10px rgba(0,0,0,0.5)", padding:"20px" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color:"#52525b" }}>Konverzija</p>
                <p className="text-base font-semibold text-white mb-8">Gde staje razgovor</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                    {funnelData.map((s,i) => (
                        <div key={i} className="relative flex flex-col gap-3">
                            <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.05)" }}>
                                <motion.div initial={{ width:0 }} animate={{ width:`${s.pct}%` }} transition={{ duration:1.2, delay:0.2+i*0.12, ease:"easeOut" }}
                                    className="absolute top-0 left-0 h-full rounded-full" style={{ background:s.color, boxShadow:`0 0 8px ${s.color}60` }} />
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-[2.2rem] font-black leading-none" style={{ color:s.color, textShadow:`0 0 20px ${s.color}80` }}>{s.count}</p>
                                    <p className="text-xs font-semibold text-white/70 mt-1 leading-tight">{s.label}</p>
                                </div>
                                <p className="text-xs font-bold pb-1" style={{ color:s.color }}>{s.pct}%</p>
                            </div>
                            {i < funnelData.length-1 && (
                                <div className="absolute -right-4 top-0 bottom-0 flex items-center z-10 pointer-events-none">
                                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </motion.div>
            <div className="grid grid-cols-12 gap-4">
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-7 rounded-2xl overflow-hidden grain-overlay relative"
                    style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", boxShadow:"0 20px 40px -10px rgba(0,0,0,0.5)", padding:"20px" }}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.2)" }}>
                            <Zap size={14} style={{ color:"#10b981" }} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color:"#52525b" }}>Potražnja</p>
                            <p className="text-base font-semibold text-white">Najtrazeniji poslovi</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {jobData.map((d,i) => {
                            const pct = Math.round((d.value / maxJob) * 100)
                            const hue = 160 - i * 8
                            return (
                                <div key={d.name} className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold w-3 text-right shrink-0" style={{ color:"#3f3f46" }}>{i+1}</span>
                                    <span className="text-xs font-medium w-32 shrink-0" style={{ color:"#a1a1aa" }}>{d.name}</span>
                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.04)" }}>
                                        <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:1, delay:0.3+i*0.07, ease:"easeOut" }}
                                            className="h-full rounded-full" style={{ background:`linear-gradient(90deg,hsl(${hue},80%,45%),hsl(200,80%,40%))`, boxShadow:`0 0 8px hsla(${hue},80%,45%,0.4)` }} />
                                    </div>
                                    <span className="text-xs font-bold w-7 text-right text-white">{d.value}</span>
                                </div>
                            )
                        })}
                    </div>
                </motion.div>
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-5 rounded-2xl overflow-hidden grain-overlay relative flex flex-col"
                    style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", boxShadow:"0 20px 40px -10px rgba(0,0,0,0.5)", padding:"20px" }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color:"#52525b" }}>Intent</p>
                    <p className="text-base font-semibold text-white mb-6">Najcesca pitanja</p>
                    <div className="space-y-2 flex-1">
                        {qData.slice(0,5).map((d,i) => {
                            const max = qData[0].value || 1; const pct = Math.round(d.value/max*100)
                            const colors = ["#10b981","#06b6d4","#8b5cf6","#f59e0b","#ef4444"]
                            return (
                                <div key={i} className="relative flex items-center gap-3 py-2.5 px-3 rounded-xl" style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative">
                                        <RingProgress value={pct} max={100} color={colors[i]} size={32} />
                                        <span className="absolute text-[8px] font-black" style={{ color:colors[i] }}>{pct}</span>
                                    </div>
                                    <span className="text-xs font-medium flex-1 leading-tight" style={{ color:"#a1a1aa" }}>{d.name}</span>
                                    <span className="text-sm font-black" style={{ color:colors[i] }}>{d.value}</span>
                                </div>
                            )
                        })}
                    </div>
                    <div className="mt-5 pt-4 rounded-xl px-4 py-3 flex items-center gap-4"
                        style={{ background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.12)" }}>
                        <div>
                            <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color:"#10b981" }}>Conversion</p>
                            <p className="text-xl font-black text-white leading-tight">{Math.round(appliedCount/totalConvs*100)}<span className="text-xs font-medium" style={{ color:"#52525b" }}>%</span></p>
                        </div>
                        <div className="h-8 w-px" style={{ background:"rgba(255,255,255,0.06)" }} />
                        <p className="text-[11px] leading-snug" style={{ color:"#52525b" }}>kandidata je prešlo iz razgovora u prijavu</p>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}

// ═════════════════════════════════════════════════════════════════════════════
export function ChatbotAnalyticsModule({ clientId, selectedBrandIds, demoNiche }: ChatbotAnalyticsModuleProps) {
    const bookStoreConfig = getBookStoreConfig(clientId)

    if (bookStoreConfig) {
        return <BookstoreAnalytics clientId={clientId} config={bookStoreConfig} selectedBrandIds={selectedBrandIds} />
    }

    if (demoNiche) {
        return <DemoAnalytics clientId={clientId} demoNiche={demoNiche} />
    }

    return <RecruitmentAnalytics />
}

// ── Demo analytics — reads from demo_crm + razgovori ──────────────────────

const PLATFORM_LABELS_DEMO: Record<string, string> = {
    instagram: "Instagram", whatsapp: "WhatsApp", facebook: "Facebook",
    website: "Website", web: "Website", viber: "Viber",
}
const CHANNEL_COLORS_DEMO: Record<string, string> = {
    Instagram: "#ec4899", WhatsApp: "#10b981", Facebook: "#3b82f6",
    Website: "#8b5cf6", Viber: "#7c3aed",
}
const STATUS_COLORS_MAP_DEMO: Record<string, string> = {
    Novi: "#0ea5e9", Zainteresovan: "#f59e0b",
    Naručio: "#10b981", Isporučeno: "#8b5cf6",
    Zakazano: "#10b981", Završeno: "#6366f1",
    Reklamacija: "#f97316", Intervencija: "#ef4444",
}

const SERVICE_NICHES_ANALYTICS = new Set(["dental", "medical", "beauty", "fitness", "services", "wellness", "real-estate"])

// Keyword classifiers — derive question topics & objections from raw user messages.
const QUESTION_TOPICS: { label: string; kw: string[] }[] = [
    { label: "Cena / cenovnik", kw: ["košta", "cena", "cenovnik", "koliko"] },
    { label: "Slobodni termini", kw: ["slobodno", "termin", "zakaz", "sutra", "danas", "ove nedelje"] },
    { label: "Radno vreme", kw: ["radite", "radno", "vikendom", "subotom", "otvoreno", "radni"] },
    { label: "Dostupnost", kw: ["na stanju", "dostupno", "imate li", "ima li"] },
    { label: "Dostava", kw: ["dostava", "šalje", "pouzeć", "kurir", "stiže"] },
    { label: "Garancija / povraćaj", kw: ["garancij", "reklamacij", "povraćaj", "zamen"] },
    { label: "Trajanje / pregled", kw: ["traje", "koliko traje", "pregled"] },
    { label: "Boja / varijanta", kw: ["boj", "veličin", "model", "varijant"] },
]
const OBJECTION_TOPICS: { label: string; kw: string[] }[] = [
    { label: "Cena (skupo)", kw: ["skupo", "mnogo", "preskupo", "puno para"] },
    { label: "Razmisliću / kasnije", kw: ["razmisli", "javiću se", "možda", "kasnije", "sledeć"] },
    { label: "Termin ne odgovara", kw: ["samo subota", "ne mogu", "radim radnim", "isključivo"] },
    { label: "Nije na stanju", kw: ["nema na stanju", "rasprodat", "nema u"] },
]

function classify(msgs: string[], topics: { label: string; kw: string[] }[]) {
    const counts: Record<string, number> = {}
    for (const raw of msgs) {
        const m = (raw || "").toLowerCase()
        for (const t of topics) {
            if (t.kw.some(k => m.includes(k))) counts[t.label] = (counts[t.label] ?? 0) + 1
        }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }))
}

function DemoAnalytics({ clientId, demoNiche }: { clientId: string; demoNiche: string }) {
    const [crmRows, setCrmRows] = useState<any[]>([])
    const [razgovori, setRazgovori] = useState<any[]>([])
    const [appts, setAppts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'danas' | 'sedmica' | 'mesec'>('mesec')
    const isServiceNiche = SERVICE_NICHES_ANALYTICS.has((demoNiche || "").toLowerCase())

    useEffect(() => {
        const sb = createSupabaseClient()
        Promise.all([
            sb.from('demo_crm').select('*').eq('client_id', clientId),
            sb.from('razgovori').select('platform, id_razgovora, created_at, message, role').eq('client_id', clientId),
            sb.from('appointments').select('starts_at, service_name').eq('client_id', clientId),
            getDemoShift(sb, clientId, true),
        ]).then(([crm, razg, ap, shift]) => {
            // Demo data is seeded once and viewed weeks later — re-anchor to now.
            setCrmRows(shiftRows(crm.data ?? [], ['created_at'], shift.deltaMs))
            setRazgovori(shiftRows(razg.data ?? [], ['created_at'], shift.deltaMs))
            setAppts(shiftRowsDays(ap.data ?? [], ['starts_at'], shift.deltaDays))
            setLoading(false)
        })
    }, [clientId])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            </div>
        )
    }

    const today = startOfDay(new Date())
    const todayStr = today.toDateString()
    const weekAgo = subDays(today, 7)
    const monthAgo = subDays(today, 30)

    const inPeriod = (dateStr: string) => {
        const d = new Date(dateStr)
        if (period === 'danas') return d.toDateString() === todayStr
        if (period === 'sedmica') return d >= weekAgo
        return d >= monthAgo
    }

    const filteredRazg = razgovori.filter(r => inPeriod(r.created_at))
    const distinctConversations = new Set(filteredRazg.map(r => r.id_razgovora)).size

    const total = crmRows.length
    const narucilo = crmRows.filter(r => ['Naručio', 'Zakazano'].includes(r.status)).length
    const isporuceno = crmRows.filter(r => ['Isporučeno', 'Završeno'].includes(r.status)).length
    const zainteresovano = crmRows.filter(r => r.status === 'Zainteresovan').length
    const intervencija = crmRows.filter(r => r.status === 'Intervencija').length
    // Both a booked appointment and a finished one are conversions — counting only
    // the still-open ones understated the agent's real close rate.
    const konverzija = total > 0 ? Math.round(((narucilo + isporuceno) / total) * 100) : 0

    // Top products
    const productCounts: Record<string, number> = {}
    crmRows.forEach(r => { if (r.proizvod) productCounts[r.proizvod] = (productCounts[r.proizvod] ?? 0) + 1 })
    const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))
    const maxProduct = topProducts[0]?.count ?? 1

    // Category breakdown
    const categoryCounts: Record<string, number> = {}
    crmRows.forEach(r => { if (r.kategorija) categoryCounts[r.kategorija] = (categoryCounts[r.kategorija] ?? 0) + 1 })
    const categoryData = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
    const maxCat = categoryData[0]?.count ?? 1

    // Channel distribution (deduplicated, period-filtered)
    const seenConvPlatform = new Map<string, string>()
    filteredRazg.forEach(r => {
        if (r.id_razgovora && !seenConvPlatform.has(r.id_razgovora))
            seenConvPlatform.set(r.id_razgovora, r.platform ?? '')
    })
    const channelCounts: Record<string, number> = {}
    seenConvPlatform.forEach(platform => {
        const label = PLATFORM_LABELS_DEMO[platform.toLowerCase()] ?? platform
        channelCounts[label] = (channelCounts[label] ?? 0) + 1
    })
    const channelData = Object.entries(channelCounts).map(([name, value]) => ({ name, value }))
    const totalChannels = channelData.reduce((s, c) => s + c.value, 0)

    // Daily trend (14 days, unfiltered for full picture)
    const dailyData = Array.from({ length: 14 }, (_, i) => {
        const day = subDays(today, 13 - i)
        const convIds = new Set<string>()
        razgovori.forEach(r => {
            const d = startOfDay(new Date(r.created_at))
            if (d.getTime() === day.getTime() && r.id_razgovora) convIds.add(r.id_razgovora)
        })
        return { day: format(day, "d.M"), count: convIds.size }
    })

    // Status distribution
    const statusCounts: Record<string, number> = {}
    crmRows.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1 })

    // ── AI Insights (derived from conversations) ──────────────────────────────
    const userMessages = razgovori.filter(r => r.role === 'user').map(r => r.message as string)
    const topQuestions = classify(userMessages, QUESTION_TOPICS).slice(0, 5)
    const maxQ = topQuestions[0]?.count ?? 1
    const topObjections = classify(userMessages, OBJECTION_TOPICS).slice(0, 4)
    const maxO = topObjections[0]?.count ?? 1

    // Hottest scheduling times — appointment hour histogram (service) or order-time (product)
    const timeSource = isServiceNiche
        ? appts.map(a => new Date(a.starts_at))
        : razgovori.filter(r => r.role === 'user').map(r => new Date(r.created_at))
    const hourBuckets: Record<number, number> = {}
    timeSource.forEach(d => { const h = d.getHours(); if (h >= 7 && h <= 20) hourBuckets[h] = (hourBuckets[h] ?? 0) + 1 })
    const hotTimes = Object.entries(hourBuckets).map(([h, c]) => ({ hour: Number(h), count: c })).sort((a, b) => b.count - a.count)
    const maxHot = hotTimes[0]?.count ?? 1
    const hotTimesSorted = [...hotTimes].sort((a, b) => a.hour - b.hour)

    // Most-requested services/treatments (service) from appointments
    const svcCounts: Record<string, number> = {}
    appts.forEach(a => { if (a.service_name) svcCounts[a.service_name] = (svcCounts[a.service_name] ?? 0) + 1 })
    const topServices = Object.entries(svcCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))
    const maxSvc = topServices[0]?.count ?? 1

    const PERIODS = [
        { key: 'danas' as const, label: 'Danas' },
        { key: 'sedmica' as const, label: '7 dana' },
        { key: 'mesec' as const, label: '30 dana' },
    ]
    const PRODUCT_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899']
    const CAT_COLORS = ['#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4']
    const MEDALS = ['🥇', '🥈', '🥉']

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 pb-16 p-6">
            {/* Header */}
            <motion.div variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500 mb-1">AI Growth Intelligence</p>
                    <h2 className="text-3xl font-black text-white">Agent <span className="text-emerald-400">Analitika</span></h2>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl glass-card">
                    {PERIODS.map(p => (
                        <button key={p.key} onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-widest transition-all ${period === p.key ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Key metrics */}
            <motion.div variants={fadeUp} data-tour-focus="analytics-metrics" className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Razgovora", value: distinctConversations, color: "#10b981", Icon: MessageSquare },
                    { label: isServiceNiche ? "Zakazalo" : "Naručilo", value: narucilo, color: "#06b6d4", Icon: ShoppingBag },
                    { label: isServiceNiche ? "Obavljeno" : "Isporučeno", value: isporuceno, color: "#8b5cf6", Icon: Users },
                    { label: "Konverzija", value: `${konverzija}%`, color: "#f59e0b", Icon: TrendingUp },
                ].map(m => (
                    <div key={m.label} className="glass-card rounded-2xl p-5 relative overflow-hidden">
                        <m.Icon className="absolute top-3 right-3 w-8 h-8 opacity-[0.07]" style={{ color: m.color }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{m.label}</p>
                        <p className="text-4xl font-black" style={{ color: m.color }}>{m.value}</p>
                    </div>
                ))}
            </motion.div>

            {/* Trend + Channels */}
            <div className="grid grid-cols-12 gap-4">
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8 glass-card rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Aktivnost</p>
                    <p className="text-sm font-semibold text-white mb-4">Razgovori po danu — poslednje 2 nedelje</p>
                    <ResponsiveContainer width="100%" height={150}>
                        <AreaChart data={dailyData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
                            <defs>
                                <linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="day" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<PremiumTooltip unit="razgovora" />} />
                            <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#demoGrad)" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>

                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-4 glass-card rounded-2xl p-6 flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Kanali</p>
                    <p className="text-sm font-semibold text-white mb-4">Odakle dolaze kupci</p>
                    {channelData.length === 0 ? (
                        <p className="text-sm text-zinc-600 italic">Nema podataka za izabrani period</p>
                    ) : (
                        <>
                            <div className="flex justify-center mb-4">
                                <div className="relative">
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                        <p className="text-2xl font-black text-white leading-none">{totalChannels}</p>
                                        <p className="text-[9px] uppercase tracking-widest mt-0.5 text-zinc-600">razgovora</p>
                                    </div>
                                    <ResponsiveContainer width={120} height={120}>
                                        <PieChart>
                                            <Pie data={channelData} cx="50%" cy="50%" innerRadius={36} outerRadius={56} dataKey="value" strokeWidth={0} paddingAngle={3}>
                                                {channelData.map((c, i) => {
                                                    const color = CHANNEL_COLORS_DEMO[c.name] ?? '#6366f1'
                                                    return <Cell key={i} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color}50)` }} />
                                                })}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="space-y-2.5">
                                {channelData.map((c, i) => {
                                    const color = CHANNEL_COLORS_DEMO[c.name] ?? '#6366f1'
                                    const pct = totalChannels > 0 ? Math.round(c.value / totalChannels * 100) : 0
                                    return (
                                        <div key={i} className="flex items-center gap-2.5">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                            <span className="text-xs flex-1 font-medium text-zinc-400">{c.name}</span>
                                            <div className="w-14 h-[3px] rounded-full overflow-hidden bg-white/5">
                                                <div className="h-full rounded-full" style={{ background: color, width: `${pct}%` }} />
                                            </div>
                                            <span className="text-xs font-bold w-5 text-right text-white">{c.value}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </motion.div>
            </div>

            {/* ── AI Insights ───────────────────────────────────────────────────
                This is the part of the dashboard nobody else has: not "how many
                messages", but what customers actually asked, what stopped them
                buying, and when they want to come in. It gets its own framed
                stage so it doesn't read as three more chart tiles. */}
            <motion.div
                variants={fadeUp}
                data-tour-focus="ai-insights"
                className="relative rounded-3xl p-5 md:p-7 mt-2"
                style={{
                    background: "linear-gradient(160deg, rgba(16,185,129,0.07) 0%, rgba(16,185,129,0.015) 45%, transparent 100%)",
                    border: "1px solid rgba(16,185,129,0.22)",
                    boxShadow: "0 24px 70px -30px rgba(16,185,129,0.45)",
                }}
            >
                <div className="flex items-start gap-3.5 mb-5">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: "rgba(16,185,129,0.16)", border: "1px solid rgba(16,185,129,0.35)" }}>
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500 mb-1">AI Insights</p>
                        <h3 className="text-xl md:text-2xl font-bold text-white font-outfit leading-tight">
                            Šta Vaši kupci stvarno pitaju
                        </h3>
                        <p className="text-[13px] md:text-sm text-zinc-400 leading-relaxed mt-1.5 max-w-2xl">
                            Agent čita svaki razgovor i izvlači ono što se inače nikad ne zapiše: koje pitanje se ponavlja,
                            šta ljude zaustavi pred zakazivanje i u koje sate Vas najviše traže.
                            <span className="text-zinc-200 font-medium"> Ovo je Vaše tržište, rečeno njihovim rečima.</span>
                        </p>
                    </div>
                </div>

            <div className="grid grid-cols-12 gap-4">
                {/* Hottest times */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-5 glass-card rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Špic sati</p>
                    <p className="text-base font-bold text-white mb-1 font-outfit">{isServiceNiche ? "Najtraženiji termini" : "Najaktivniji sati"}</p>
                    {hotTimesSorted.length > 0 && (
                        <>
                            <p className="text-[13px] text-zinc-400 leading-snug mb-3">
                                Kada Vas ljudi traže — pa znate gde da otvorite mesta.
                            </p>
                            <div className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 mb-3"
                                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)" }}>
                                <span className="text-[11px] uppercase tracking-wider text-emerald-500/80 font-bold">Vrh</span>
                                <span className="text-sm font-black text-emerald-300">
                                    {hotTimes.slice(0, 2).map(t => `${t.hour}h`).join(" i ")}
                                </span>
                            </div>
                        </>
                    )}
                    {hotTimesSorted.length === 0 ? (
                        <p className="text-xs italic text-zinc-600">Nema dovoljno podataka</p>
                    ) : (
                        <div className="flex items-end justify-between gap-1.5 h-32 mt-2">
                            {hotTimesSorted.map((t, i) => {
                                const pct = Math.round(t.count / maxHot * 100)
                                const isPeak = t.count === maxHot
                                return (
                                    <div key={t.hour} className="flex-1 flex flex-col items-center gap-1.5">
                                        <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(pct, 6)}%` }}
                                            transition={{ duration: 0.7, delay: 0.1 + i * 0.04, ease: 'easeOut' }}
                                            className="w-full rounded-t-md relative group"
                                            style={{ background: isPeak ? 'linear-gradient(180deg,#34d39e,#10b981)' : 'rgba(16,185,129,0.25)', boxShadow: isPeak ? '0 0 14px -2px rgba(16,185,129,0.6)' : 'none' }} />
                                        <span className={`text-[9px] font-mono ${isPeak ? 'text-emerald-400 font-bold' : 'text-zinc-600'}`}>{t.hour}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>

                {/* Top questions */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-4 glass-card rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Potražnja</p>
                    <p className="text-base font-bold text-white mb-1 font-outfit">Najčešća pitanja kupaca</p>
                    <p className="text-[13px] text-zinc-400 leading-snug mb-4">
                        Ono što se ponavlja svaki dan — gotov spisak za Vaš sajt, story i cenovnik.
                    </p>
                    {topQuestions.length === 0 ? (
                        <p className="text-xs italic text-zinc-600">Nema dovoljno podataka</p>
                    ) : (
                        <div className="space-y-3">
                            {topQuestions.map((q, i) => {
                                const pct = Math.round(q.count / maxQ * 100)
                                return (
                                    <div key={q.label}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[13px] font-medium text-zinc-200">{q.label}</span>
                                            <span className="text-base font-black text-emerald-400 tabular-nums">{q.count}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: 'easeOut' }}
                                                className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>

                {/* Top objections */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-3 glass-card rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80 mb-1">Prepreke</p>
                    <p className="text-base font-bold text-white mb-1 font-outfit">Zašto ljudi ne zakažu</p>
                    <p className="text-[13px] text-zinc-400 leading-snug mb-4">
                        Razlog koji Vam niko ne kaže u lice — a agent ga čuje svaki dan.
                    </p>
                    {topObjections.length === 0 ? (
                        <p className="text-xs italic text-zinc-600">Nema zabeleženih primedbi</p>
                    ) : (
                        <div className="space-y-2.5">
                            {topObjections.map((o, i) => (
                                <div key={o.label} className="rounded-xl px-3.5 py-3 flex items-center justify-between gap-3"
                                    style={{
                                        background: i === 0 ? "rgba(245,158,11,0.16)" : "rgba(245,158,11,0.07)",
                                        border: `1px solid rgba(245,158,11,${i === 0 ? 0.42 : 0.18})`,
                                    }}>
                                    <span className="text-[13px] font-medium text-amber-100/90 leading-snug">{o.label}</span>
                                    <span className="text-xl font-black text-amber-400 tabular-nums shrink-0">{o.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
            </motion.div>

            {/* Most-requested services (service niches) */}
            {isServiceNiche && topServices.length > 0 && (
                <motion.div variants={fadeUp} className="glass-card rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Usluge</p>
                    <p className="text-sm font-semibold text-white mb-5">Najtraženije usluge (po zakazanim terminima)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">
                        {topServices.map((s, i) => {
                            const pct = Math.round(s.count / maxSvc * 100)
                            const color = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899'][i] ?? '#52525b'
                            return (
                                <div key={s.name} className="flex items-center gap-3">
                                    <span className="text-sm w-5 shrink-0 text-center">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}`}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-zinc-300 truncate pr-2">{s.name}</span>
                                            <span className="text-xs font-black shrink-0" style={{ color }}>{s.count}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: 'easeOut' }}
                                                className="h-full rounded-full" style={{ background: color }} />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </motion.div>
            )}

            {/* Conversion funnel */}
            <motion.div variants={fadeUp} data-tour-focus="analytics-funnel" className="glass-card rounded-2xl p-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Konverzija</p>
                <p className="text-sm font-semibold text-white mb-6">{isServiceNiche ? "Put do termina" : "Put do narudžbine"}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                        { label: 'Razgovarali',    count: total,           pct: 100,                                                              color: '#10b981' },
                        { label: 'Zainteresovani', count: zainteresovano,  pct: total > 0 ? Math.round(zainteresovano / total * 100) : 0,         color: '#f59e0b' },
                        { label: isServiceNiche ? 'Zakazali' : 'Naručili',   count: narucilo,   pct: total > 0 ? Math.round(narucilo / total * 100) : 0,   color: '#06b6d4' },
                        { label: isServiceNiche ? 'Obavljeno' : 'Isporučeno', count: isporuceno, pct: total > 0 ? Math.round(isporuceno / total * 100) : 0, color: '#8b5cf6' },
                    ].map((s, i) => (
                        <div key={i} className="relative flex flex-col gap-3">
                            {i < 3 && (
                                <div className="absolute -right-4 top-4 pointer-events-none hidden md:block">
                                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                                        <path d="M1 1l6 6-6 6" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round"/>
                                    </svg>
                                </div>
                            )}
                            <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }}
                                    transition={{ duration: 1.2, delay: 0.2 + i * 0.2, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ background: s.color, boxShadow: `0 0 8px ${s.color}60` }} />
                            </div>
                            <div>
                                <p className="text-3xl font-black leading-none" style={{ color: s.color }}>{s.count}</p>
                                <p className="text-xs font-medium text-white/60 mt-1">{s.label}</p>
                                <p className="text-[10px] font-bold mt-0.5" style={{ color: s.color }}>{s.pct}%</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-5 px-4 py-3 rounded-xl flex items-center gap-4"
                    style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
                    <p className="text-3xl font-black text-white">{konverzija}<span className="text-sm font-medium text-zinc-500">%</span></p>
                    <div className="h-8 w-px bg-white/5" />
                    <p className="text-xs leading-snug text-zinc-500">od svih razgovora završilo narudžbinom · {total - narucilo} kupaca otišlo bez narudžbine</p>
                </div>
            </motion.div>

            {/* Top products + Category breakdown */}
            <div className="grid grid-cols-12 gap-4">
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-7 glass-card rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Potražnja</p>
                    <p className="text-sm font-semibold text-white mb-5">Najtraženiji proizvodi</p>
                    {topProducts.length === 0 ? (
                        <p className="text-xs italic text-zinc-600">Nema dovoljno podataka</p>
                    ) : (
                        <div className="space-y-3.5">
                            {topProducts.map((p, i) => {
                                const pct = Math.round(p.count / maxProduct * 100)
                                const color = PRODUCT_COLORS[i] ?? '#52525b'
                                return (
                                    <div key={p.name} className="flex items-center gap-3">
                                        <span className="text-sm w-5 shrink-0 text-center">{MEDALS[i] ?? `${i + 1}`}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-medium text-zinc-300 truncate pr-2">{p.name}</span>
                                                <span className="text-xs font-black shrink-0" style={{ color }}>{p.count}</span>
                                            </div>
                                            <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                                                    className="h-full rounded-full" style={{ background: color }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>

                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-5 glass-card rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Kategorije</p>
                    <p className="text-sm font-semibold text-white mb-5">Raspodela po tipu</p>
                    <div className="space-y-2.5">
                        {categoryData.map((c, i) => {
                            const pct = Math.round(c.count / maxCat * 100)
                            const color = CAT_COLORS[i] ?? '#52525b'
                            return (
                                <div key={c.name} className="relative rounded-xl px-3 py-2.5 overflow-hidden"
                                    style={{ background: `linear-gradient(135deg,${color}14,${color}06)`, border: `1px solid ${color}28` }}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-semibold" style={{ color: '#e4e4e7' }}>{c.name}</span>
                                        <span className="text-xs font-black" style={{ color }}>{c.count}</span>
                                    </div>
                                    <div className="h-[3px] rounded-full overflow-hidden bg-white/5">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                            transition={{ duration: 1, delay: 0.3 + i * 0.06, ease: 'easeOut' }}
                                            className="h-full rounded-full" style={{ background: color }} />
                                    </div>
                                    <p className="text-[9px] mt-1 font-bold" style={{ color: `${color}90` }}>
                                        {total > 0 ? Math.round(c.count / total * 100) : 0}% kupaca
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </motion.div>
            </div>

            {/* Status distribution */}
            <motion.div variants={fadeUp} className="glass-card rounded-2xl p-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">CRM pregled</p>
                <p className="text-sm font-semibold text-white mb-4">Status kupaca</p>
                {intervencija > 0 && (
                    <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                        <p className="text-xs text-red-300">{intervencija} intervencija čeka odgovor</p>
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                        const color = STATUS_COLORS_MAP_DEMO[status] ?? '#6366f1'
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0
                        return (
                            <div key={status} className="rounded-xl p-3"
                                style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium" style={{ color }}>{status}</span>
                                    <span className="text-lg font-black text-white">{count}</span>
                                </div>
                                <div className="h-1 rounded-full overflow-hidden bg-white/5">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.9, ease: 'easeOut' }}
                                        className="h-full rounded-full" style={{ backgroundColor: color }} />
                                </div>
                                <p className="text-[10px] mt-1 font-mono text-zinc-600">{pct}%</p>
                            </div>
                        )
                    })}
                </div>
            </motion.div>
        </motion.div>
    )
}
