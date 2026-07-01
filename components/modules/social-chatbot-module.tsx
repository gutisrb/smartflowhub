"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { format, subDays } from "date-fns"
import {
    MessageCircle, Instagram, Facebook, Bot, AlertTriangle, CheckCircle2,
    Inbox, TrendingUp, UserCheck, Globe, Phone, Hash, ExternalLink,
    Wifi, Clock
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { getBookStoreConfig } from "@/lib/brand-configs"
import { NicheKey, NICHE_CONFIGS } from "@/lib/niche-config"
import { ChannelGlyph } from "@/components/dashboard/channel-glyph"

// ── Demo mode ────────────────────────────────────────────────────────────────
const DEMO_MODE = false

function td(hoursBack: number, minutesBack = 0) {
    const d = new Date()
    d.setHours(d.getHours() - hoursBack, d.getMinutes() - minutesBack, 0, 0)
    return d.toISOString()
}
function yd(hour: number, min = 0) {
    const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(hour, min, 0, 0); return d.toISOString()
}

function generateMockData() {
    const CID = "demo"
    const msg = (id: string, role: string, text: string, ts: string, platform: string, name: string, pic: string, extra?: any) => ({
        id: `${id}-${role}-${ts}`, id_razgovora: id, role, message: text,
        metadata: { name, profile_pic: pic, ...extra }, platform, client_id: CID, created_at: ts,
    })

    const convDefs = [
        // Instagram (6 = 40%)
        { id: "ig_marko", platform: "instagram", name: "Marko Petrović", pic: "https://randomuser.me/api/portraits/men/32.jpg", humanNeeded: false, phone: "065/123-456", msgs: [
            msg("ig_marko","user","Zdravo! Tražim posao u magacinu, da li imate nešto u Novom Sadu?",td(6,10),"instagram","Marko Petrović","https://randomuser.me/api/portraits/men/32.jpg"),
            msg("ig_marko","assistant","Zdravo Marko! Imamo otvorenu poziciju magacionera u Novom Sadu, plata 72.000 din, rad u smenama. Koji shift vam odgovara?",td(6,8),"instagram","Marko Petrović","https://randomuser.me/api/portraits/men/32.jpg"),
            msg("ig_marko","user","Zanima me noćna smena, 20-04h",td(6,5),"instagram","Marko Petrović","https://randomuser.me/api/portraits/men/32.jpg"),
            msg("ig_marko","assistant","Noćna smena je slobodna. Koliko imate godina i da li imate iskustvo u magacinskom poslovanju?",td(6,3),"instagram","Marko Petrović","https://randomuser.me/api/portraits/men/32.jpg"),
            msg("ig_marko","user","24 godine, radio sam godinu dana u DHL-u",td(5,55),"instagram","Marko Petrović","https://randomuser.me/api/portraits/men/32.jpg"),
            msg("ig_marko","assistant","Odlično iskustvo! Da li biste se prijavili? Trebam vaš broj telefona da povežemo sa poslodavcem.",td(5,53),"instagram","Marko Petrović","https://randomuser.me/api/portraits/men/32.jpg"),
            msg("ig_marko","user","Da, prijavim se! 065/123-456",td(5,50),"instagram","Marko Petrović","https://randomuser.me/api/portraits/men/32.jpg"),
            msg("ig_marko","assistant","Hvala Marko! Vaš kontakt je evidentiran. Koordinator će vas pozvati u roku od 24h. 🎯",td(5,48),"instagram","Marko Petrović","https://randomuser.me/api/portraits/men/32.jpg"),
        ]},
        { id: "ig_stefan", platform: "instagram", name: "Stefan Nikolić", pic: "https://randomuser.me/api/portraits/men/67.jpg", humanNeeded: true, phone: null, msgs: [
            msg("ig_stefan","user","Zdravo, imam pitanje o isplati za prethodni period, mislim da mi nešto nedostaje",td(5,30),"instagram","Stefan Nikolić","https://randomuser.me/api/portraits/men/67.jpg"),
            msg("ig_stefan","assistant","Zdravo Stefan! Razumem situaciju. Ovo zahteva uvid u vaš dosije — prosleđujem vas koordinatoru koji će vas kontaktirati danas.",td(5,28),"instagram","Stefan Nikolić","https://randomuser.me/api/portraits/men/67.jpg"),
            msg("ig_stefan","user","Hvala, čekam poziv onda",td(5,25),"instagram","Stefan Nikolić","https://randomuser.me/api/portraits/men/67.jpg"),
        ]},
        { id: "ig_jelena", platform: "instagram", name: "Jelena Popović", pic: "https://randomuser.me/api/portraits/women/35.jpg", humanNeeded: false, phone: null, msgs: [
            msg("ig_jelena","user","Dobar dan, imam iskustvo kuvara 5 godina, da li tražite nekoga?",td(4,45),"instagram","Jelena Popović","https://randomuser.me/api/portraits/women/35.jpg"),
            msg("ig_jelena","assistant","Dobar dan Jelena! Odlično iskustvo. Imamo otvorenu poziciju kuvara u restoranu u centru Beograda. Koja je vaša specijalnost?",td(4,43),"instagram","Jelena Popović","https://randomuser.me/api/portraits/women/35.jpg"),
            msg("ig_jelena","user","Mediteranska i italijanska kuhinja uglavnom",td(4,40),"instagram","Jelena Popović","https://randomuser.me/api/portraits/women/35.jpg"),
            msg("ig_jelena","assistant","Savršeno! Restoran traži upravo to. Plata 90.000 din + bonusi. Da li vas zanima formalni razgovor?",td(4,38),"instagram","Jelena Popović","https://randomuser.me/api/portraits/women/35.jpg"),
            msg("ig_jelena","user","Da apsolutno! Kada i gde?",td(4,35),"instagram","Jelena Popović","https://randomuser.me/api/portraits/women/35.jpg"),
        ]},
        { id: "ig_maja", platform: "instagram", name: "Maja Stanković", pic: "https://randomuser.me/api/portraits/women/42.jpg", humanNeeded: false, phone: null, msgs: [
            msg("ig_maja","user","Zdravo, završila sam turizam, tražim posao u hotelu",td(3,15),"instagram","Maja Stanković","https://randomuser.me/api/portraits/women/42.jpg"),
            msg("ig_maja","assistant","Zdravo Maja! Imamo otvorene pozicije u hotelima u Beogradu i na Zlatiboru. Šta preferirate?",td(3,13),"instagram","Maja Stanković","https://randomuser.me/api/portraits/women/42.jpg"),
            msg("ig_maja","user","Zlatibor bi bio super, obožavam planinu 🏔️",td(3,10),"instagram","Maja Stanković","https://randomuser.me/api/portraits/women/42.jpg"),
            msg("ig_maja","assistant","Divno! Imamo poziciju na recepciji hotela 4* na Zlatiboru, plata 65.000 + smeštaj uključen. Zanima vas?",td(3,8),"instagram","Maja Stanković","https://randomuser.me/api/portraits/women/42.jpg"),
            msg("ig_maja","user","Da, apsolutno! Kada može razgovor?",td(3,5),"instagram","Maja Stanković","https://randomuser.me/api/portraits/women/42.jpg"),
        ]},
        { id: "ig_filip", platform: "instagram", name: "Filip Radović", pic: "https://randomuser.me/api/portraits/men/9.jpg", humanNeeded: false, phone: null, msgs: [
            msg("ig_filip","user","Ima li posla promotera vikendum, student sam",yd(14,20),"instagram","Filip Radović","https://randomuser.me/api/portraits/men/9.jpg"),
            msg("ig_filip","assistant","Zdravo Filip! Da, vikend promoteri su nam uvek potrebni. Plata 3.500 din po danu. Imaš li iskustvo?",yd(14,18),"instagram","Filip Radović","https://randomuser.me/api/portraits/men/9.jpg"),
            msg("ig_filip","user","Imam, radio sam prošle godine na sličnom, super mi je bilo",yd(14,15),"instagram","Filip Radović","https://randomuser.me/api/portraits/men/9.jpg"),
            msg("ig_filip","assistant","Super! Upisujem te u bazu. Kada možeš da počneš?",yd(14,13),"instagram","Filip Radović","https://randomuser.me/api/portraits/men/9.jpg"),
        ]},
        { id: "ig_ivan", platform: "instagram", name: "Ivan Marković", pic: "https://randomuser.me/api/portraits/men/24.jpg", humanNeeded: false, phone: null, msgs: [
            msg("ig_ivan","user","Tražim posao obezbeđenja, imam licencu",yd(18,30),"instagram","Ivan Marković","https://randomuser.me/api/portraits/men/24.jpg"),
            msg("ig_ivan","assistant","Zdravo Ivan! Sa licencom imate prednost. Imamo pozicije u tržnim centrima i bankama. Da li preferirate stacionarno ili mobilno obezbeđenje?",yd(18,28),"instagram","Ivan Marković","https://randomuser.me/api/portraits/men/24.jpg"),
            msg("ig_ivan","user","Stacionarno, TC ili slično",yd(18,25),"instagram","Ivan Marković","https://randomuser.me/api/portraits/men/24.jpg"),
            msg("ig_ivan","assistant","Razumem. Imamo poziciju u Delta City-ju, 12h smene, plata 78.000. Interesuje vas?",yd(18,23),"instagram","Ivan Marković","https://randomuser.me/api/portraits/men/24.jpg"),
        ]},
        // WhatsApp (5 = 33%)
        { id: "wa_ana", platform: "whatsapp", name: "Ana Đorđević", pic: "https://randomuser.me/api/portraits/women/44.jpg", humanNeeded: false, phone: "064/987-654", msgs: [
            msg("wa_ana","user","Pozdrav, tražim posao konobarice, ima li nešto u Beogradu?",td(5,0),"whatsapp","Ana Đorđević","https://randomuser.me/api/portraits/women/44.jpg"),
            msg("wa_ana","assistant","Zdravo Ana! Da, imamo više otvorenih pozicija. Da li preferirate dnevnu ili noćnu smenu?",td(4,58),"whatsapp","Ana Đorđević","https://randomuser.me/api/portraits/women/44.jpg"),
            msg("wa_ana","user","Dnevnu, od 8 do 16 ili 12 do 20",td(4,55),"whatsapp","Ana Đorđević","https://randomuser.me/api/portraits/women/44.jpg"),
            msg("wa_ana","assistant","Imamo poziciju u kafiću na Vračaru, plata 58.000 + napojnice. Zainteresovana?",td(4,53),"whatsapp","Ana Đorđević","https://randomuser.me/api/portraits/women/44.jpg"),
            msg("wa_ana","user","Da, veoma zainteresovana! Kako da se prijavim?",td(4,50),"whatsapp","Ana Đorđević","https://randomuser.me/api/portraits/women/44.jpg"),
            msg("wa_ana","assistant","Pošalji mi broj telefona i kada možeš na razgovor — koordinator će te kontaktirati. 👍",td(4,48),"whatsapp","Ana Đorđević","https://randomuser.me/api/portraits/women/44.jpg"),
        ]},
        { id: "wa_nikola", platform: "whatsapp", name: "Nikola Stojanović", pic: "https://randomuser.me/api/portraits/men/12.jpg", humanNeeded: false, phone: null, msgs: [
            msg("wa_nikola","user","Imam 20 god i studiram, da li postoji nešto pola radnog vremena?",td(4,30),"whatsapp","Nikola Stojanović","https://randomuser.me/api/portraits/men/12.jpg"),
            msg("wa_nikola","assistant","Zdravo Nikola! Za studente imamo odlične opcije — promoter, magacioner ili konobar, sve sa fleksibilnim rasporedom. Šta te zanima?",td(4,28),"whatsapp","Nikola Stojanović","https://randomuser.me/api/portraits/men/12.jpg"),
            msg("wa_nikola","user","Magacioner mi zvuči dobro, kolika je plata?",td(4,25),"whatsapp","Nikola Stojanović","https://randomuser.me/api/portraits/men/12.jpg"),
            msg("wa_nikola","assistant","Za pola radnog vremena oko 40.000 din. Smene po dogovoru. Zainteresovan si?",td(4,23),"whatsapp","Nikola Stojanović","https://randomuser.me/api/portraits/men/12.jpg"),
            msg("wa_nikola","user","Da, zainteresovan sam! Kako da počnem?",td(4,20),"whatsapp","Nikola Stojanović","https://randomuser.me/api/portraits/men/12.jpg"),
            msg("wa_nikola","assistant","Odlično! Pošalji mi kontakt i slobodne termine — sve je brzo i jednostavno. 🎓",td(4,18),"whatsapp","Nikola Stojanović","https://randomuser.me/api/portraits/men/12.jpg"),
        ]},
        { id: "wa_tamara", platform: "whatsapp", name: "Tamara Milošević", pic: "https://randomuser.me/api/portraits/women/61.jpg", humanNeeded: false, phone: "061/555-789", msgs: [
            msg("wa_tamara","user","Zdravo, tražim posao recepcionerke, imam iskustvo u hotelu 2 godine",td(3,45),"whatsapp","Tamara Milošević","https://randomuser.me/api/portraits/women/61.jpg"),
            msg("wa_tamara","assistant","Zdravo Tamara! Odlično! Imamo poziciju recepcionerke u centru Beograda. Govorite li engleski?",td(3,43),"whatsapp","Tamara Milošević","https://randomuser.me/api/portraits/women/61.jpg"),
            msg("wa_tamara","user","Da, engleski i nemački",td(3,40),"whatsapp","Tamara Milošević","https://randomuser.me/api/portraits/women/61.jpg"),
            msg("wa_tamara","assistant","Sjajno! Sa nemačkim imate veliku prednost. Pozicija je u 4★ hotelu, plata 68.000. Prijavila bih vas?",td(3,38),"whatsapp","Tamara Milošević","https://randomuser.me/api/portraits/women/61.jpg"),
            msg("wa_tamara","user","Da molim! Prijavila bih se odmah!",td(3,35),"whatsapp","Tamara Milošević","https://randomuser.me/api/portraits/women/61.jpg"),
            msg("wa_tamara","assistant","Odlično Tamara! Vaš profil je zabeležen. Očekujte poziv koordinatora danas poslepodne. ✅",td(3,33),"whatsapp","Tamara Milošević","https://randomuser.me/api/portraits/women/61.jpg"),
        ]},
        { id: "wa_luka", platform: "whatsapp", name: "Luka Đurić", pic: "https://randomuser.me/api/portraits/men/77.jpg", humanNeeded: false, phone: null, msgs: [
            msg("wa_luka","user","Pozdrav, tražim posao barmena, Beograd",td(2,30),"whatsapp","Luka Đurić","https://randomuser.me/api/portraits/men/77.jpg"),
            msg("wa_luka","assistant","Zdravo Luka! Imamo više otvorenih pozicija za barmena u Beogradu. Imate li iskustvo?",td(2,28),"whatsapp","Luka Đurić","https://randomuser.me/api/portraits/men/77.jpg"),
            msg("wa_luka","user","Da, 3 godine u nekoliko kafića. Mogu li se prijavim odmah?",td(2,25),"whatsapp","Luka Đurić","https://randomuser.me/api/portraits/men/77.jpg"),
            msg("wa_luka","assistant","Naravno! Pošalji mi kontakt podatke i slobodne termine za razgovor.",td(2,23),"whatsapp","Luka Đurić","https://randomuser.me/api/portraits/men/77.jpg"),
        ]},
        { id: "wa_nina", platform: "whatsapp", name: "Nina Vasić", pic: "https://randomuser.me/api/portraits/women/5.jpg", humanNeeded: false, phone: null, msgs: [
            msg("wa_nina","user","Zdravo, tražim posao u prodaji",td(1,45),"whatsapp","Nina Vasić","https://randomuser.me/api/portraits/women/5.jpg"),
            msg("wa_nina","assistant","Zdravo Nina! Imamo pozicije u maloprodaji i B2B prodaji. Imate li iskustvo?",td(1,43),"whatsapp","Nina Vasić","https://randomuser.me/api/portraits/women/5.jpg"),
            msg("wa_nina","user","Da, 2 godine u prodavnici obuće",td(1,40),"whatsapp","Nina Vasić","https://randomuser.me/api/portraits/women/5.jpg"),
            msg("wa_nina","assistant","Odlično! Imamo poziciju prodajnog asistenta u Zara (TC Ušće), plata 65.000 + provizija. Zanima?",td(1,38),"whatsapp","Nina Vasić","https://randomuser.me/api/portraits/women/5.jpg"),
            msg("wa_nina","user","Da zanima! Ima li brza procedura?",td(1,35),"whatsapp","Nina Vasić","https://randomuser.me/api/portraits/women/5.jpg"),
        ]},
        // Facebook (2 = 13%)
        { id: "fb_milica", platform: "facebook", name: "Milica Jovanović", pic: "https://randomuser.me/api/portraits/women/23.jpg", humanNeeded: false, phone: null, msgs: [
            msg("fb_milica","user","Ima li posla za kasirku, Zemun?",td(4,10),"facebook","Milica Jovanović","https://randomuser.me/api/portraits/women/23.jpg"),
            msg("fb_milica","assistant","Zdravo Milica! Da, imamo otvorenu poziciju kasirke u Zemunu, plata 62.000 din, puno radno vreme. Da li vas zanima?",td(4,8),"facebook","Milica Jovanović","https://randomuser.me/api/portraits/women/23.jpg"),
            msg("fb_milica","user","Zanima, šta je potrebno od dokumenata?",td(4,5),"facebook","Milica Jovanović","https://randomuser.me/api/portraits/women/23.jpg"),
            msg("fb_milica","assistant","Potrebna je lična karta, zdravstvena knjižica i diploma srednje škole. Da li ih posedujete?",td(4,3),"facebook","Milica Jovanović","https://randomuser.me/api/portraits/women/23.jpg"),
            msg("fb_milica","user","Sve imam, kad mogu da dođem na razgovor?",td(4,0),"facebook","Milica Jovanović","https://randomuser.me/api/portraits/women/23.jpg"),
        ]},
        { id: "fb_sara", platform: "facebook", name: "Sara Simić", pic: "https://randomuser.me/api/portraits/women/18.jpg", humanNeeded: false, phone: null, msgs: [
            msg("fb_sara","user","Potreban mi je kancelarijski posao, šta imate?",yd(16,5),"facebook","Sara Simić","https://randomuser.me/api/portraits/women/18.jpg"),
            msg("fb_sara","assistant","Zdravo Sara! Imamo administrativne pozicije u više firmi. Koliko imate iskustva i koje programe koristite?",yd(16,3),"facebook","Sara Simić","https://randomuser.me/api/portraits/women/18.jpg"),
            msg("fb_sara","user","1 godina, Word, Excel i Outlook",yd(16,0),"facebook","Sara Simić","https://randomuser.me/api/portraits/women/18.jpg"),
            msg("fb_sara","assistant","Odlično! Pozicija administratora u Novom Beogradu, plata 58.000. Zanima?",yd(15,57),"facebook","Sara Simić","https://randomuser.me/api/portraits/women/18.jpg"),
        ]},
        // Website (2 = 13%)
        { id: "web_aleksandar", platform: "website", name: "Aleksandar Lukić", pic: "https://randomuser.me/api/portraits/men/55.jpg", humanNeeded: false, phone: null, msgs: [
            msg("web_aleksandar","user","Interesuje me posao u logistici, vozač ili koordinator",td(2,0),"website","Aleksandar Lukić","https://randomuser.me/api/portraits/men/55.jpg"),
            msg("web_aleksandar","assistant","Zdravo Aleksandar! Imamo obe pozicije. Vozač — 75.000 din, koordinator — 85.000 din. Imate li vozačku dozvolu B ili C kategorije?",td(1,58),"website","Aleksandar Lukić","https://randomuser.me/api/portraits/men/55.jpg"),
            msg("web_aleksandar","user","Da, B i C kategorija, 8 godina iskustva",td(1,55),"website","Aleksandar Lukić","https://randomuser.me/api/portraits/men/55.jpg"),
            msg("web_aleksandar","assistant","Odlično! C kategorija otvara mnoge opcije. Da li preferirate lokalni ili međunarodni prevoz?",td(1,53),"website","Aleksandar Lukić","https://randomuser.me/api/portraits/men/55.jpg"),
            msg("web_aleksandar","user","Lokalni, imam porodicu",td(1,50),"website","Aleksandar Lukić","https://randomuser.me/api/portraits/men/55.jpg"),
            msg("web_aleksandar","assistant","Razumem! Imam savršenu poziciju za vas — lokalni vozač, Beograd zona, kući svaki dan. Šaljemo vam detalje. 🚚",td(1,48),"website","Aleksandar Lukić","https://randomuser.me/api/portraits/men/55.jpg"),
        ]},
        { id: "web_danilo", platform: "website", name: "Danilo Bogdanović", pic: "https://randomuser.me/api/portraits/men/88.jpg", humanNeeded: false, phone: null, msgs: [
            msg("web_danilo","user","Tražim posao dostavljača, imam sopstveni auto",td(1,15),"website","Danilo Bogdanović","https://randomuser.me/api/portraits/men/88.jpg"),
            msg("web_danilo","assistant","Zdravo Danilo! Odlično! Sa sopstvenim vozilom imate više opcija — dostava hrane, paketa ili medicinski materijal. Šta vas zanima?",td(1,13),"website","Danilo Bogdanović","https://randomuser.me/api/portraits/men/88.jpg"),
            msg("web_danilo","user","Hrana ili paketi, šta bolje plaća?",td(1,10),"website","Danilo Bogdanović","https://randomuser.me/api/portraits/men/88.jpg"),
            msg("web_danilo","assistant","Paketi generalno 72.000 mesečno fiksno, dostava hrane 55.000 + % od narudžbina. Šta preferirate?",td(1,8),"website","Danilo Bogdanović","https://randomuser.me/api/portraits/men/88.jpg"),
            msg("web_danilo","user","Paketi, fiksno je bolje za planiranje",td(1,5),"website","Danilo Bogdanović","https://randomuser.me/api/portraits/men/88.jpg"),
            msg("web_danilo","assistant","Odlična odluka! Imam poziciju kod DHL-a u Beogradu. Da li imate vozačku dozvolu B kategorije?",td(1,3),"website","Danilo Bogdanović","https://randomuser.me/api/portraits/men/88.jpg"),
        ]},
    ]

    const allMessages: any[] = []
    const conversations: any[] = []

    for (const def of convDefs) {
        const sorted = [...def.msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const visible = sorted.filter(m => m.role !== "system")
        const conv = {
            id: def.id, leadId: null, messages: def.msgs, platform: def.platform,
            candidateName: def.name, humanNeeded: def.humanNeeded, phone: def.phone,
            profilePic: def.pic, lastMessage: sorted[0], lastVisibleMessage: visible[0] || sorted[0],
        }
        conversations.push(conv)
        allMessages.push(...def.msgs)
    }

    conversations.sort((a, b) => new Date(b.lastVisibleMessage.created_at).getTime() - new Date(a.lastVisibleMessage.created_at).getTime())

    return { conversations, allMessages }
}

// ── Bookstore demo conversations ───────────────────────────────────────────────
// Used as fallback when a bookstore client has no real conversations yet
const PUBLIK_ID  = "bd12eb98-e62a-4a87-b620-a9881081449b"
const STELA_ID   = "d7337d00-db70-46c3-828b-e9ac82e21717"

// Per-brand 30-day baseline stats for demo mode
// Ratio poruke/upiti ≈ 4.1 (realistic for DM sales: question → answer → follow-up → close)
const BRAND_DEMO_STATS: Record<string, { upiti: number; konverzije: number; poruke: number }> = {
    "255db627-c62b-44ce-a9dc-3a7e90dd1b67": { upiti: 83,  konverzije: 24, poruke: 341 }, // Harmonija Knjige
    "bd12eb98-e62a-4a87-b620-a9881081449b": { upiti: 61,  konverzije: 17, poruke: 247 }, // Publik Praktikum
    "d7337d00-db70-46c3-828b-e9ac82e21717": { upiti: 52,  konverzije: 15, poruke: 208 }, // Stela Knjige
    "c29e88ad-ee07-44ae-93bb-886f850b6d02": { upiti: 196, konverzije: 56, poruke: 796 }, // Harmonija Group (svi brendovi)
}

function generateBookstoreDemoData(clientId?: string): ReturnType<typeof generateMockData> {
    const CID = "demo_bookstore"
    const ms = (id: string, role: string, text: string, ts: string, platform: string, name: string, pic: string, extra?: any) => ({
        id: `${id}-${role}-${ts}`, id_razgovora: id, role, message: text,
        metadata: { name, profile_pic: pic, ...extra }, platform, client_id: CID, created_at: ts,
    })
    const t = (hoursBack: number, minutesBack = 0) => {
        const d = new Date()
        d.setHours(d.getHours() - hoursBack, d.getMinutes() - minutesBack, 0, 0)
        return d.toISOString()
    }

    // ── Publik Praktikum — children's books, parents as customers ─────────────
    const publikConvDefs = [
        { id: "pp_ig_jelena", platform: "instagram", name: "Jelena Marinović", pic: "https://randomuser.me/api/portraits/women/33.jpg", humanNeeded: false, phone: null, msgs: [
            ms("pp_ig_jelena","user","Zdravo, tražim slikovnicu za ćerku od 3 godine koja upravo uči slova",t(1,30),"instagram","Jelena Marinović","https://randomuser.me/api/portraits/women/33.jpg"),
            ms("pp_ig_jelena","assistant","Zdravo Jelena! Za uzrast 3 godine koji uči slova, preporučujem 'Piši-briši: Azbuka' — interaktivna tabla sa markerom, dete vežba pisanje slova bez papira. Ima i verziju sa brojevima. Obe su na stanju 😊",t(1,28),"instagram","Jelena Marinović","https://randomuser.me/api/portraits/women/33.jpg"),
            ms("pp_ig_jelena","user","Super! I da li imate nešto sa zvukovima ili pop-up stranicama?",t(1,15),"instagram","Jelena Marinović","https://randomuser.me/api/portraits/women/33.jpg"),
            ms("pp_ig_jelena","assistant","Da! 'Priča sa iskakalicama: Šuma' je hit za taj uzrast — svaka stranica ima pop-up likove. Za zvukove imamo 'Moje prve reči sa zvukom' — pritisneš dugme, čuješ reč. Šaljem vam linkove za obe 📚",t(1,13),"instagram","Jelena Marinović","https://randomuser.me/api/portraits/women/33.jpg"),
        ]},
        { id: "pp_ig_dragan", platform: "instagram", name: "Dragan Tomić", pic: "https://randomuser.me/api/portraits/men/47.jpg", humanNeeded: true, phone: "+381641112233", msgs: [
            ms("pp_ig_dragan","user","Naručio sam 3 knjige za sina, stigle su ali jedna je pocepana na koricama pri isporuci",t(3,20),"instagram","Dragan Tomić","https://randomuser.me/api/portraits/men/47.jpg"),
            ms("pp_ig_dragan","assistant","Dragan, žao mi je što se to desilo — nije prihvatljivo. Prosleđujem vaš slučaj timu odmah. Možete li mi dati broj narudžbine ili email da ubrzamo zamenu?",t(3,18),"instagram","Dragan Tomić","https://randomuser.me/api/portraits/men/47.jpg"),
            ms("pp_ig_dragan","user","dragan.tomic@gmail.com, narudžbina od juče",t(3,10),"instagram","Dragan Tomić","https://randomuser.me/api/portraits/men/47.jpg"),
            ms("pp_ig_dragan","system","[HUMAN_NEEDED]",t(3,9),"instagram","Dragan Tomić","https://randomuser.me/api/portraits/men/47.jpg",{ human_needed: true }),
        ]},
        { id: "pp_fb_vesna", platform: "facebook", name: "Vesna Đorđević", pic: "https://randomuser.me/api/portraits/women/61.jpg", humanNeeded: false, phone: null, msgs: [
            ms("pp_fb_vesna","user","Dobar dan, tražim poklon za unuku od 6 godina koja voli životinje",t(5,0),"facebook","Vesna Đorđević","https://randomuser.me/api/portraits/women/61.jpg"),
            ms("pp_fb_vesna","assistant","Dobar dan! Za devojčicu od 6 koja voli životinje, idealna je 'Dinozauri: Velika enciklopedija' — bogato ilustrovana, stranice su debele. Ili 'Životinje sveta sa mapom' — interaktivna, uči kontinente kroz životinje. Obe su odlični pokloni 🎁",t(4,58),"facebook","Vesna Đorđević","https://randomuser.me/api/portraits/women/61.jpg"),
            ms("pp_fb_vesna","user","Sviđa mi se ona sa mapom! Može li da stigne do petka?",t(4,45),"facebook","Vesna Đorđević","https://randomuser.me/api/portraits/women/61.jpg"),
            ms("pp_fb_vesna","assistant","Za narudžbine do sutra u podne dostava stiže do petka. Naručite na publikpraktikum.rs ili mi ostavite email pa vam šaljem direktan link 📦",t(4,43),"facebook","Vesna Đorđević","https://randomuser.me/api/portraits/women/61.jpg"),
        ]},
        { id: "pp_wa_marija", platform: "whatsapp", name: "Marija Stanković", pic: "https://randomuser.me/api/portraits/women/71.jpg", humanNeeded: false, phone: "marija.stankovic@os.edu.rs", msgs: [
            ms("pp_wa_marija","user","Zdravo, ja sam učiteljica prvog razreda. Da li imate popust za narudžbinu od 20-25 knjiga za učionicu?",t(7,0),"whatsapp","Marija Stanković","https://randomuser.me/api/portraits/women/71.jpg"),
            ms("pp_wa_marija","assistant","Zdravo Marija! Za školske/grupne narudžbine od 20+ primeraka možemo dogovoriti popust. Koji naslovi vas zanimaju — čitanke, bojanka, enciklopedije?",t(6,55),"whatsapp","Marija Stanković","https://randomuser.me/api/portraits/women/71.jpg"),
            ms("pp_wa_marija","user","Uglavnom piši-briši table i bojanke za kraj godine. marija.stankovic@os.edu.rs",t(6,48),"whatsapp","Marija Stanković","https://randomuser.me/api/portraits/women/71.jpg"),
            ms("pp_wa_marija","assistant","Odlično! Šaljem vam na email kompletnu ponudu za školski popust do kraja dana. Hvala Marija 📚",t(6,45),"whatsapp","Marija Stanković","https://randomuser.me/api/portraits/women/71.jpg"),
        ]},
        { id: "pp_web_ivana", platform: "website", name: "Ivana Petrović", pic: "https://randomuser.me/api/portraits/women/82.jpg", humanNeeded: false, phone: null, msgs: [
            ms("pp_web_ivana","user","Da li je 'Piši-briši: Dinozauri' trenutno na stanju?",t(1,0),"website","Ivana Petrović","https://randomuser.me/api/portraits/women/82.jpg"),
            ms("pp_web_ivana","assistant","Zdravo! Da, 'Piši-briši: Dinozauri' je na stanju — cena je 990 din. Ima i 'Piši-briši: Azbuka' i 'Piši-briši: Brojevi' ako vas zanima komplet. Naručite direktno na sajtu ili vam šaljem link 😊",t(0,58),"website","Ivana Petrović","https://randomuser.me/api/portraits/women/82.jpg"),
            ms("pp_web_ivana","user","Savršeno, hvala! Koliko dana dostava do Kragujevca?",t(0,50),"website","Ivana Petrović","https://randomuser.me/api/portraits/women/82.jpg"),
            ms("pp_web_ivana","assistant","Do Kragujevca BEX Express isporučuje za 2-3 radna dana. Za narudžbine do 14h danas, možete očekivati pakete do četvrtka 📦",t(0,48),"website","Ivana Petrović","https://randomuser.me/api/portraits/women/82.jpg"),
        ]},
        { id: "pp_web_nikola", platform: "website", name: "Nikola Rašić", pic: "https://randomuser.me/api/portraits/men/63.jpg", humanNeeded: true, phone: "+381642223344", msgs: [
            ms("pp_web_nikola","user","Primio sam pogrešnu knjigu — naručio sam 'Dinozauri velika enciklopedija' a u paketu je bila neka bojanka",t(0,20),"website","Nikola Rašić","https://randomuser.me/api/portraits/men/63.jpg"),
            ms("pp_web_nikola","assistant","Nikola, izvinjavam se zbog greške u isporuci — to ne bi smelo da se desi. Prosleđujem odmah timu za zamenu. Koji je vaš email ili broj narudžbine?",t(0,18),"website","Nikola Rašić","https://randomuser.me/api/portraits/men/63.jpg"),
            ms("pp_web_nikola","user","nikola.rasic@gmail.com",t(0,15),"website","Nikola Rašić","https://randomuser.me/api/portraits/men/63.jpg"),
            ms("pp_web_nikola","system","[HUMAN_NEEDED]",t(0,14),"website","Nikola Rašić","https://randomuser.me/api/portraits/men/63.jpg",{ human_needed: true }),
        ]},
        // Instagram — school reading list, 5-message back-and-forth
        { id: "pp_ig_stefan", platform: "instagram", name: "Stefan Milošević", pic: "https://randomuser.me/api/portraits/men/34.jpg", humanNeeded: false, phone: null, msgs: [
            ms("pp_ig_stefan","user","Zdravo, sin mi ide u 2. razred — ima li set za lektiru i nešto za uvežbavanje slova?",t(28,10),"instagram","Stefan Milošević","https://randomuser.me/api/portraits/men/34.jpg"),
            ms("pp_ig_stefan","assistant","Zdravo Stefan! 📚 Za 2. razred, idealno: **Piši-briši: Azbuka** za slova i **Čarobna šuma** za lektiru — kratke priče baš za taj uzrast. Obe su na stanju 😊",t(28,8),"instagram","Stefan Milošević","https://randomuser.me/api/portraits/men/34.jpg"),
            ms("pp_ig_stefan","user","Super! A imate li popularne naslove koji su na lektirama beogradskih škola?",t(28,2),"instagram","Stefan Milošević","https://randomuser.me/api/portraits/men/34.jpg"),
            ms("pp_ig_stefan","assistant","Da! Najtraženiji za 2. razred: Deni Junak, Ježeva kućica, Plavi zec — sve imamo. Ostavite email pa vam šaljem kompletan spisak sa cenama 📚",t(27,58),"instagram","Stefan Milošević","https://randomuser.me/api/portraits/men/34.jpg"),
            ms("pp_ig_stefan","user","stefan.milosevic@gmail.com — hvala puno!",t(27,55),"instagram","Stefan Milošević","https://randomuser.me/api/portraits/men/34.jpg"),
            ms("pp_ig_stefan","assistant","Odlično, šaljem do sat vremena! Ugodan početak školske godine 😊",t(27,53),"instagram","Stefan Milošević","https://randomuser.me/api/portraits/men/34.jpg"),
        ]},
        // Facebook — twins gift, pricing calculated inline
        { id: "pp_fb_bojana", platform: "facebook", name: "Bojana Nedić", pic: "https://randomuser.me/api/portraits/women/45.jpg", humanNeeded: false, phone: null, msgs: [
            ms("pp_fb_bojana","user","Dobar dan! Tražim istu slikovnicu za blizance koji pune 5 godina. Ima li poklon pakovanje?",t(44,15),"facebook","Bojana Nedić","https://randomuser.me/api/portraits/women/45.jpg"),
            ms("pp_fb_bojana","assistant","Dobar dan Bojana! 🎁 Za blizance od 5 godina, savršena je **Životinje sveta sa mapom** — bogato ilustrovana, interaktivna. Uzimate 2 primerka i možemo oba u poklon pakovanje 😊",t(44,13),"facebook","Bojana Nedić","https://randomuser.me/api/portraits/women/45.jpg"),
            ms("pp_fb_bojana","user","Sjajno! Koliko bi sve to koštalo?",t(44,5),"facebook","Bojana Nedić","https://randomuser.me/api/portraits/women/45.jpg"),
            ms("pp_fb_bojana","assistant","2× knjiga = 2.380 din + poklon pakovanje 2× 150 din = **2.680 din** ukupno, a dostava je **besplatna** jer prelazite limit 🎉 Naručite na publikpraktikum.rs!",t(44,3),"facebook","Bojana Nedić","https://randomuser.me/api/portraits/women/45.jpg"),
            ms("pp_fb_bojana","user","bojana.nedic@gmail.com — savršeno, naručujem odmah!",t(43,55),"facebook","Bojana Nedić","https://randomuser.me/api/portraits/women/45.jpg"),
            ms("pp_fb_bojana","assistant","Odlično! Stiže u roku od 2-3 dana 📦 Srećan rođendan blizancima! 🎂",t(43,53),"facebook","Bojana Nedić","https://randomuser.me/api/portraits/women/45.jpg"),
        ]},
        // Website — quick stock check, fast conversion
        { id: "pp_web_nela", platform: "website", name: "Nela Jovanović", pic: "https://randomuser.me/api/portraits/women/19.jpg", humanNeeded: false, phone: null, msgs: [
            ms("pp_web_nela","user","Je li 'Piši-briši: Azbuka' trenutno na stanju?",t(52,0),"website","Nela Jovanović","https://randomuser.me/api/portraits/women/19.jpg"),
            ms("pp_web_nela","assistant","Zdravo! Da, na stanju — 890 din 😊 direktan link: publikpraktikum.rs/proizvod/pisi-brise-azbuka",t(51,58),"website","Nela Jovanović","https://randomuser.me/api/portraits/women/19.jpg"),
            ms("pp_web_nela","user","Naručila sam, hvala!",t(51,45),"website","Nela Jovanović","https://randomuser.me/api/portraits/women/19.jpg"),
            ms("pp_web_nela","assistant","Sjajno! BEX Express 2-3 radna dana 📦 Prijatno čitanje malim čitačima!",t(51,44),"website","Nela Jovanović","https://randomuser.me/api/portraits/women/19.jpg"),
        ]},
    ]

    // ── Stela Knjige — adult fiction, romance, thriller ───────────────────────
    const stelaConvDefs = [
        { id: "sk_ig_aleksandra", platform: "instagram", name: "Aleksandra Vuković", pic: "https://randomuser.me/api/portraits/women/26.jpg", humanNeeded: false, phone: null, msgs: [
            ms("sk_ig_aleksandra","user","Čitala sam 'Ugly Love' i bila sam oduševljena. Šta biste preporučili sledeće od Colleen Hoover?",t(2,10),"instagram","Aleksandra Vuković","https://randomuser.me/api/portraits/women/26.jpg"),
            ms("sk_ig_aleksandra","assistant","Odlično — Ugly Love je klasik 🖤 Sledeće svakako 'It Ends with Us' — emotivno najjača od svih njenih knjiga. Posle toga 'Verity' ako voliš psihološki triler, pa 'November 9'. Sve tri imamo na stanju.",t(2,8),"instagram","Aleksandra Vuković","https://randomuser.me/api/portraits/women/26.jpg"),
            ms("sk_ig_aleksandra","user","It Ends with Us je već na mojoj listi! Šta je sa 'Reminders of Him'?",t(2,0),"instagram","Aleksandra Vuković","https://randomuser.me/api/portraits/women/26.jpg"),
            ms("sk_ig_aleksandra","assistant","'Reminders of Him' je divna — tužna ali lepa priča o iskupljenju. Imamo je na stanju, 1.390 din. Da li biste uzeli više naslova — kombinujte za besplatnu dostavu 📦",t(1,58),"instagram","Aleksandra Vuković","https://randomuser.me/api/portraits/women/26.jpg"),
        ]},
        { id: "sk_ig_mila", platform: "instagram", name: "Mila Đorđević", pic: "https://randomuser.me/api/portraits/women/38.jpg", humanNeeded: false, phone: null, msgs: [
            ms("sk_ig_mila","user","Koji je redosled čitanja Stieg Larsson 'Milenijum' trilogije?",t(4,5),"instagram","Mila Đorđević","https://randomuser.me/api/portraits/women/38.jpg"),
            ms("sk_ig_mila","assistant","Redosled je: 1. 'Muškarci koji mrze žene', 2. 'Devojka koja se igrala vatrom', 3. 'Zamak od peska koji se srušio'. Sve tri imamo, mogu se naručiti kao komplet sa popustom 🕵️",t(4,3),"instagram","Mila Đorđević","https://randomuser.me/api/portraits/women/38.jpg"),
            ms("sk_ig_mila","user","Ima li komplet u ponudi, koliko košta?",t(3,50),"instagram","Mila Đorđević","https://randomuser.me/api/portraits/women/38.jpg"),
            ms("sk_ig_mila","assistant","Komplet sve tri knjige je 3.990 din (umesto 4.470 din pojedinačno). Dostava besplatna jer prelazi limit. Naručite na stelaknjige.rs ili ostavite email 📚",t(3,48),"instagram","Mila Đorđević","https://randomuser.me/api/portraits/women/38.jpg"),
        ]},
        { id: "sk_fb_sandra", platform: "facebook", name: "Sandra Kovačević", pic: "https://randomuser.me/api/portraits/women/57.jpg", humanNeeded: false, phone: null, msgs: [
            ms("sk_fb_sandra","user","Tražim poklon za drugaricu koja voli dark romance, ima 28 godina",t(6,0),"facebook","Sandra Kovačević","https://randomuser.me/api/portraits/women/57.jpg"),
            ms("sk_fb_sandra","assistant","Za ljubiteljicu dark romancea, top izbori: 'Twisted Love' (Ana Huang) — intenzivna ljubavna priča sa bodyguard dinamikom, 'Haunting Adeline' — za hrabrije čitaoce, 'Ugly Love' (Colleen Hoover) — klasik žanra. Sve tri imamo 🖤",t(5,58),"facebook","Sandra Kovačević","https://randomuser.me/api/portraits/women/57.jpg"),
            ms("sk_fb_sandra","user","Twisted Love zvuči savršeno! Da li može poklon pakovanje?",t(5,45),"facebook","Sandra Kovačević","https://randomuser.me/api/portraits/women/57.jpg"),
            ms("sk_fb_sandra","assistant","Nudimo poklon pakovanje uz narudžbinu — napomenite u komentaru pri naručivanju. Naručite na stelaknjige.rs ili mi ostavite email 🎁",t(5,43),"facebook","Sandra Kovačević","https://randomuser.me/api/portraits/women/57.jpg"),
        ]},
        { id: "sk_wa_tamara", platform: "whatsapp", name: "Tamara Ilić", pic: "https://randomuser.me/api/portraits/women/44.jpg", humanNeeded: false, phone: null, msgs: [
            ms("sk_wa_tamara","user","Da li ćete imati 'Twisted Lies' od Ane Huang? Videla sam da izlazi uskoro u prevodu",t(8,0),"whatsapp","Tamara Ilić","https://randomuser.me/api/portraits/women/44.jpg"),
            ms("sk_wa_tamara","assistant","Zdravo Tamara! 'Twisted Lies' je u planu — čekamo potvrdu datuma isporuke. Ako ostaviš email, obaveštavamo te čim bude dostupna i možeš da je rezervišeš 📖",t(7,55),"whatsapp","Tamara Ilić","https://randomuser.me/api/portraits/women/44.jpg"),
            ms("sk_wa_tamara","user","tamara.ilic@gmail.com — super, hvala!",t(7,48),"whatsapp","Tamara Ilić","https://randomuser.me/api/portraits/women/44.jpg"),
            ms("sk_wa_tamara","assistant","Upisana si na listu čekanja 🖤 Javljamo se čim stigne. Do tada, imaš li nešto drugo na listi — može biti da imamo već u stanju?",t(7,46),"whatsapp","Tamara Ilić","https://randomuser.me/api/portraits/women/44.jpg"),
        ]},
        { id: "sk_web_bojana", platform: "website", name: "Bojana Stefanović", pic: "https://randomuser.me/api/portraits/women/91.jpg", humanNeeded: false, phone: null, msgs: [
            ms("sk_web_bojana","user","Da li prodajete i e-knjige, ili samo fizičke?",t(0,45),"website","Bojana Stefanović","https://randomuser.me/api/portraits/women/91.jpg"),
            ms("sk_web_bojana","assistant","Zdravo Bojana! Za sada nudimo samo fizičke knjige — e-knjige trenutno nisu u ponudi. Dostava je brza, BEX Express 1-3 radna dana 📦 Da li tražite neki određeni naslov?",t(0,43),"website","Bojana Stefanović","https://randomuser.me/api/portraits/women/91.jpg"),
            ms("sk_web_bojana","user","Tražila sam 'It Ends with Us', ali ok ako je samo fizička. Koliko košta dostava?",t(0,35),"website","Bojana Stefanović","https://randomuser.me/api/portraits/women/91.jpg"),
            ms("sk_web_bojana","assistant","'It Ends with Us' je na stanju — 1.490 din. Dostava je 350 din, besplatna za narudžbine iznad 2.500 din. Naručite direktno na stelaknjige.rs 📚",t(0,33),"website","Bojana Stefanović","https://randomuser.me/api/portraits/women/91.jpg"),
        ]},
        { id: "sk_web_katarina", platform: "website", name: "Katarina Marković", pic: "https://randomuser.me/api/portraits/women/48.jpg", humanNeeded: true, phone: null, msgs: [
            ms("sk_web_katarina","user","Kupila sam 'November 9' i ima par stranica štampanih duplo, nedostaju stranice 78-82",t(0,15),"website","Katarina Marković","https://randomuser.me/api/portraits/women/48.jpg"),
            ms("sk_web_katarina","assistant","Katarina, izvinjavam se — štamparska greška nije prihvatljiva. Zamenjujemo odmah. Daj mi email i broj narudžbine pa ubrzamo.",t(0,13),"website","Katarina Marković","https://randomuser.me/api/portraits/women/48.jpg"),
            ms("sk_web_katarina","user","katarina.markovic@gmail.com",t(0,10),"website","Katarina Marković","https://randomuser.me/api/portraits/women/48.jpg"),
            ms("sk_web_katarina","system","[HUMAN_NEEDED]",t(0,9),"website","Katarina Marković","https://randomuser.me/api/portraits/women/48.jpg",{ human_needed: true }),
        ]},
        // Instagram — Gone Girl fan → buys 2 thrillers
        { id: "sk_ig_nikolina", platform: "instagram", name: "Nikolina Petrović", pic: "https://randomuser.me/api/portraits/women/32.jpg", humanNeeded: false, phone: null, msgs: [
            ms("sk_ig_nikolina","user","Čitala sam Gone Girl i bila opčinjena — šta slično imate?",t(15,20),"instagram","Nikolina Petrović","https://randomuser.me/api/portraits/women/32.jpg"),
            ms("sk_ig_nikolina","assistant","Zdravo! 🕵️ Ako te je Gone Girl uhvatila, top 2: **The Silent Patient** (Alex Michaelides) — psihološki triler sa šokantnim završetkom, i **Behind Closed Doors** — mračna tajna savršenog braka. Obje su na stanju 😊",t(15,18),"instagram","Nikolina Petrović","https://randomuser.me/api/portraits/women/32.jpg"),
            ms("sk_ig_nikolina","user","Zvuče savršeno! Koliko koštaju?",t(15,10),"instagram","Nikolina Petrović","https://randomuser.me/api/portraits/women/32.jpg"),
            ms("sk_ig_nikolina","assistant","The Silent Patient 1.390 din + Behind Closed Doors 1.290 din = **2.680 din** — dostava besplatna jer prelazite limit 📦",t(15,8),"instagram","Nikolina Petrović","https://randomuser.me/api/portraits/women/32.jpg"),
            ms("sk_ig_nikolina","user","Uzimam obe! Da li ima i Tana French?",t(15,3),"instagram","Nikolina Petrović","https://randomuser.me/api/portraits/women/32.jpg"),
            ms("sk_ig_nikolina","assistant","Da! Imamo **In the Woods** (Tana French) — 1.390 din 🕵️ Sve tri = 4.070 din, dostava besplatna. Naručite na stelaknjige.rs!",t(15,1),"instagram","Nikolina Petrović","https://randomuser.me/api/portraits/women/32.jpg"),
        ]},
        // Facebook — ACOTAR series inquiry, partial stock
        { id: "sk_fb_lena", platform: "facebook", name: "Lena Filipović", pic: "https://randomuser.me/api/portraits/women/55.jpg", humanNeeded: false, phone: null, msgs: [
            ms("sk_fb_lena","user","Imate li ACOTAR seriju od Sarah J. Maas? Zanima me ceo set",t(38,0),"facebook","Lena Filipović","https://randomuser.me/api/portraits/women/55.jpg"),
            ms("sk_fb_lena","assistant","Zdravo Lena! 📚 Imamo prva dva dela — **A Court of Thorns and Roses** i **A Court of Mist and Fury** na stanju. Treći deo je rasprodat, čekamo dopunu za 2 nedelje 😊",t(37,58),"facebook","Lena Filipović","https://randomuser.me/api/portraits/women/55.jpg"),
            ms("sk_fb_lena","user","Okej, uzimam prva dva za sada. Koliko košta komplet?",t(37,50),"facebook","Lena Filipović","https://randomuser.me/api/portraits/women/55.jpg"),
            ms("sk_fb_lena","assistant","2 knjige = 2.780 din, dostava besplatna 🎉 Naručite na stelaknjige.rs ili ostavite email pa vas obavestimo kad stigne treći deo!",t(37,48),"facebook","Lena Filipović","https://randomuser.me/api/portraits/women/55.jpg"),
            ms("sk_fb_lena","user","lena.filipovic@gmail.com — hvala, naručujem!",t(37,42),"facebook","Lena Filipović","https://randomuser.me/api/portraits/women/55.jpg"),
        ]},
        // WhatsApp — entry-level dark romance recommendation
        { id: "sk_wa_jovana", platform: "whatsapp", name: "Jovana Đurić", pic: "https://randomuser.me/api/portraits/women/66.jpg", humanNeeded: false, phone: null, msgs: [
            ms("sk_wa_jovana","user","Zdravo, tražim dark romance ali nešto za početak — nisam čitala žanr pre 🙂",t(62,5),"whatsapp","Jovana Đurić","https://randomuser.me/api/portraits/women/66.jpg"),
            ms("sk_wa_jovana","assistant","Zdravo Jovana! 🖤 Idealan uvod: **Twisted Love** (Ana Huang) — intenzivna hemija, nije previše mračno, sjajan ritam. Ili **It Ends with Us** (Colleen Hoover) — emocionalno jak ali pristupačan. Šta biraš?",t(62,3),"whatsapp","Jovana Đurić","https://randomuser.me/api/portraits/women/66.jpg"),
            ms("sk_wa_jovana","user","Twisted Love zvuči idealno! Ima li na stanju?",t(61,55),"whatsapp","Jovana Đurić","https://randomuser.me/api/portraits/women/66.jpg"),
            ms("sk_wa_jovana","assistant","Da, na stanju 🖤 1.390 din — naručite na stelaknjige.rs/proizvod/twisted-love. Nadam se da će ti se svideti!",t(61,53),"whatsapp","Jovana Đurić","https://randomuser.me/api/portraits/women/66.jpg"),
            ms("sk_wa_jovana","user","Naručila sam, hvala na preporuci! 😊",t(61,40),"whatsapp","Jovana Đurić","https://randomuser.me/api/portraits/women/66.jpg"),
            ms("sk_wa_jovana","assistant","Uživaj! 🖤 Kad završiš, ima još dobrih nastavaka u žanru — javi se kad budeš spremna za još 😄",t(61,39),"whatsapp","Jovana Đurić","https://randomuser.me/api/portraits/women/66.jpg"),
        ]},
    ]

    const convDefs = clientId === PUBLIK_ID ? publikConvDefs
        : clientId === STELA_ID ? stelaConvDefs
        : [
        // Instagram — book discovery + ordering question answered directly (no escalation)
        { id: "bs_ig_ana", platform: "instagram", name: "Ana Živković", pic: "https://randomuser.me/api/portraits/women/29.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_ig_ana","user","Zdravo 😊 da li imate Atomske navike na stanju?",t(2,20),"instagram","Ana Živković","https://randomuser.me/api/portraits/women/29.jpg"),
            ms("bs_ig_ana","assistant","Zdravo! 👋 Da, Atomske navike su na stanju — 1.490 din. Jedna od naših najprodavanijih! Direktan link: harmonijaknjige.rs/proizvod/atomske-navike 📖",t(2,18),"instagram","Ana Živković","https://randomuser.me/api/portraits/women/29.jpg"),
            ms("bs_ig_ana","user","Savršeno! Jel mogu odmah da naručim?",t(2,5),"instagram","Ana Živković","https://randomuser.me/api/portraits/women/29.jpg"),
            ms("bs_ig_ana","assistant","Naravno! 😊 Naručite direktno na harmonijaknjige.rs — izaberete dostavu, platite online, pakuje se isti dan. BEX Express 2-3 radna dana do vas 📦",t(2,3),"instagram","Ana Živković","https://randomuser.me/api/portraits/women/29.jpg"),
        ]},
        // Instagram — damaged book on delivery → HUMAN_NEEDED (correct escalation)
        { id: "bs_ig_milos", platform: "instagram", name: "Miloš Jevtić", pic: "https://randomuser.me/api/portraits/men/41.jpg", humanNeeded: true, phone: null, msgs: [
            ms("bs_ig_milos","user","Stigla mi knjiga ali korica je pocepana sa jedne strane pri isporuci",t(4,10),"instagram","Miloš Jevtić","https://randomuser.me/api/portraits/men/41.jpg"),
            ms("bs_ig_milos","assistant","Miloše, žao mi je — oštećena isporuka nije prihvatljiva 🙏 Prosleđujem odmah timu za reklamaciju i zamenu. Možeš li mi dati email ili broj narudžbine da ubrzamo?",t(4,8),"instagram","Miloš Jevtić","https://randomuser.me/api/portraits/men/41.jpg"),
            ms("bs_ig_milos","user","milos.jevtic87@gmail.com, narudžbina od prošle nedelje",t(4,5),"instagram","Miloš Jevtić","https://randomuser.me/api/portraits/men/41.jpg"),
            ms("bs_ig_milos","system","[HUMAN_NEEDED]",t(4,4),"instagram","Miloš Jevtić","https://randomuser.me/api/portraits/men/41.jpg",{ human_needed: true }),
        ]},
        // Facebook — mindfulness gift recommendation with direct product links
        { id: "bs_fb_zorana", platform: "facebook", name: "Zorana Blagojević", pic: "https://randomuser.me/api/portraits/women/52.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_fb_zorana","user","Dobar dan, tražim poklon za prijatelju koja se bavi meditacijom i duhovnim razvojem",t(6,15),"facebook","Zorana Blagojević","https://randomuser.me/api/portraits/women/52.jpg"),
            ms("bs_fb_zorana","assistant","Dobar dan! 🙏 Za nju su idealne dve knjige Ekharta Tolija: **Moć sadašnjeg trenutka** — harmonijaknjige.rs/proizvod/moc-sadasnjeg-trenutka i **Nova Zemlja** — harmonijaknjige.rs/proizvod/nova-zemlja. Obe su na stanju 😊",t(6,13),"facebook","Zorana Blagojević","https://randomuser.me/api/portraits/women/52.jpg"),
            ms("bs_fb_zorana","user","Savršeno! Uzimam Moć sadašnjeg trenutka. Koliko košta?",t(6,5),"facebook","Zorana Blagojević","https://randomuser.me/api/portraits/women/52.jpg"),
            ms("bs_fb_zorana","assistant","1.490 din 🙏 Naručite direktno na harmonijaknjige.rs/proizvod/moc-sadasnjeg-trenutka — dostava BEX Express 2-3 dana. Uz dve knjige poštarina je besplatna 📦",t(6,3),"facebook","Zorana Blagojević","https://randomuser.me/api/portraits/women/52.jpg"),
        ]},
        // WhatsApp — delivery time + price question answered directly (no escalation)
        { id: "bs_wa_svetlana", platform: "whatsapp", name: "Svetlana Jović", pic: "https://randomuser.me/api/portraits/women/68.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_wa_svetlana","user","Zdravo! Koliko dugo traje dostava do Novog Sada?",t(8,0),"whatsapp","Svetlana Jović","https://randomuser.me/api/portraits/women/68.jpg"),
            ms("bs_wa_svetlana","assistant","Zdravo! 📦 Do Novog Sada BEX Express isporučuje za 2-3 radna dana. Za narudžbine do 14h danas — možete računati na prekosutra ili utorak 😊",t(7,55),"whatsapp","Svetlana Jović","https://randomuser.me/api/portraits/women/68.jpg"),
            ms("bs_wa_svetlana","user","Super! A koliko košta dostava?",t(7,50),"whatsapp","Svetlana Jović","https://randomuser.me/api/portraits/women/68.jpg"),
            ms("bs_wa_svetlana","assistant","Dostava je 350 din, ali je **besplatna za narudžbine iznad 2.500 din** 🎉 Uz dve-tri knjige lako prelazite limit. Šta vas zanima iz kataloga?",t(7,48),"whatsapp","Svetlana Jović","https://randomuser.me/api/portraits/women/68.jpg"),
        ]},
        // Website — self-help discovery + book recommendation with prices and direct links
        { id: "bs_web_petra", platform: "website", name: "Petra Stojanović", pic: "https://randomuser.me/api/portraits/women/77.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_web_petra","user","Zdravo, tražim nešto za ličnu transformaciju — šta biste preporučili?",t(1,30),"website","Petra Stojanović","https://randomuser.me/api/portraits/women/77.jpg"),
            ms("bs_web_petra","assistant","Zdravo! 😊 Top tri za ličnu transformaciju: **Atomske navike** (1.490 din) — harmonijaknjige.rs/proizvod/atomske-navike, **Mit o normalnom** Gabora Matea (1.590 din) — harmonijaknjige.rs/proizvod/mit-o-normalnom, **Ikigaj** (1.290 din) — harmonijaknjige.rs/proizvod/ikigaj 📚 Koji vam pristup više odgovara?",t(1,28),"website","Petra Stojanović","https://randomuser.me/api/portraits/women/77.jpg"),
            ms("bs_web_petra","user","Mit o normalnom me zanima — da li je na stanju?",t(1,20),"website","Petra Stojanović","https://randomuser.me/api/portraits/women/77.jpg"),
            ms("bs_web_petra","assistant","Da, na stanju je! 😊 Cena 1.590 din, naručite direktno na harmonijaknjige.rs/proizvod/mit-o-normalnom 🙏 Uz ovu i još jednu knjigu dostava je besplatna.",t(1,18),"website","Petra Stojanović","https://randomuser.me/api/portraits/women/77.jpg"),
        ]},
        // Website — address correction needs human (legitimate service escalation)
        { id: "bs_web_dragan", platform: "website", name: "Dragan Nikolić", pic: "https://randomuser.me/api/portraits/men/72.jpg", humanNeeded: true, phone: null, msgs: [
            ms("bs_web_dragan","user","Naručio sam knjigu i sad vidim da sam upisao pogrešnu adresu. Mogu li da promenim?",t(0,30),"website","Dragan Nikolić","https://randomuser.me/api/portraits/men/72.jpg"),
            ms("bs_web_dragan","assistant","Dragan, rešavamo odmah! Ako narudžbina još nije otpremljena, adresa može da se koriguje. Daj mi email ili broj narudžbine da proverim status 📦",t(0,28),"website","Dragan Nikolić","https://randomuser.me/api/portraits/men/72.jpg"),
            ms("bs_web_dragan","user","dragan.nikolic@gmail.com",t(0,25),"website","Dragan Nikolić","https://randomuser.me/api/portraits/men/72.jpg"),
            ms("bs_web_dragan","system","[HUMAN_NEEDED]",t(0,24),"website","Dragan Nikolić","https://randomuser.me/api/portraits/men/72.jpg",{ human_needed: true }),
        ]},
        // Instagram — first self-help buyer, 5-turn conversion
        { id: "bs_ig_milica", platform: "instagram", name: "Milica Stanković", pic: "https://randomuser.me/api/portraits/women/36.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_ig_milica","user","Zdravo 😊 šta biste preporučili nekome ko nikad nije čitao self-help?",t(26,10),"instagram","Milica Stanković","https://randomuser.me/api/portraits/women/36.jpg"),
            ms("bs_ig_milica","assistant","Zdravo! 👋 Za uvod u self-help, dva idealna starta: **Atomske navike** (praktično, odmah primenljivo) ili **Ikigaj** (lagana, filozofska, lako se čita). Koji stil ti više odgovara?",t(26,8),"instagram","Milica Stanković","https://randomuser.me/api/portraits/women/36.jpg"),
            ms("bs_ig_milica","user","Praktično zvuči bolje. Je li ta knjiga baš toliko dobra?",t(26,3),"instagram","Milica Stanković","https://randomuser.me/api/portraits/women/36.jpg"),
            ms("bs_ig_milica","assistant","Jedna od najprodavanijih knjiga svih vremena — s razlogom 😊 Govori o sitnim navikama koje se akumuliraju tokom vremena. Čitljiva za vikend, efekti traju godinama. Direktan link: harmonijaknjige.rs/proizvod/atomske-navike — 1.490 din, na stanju.",t(26,1),"instagram","Milica Stanković","https://randomuser.me/api/portraits/women/36.jpg"),
            ms("bs_ig_milica","user","Okej, uzimam! Kako naručujem?",t(25,55),"instagram","Milica Stanković","https://randomuser.me/api/portraits/women/36.jpg"),
            ms("bs_ig_milica","assistant","Naručite direktno na harmonijaknjige.rs/proizvod/atomske-navike — kartica ili pouzeće, BEX Express 2-3 radna dana 📦 Prijatno čitanje!",t(25,53),"instagram","Milica Stanković","https://randomuser.me/api/portraits/women/36.jpg"),
        ]},
        // Facebook — Gabor Maté inquiry with book details
        { id: "bs_fb_nemanja", platform: "facebook", name: "Nemanja Đorđević", pic: "https://randomuser.me/api/portraits/men/38.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_fb_nemanja","user","Zanima me Gabor Mate — koji naslov da počnem?",t(32,0),"facebook","Nemanja Đorđević","https://randomuser.me/api/portraits/men/38.jpg"),
            ms("bs_fb_nemanja","assistant","Zdravo! 🙏 Idealan uvod je **Mit o normalnom** — veza između traume, zdravlja i modernog društva. Direktan link: harmonijaknjige.rs/proizvod/mit-o-normalnom (1.590 din). Ako si spreman za dublje — 'U svetu gladnih duhova' je intenzivnije.",t(31,58),"facebook","Nemanja Đorđević","https://randomuser.me/api/portraits/men/38.jpg"),
            ms("bs_fb_nemanja","user","Koliko stranica ima Mit o normalnom?",t(31,50),"facebook","Nemanja Đorđević","https://randomuser.me/api/portraits/men/38.jpg"),
            ms("bs_fb_nemanja","assistant","Oko 560 stranica — detaljna knjiga ali dobro organizovana. Gabor Maté piše toplo i lično, ne akademski 📚 Lako se čita postepeno.",t(31,48),"facebook","Nemanja Đorđević","https://randomuser.me/api/portraits/men/38.jpg"),
            ms("bs_fb_nemanja","user","Uzimam. Ima li besplatna dostava?",t(31,40),"facebook","Nemanja Đorđević","https://randomuser.me/api/portraits/men/38.jpg"),
            ms("bs_fb_nemanja","assistant","Za narudžbine iznad 2.500 din dostava je besplatna 😊 Uz još jednu knjigu lako dolazite do limita. Naručite na harmonijaknjige.rs!",t(31,38),"facebook","Nemanja Đorđević","https://randomuser.me/api/portraits/men/38.jpg"),
        ]},
        // WhatsApp — returning customer wants next Tolle book
        { id: "bs_wa_tijana", platform: "whatsapp", name: "Tijana Nikolić", pic: "https://randomuser.me/api/portraits/women/42.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_wa_tijana","user","Prečitala sam Moć sadašnjeg trenutka i bila sam oduševljena. Šta je sledeće od Ekharta Tolija?",t(68,5),"whatsapp","Tijana Nikolić","https://randomuser.me/api/portraits/women/42.jpg"),
            ms("bs_wa_tijana","assistant","Zdravo Tijana! 🙏 Sledeći je **Nova Zemlja** — mnogi kažu da je dublja od Moći sadašnjeg trenutka. Govori o egu i unutrašnjoj transformaciji. Direktan link: harmonijaknjige.rs/proizvod/nova-zemlja (1.390 din)",t(68,3),"whatsapp","Tijana Nikolić","https://randomuser.me/api/portraits/women/42.jpg"),
            ms("bs_wa_tijana","user","Savršeno, hvala! Naručujem odmah 😊",t(67,55),"whatsapp","Tijana Nikolić","https://randomuser.me/api/portraits/women/42.jpg"),
            ms("bs_wa_tijana","assistant","Uživaj! 🙏 Kad završiš Novu Zemlju, preporučujem i **Praktikovati moć sadašnjeg trenutka** — Tolleova vodilica za svakodnevni rad sa svešću 📚",t(67,53),"whatsapp","Tijana Nikolić","https://randomuser.me/api/portraits/women/42.jpg"),
        ]},
    ]
    const allMessages: any[] = []
    const conversations: any[] = []
    for (const def of convDefs) {
        const sorted = [...def.msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const visible = sorted.filter(m => m.role !== "system")
        conversations.push({
            id: def.id, leadId: null, messages: def.msgs, platform: def.platform,
            candidateName: def.name, humanNeeded: def.humanNeeded, phone: def.phone,
            profilePic: def.pic, lastMessage: sorted[0], lastVisibleMessage: visible[0] || sorted[0],
        })
        allMessages.push(...def.msgs)
    }
    conversations.sort((a, b) => new Date(b.lastVisibleMessage.created_at).getTime() - new Date(a.lastVisibleMessage.created_at).getTime())
    return { conversations, allMessages }
}
// ─────────────────────────────────────────────────────────────────────────────

// Handles both proper JSONB objects and legacy string-encoded metadata
function parseMeta(m: any): Record<string, any> {
    if (!m) return {}
    if (typeof m === 'string') {
        try { return JSON.parse(m) } catch { return {} }
    }
    return m
}

interface SocialChatbotModuleProps {
    clientId: string
    selectedBrandIds?: string[]
    clientName?: string
    nicheKey?: NicheKey
    /** Onboarding: when true, the selected (hero) conversation plays in live,
     *  message-by-message with a typing indicator, inside this real interface. */
    demoPlayback?: boolean
}

function getPlatformMeta(platform: string) {
    const p = platform?.toLowerCase()
    if (p === "instagram") return { label: "Instagram", color: "text-pink-400",    dot: "bg-pink-400",    gradFrom: "#f472b6", gradTo: "#a855f7", Icon: Instagram }
    if (p === "facebook")  return { label: "Facebook",  color: "text-blue-400",    dot: "bg-blue-400",    gradFrom: "#60a5fa", gradTo: "#3b82f6", Icon: Facebook }
    if (p === "whatsapp")  return { label: "WhatsApp",  color: "text-emerald-400", dot: "bg-emerald-400", gradFrom: "#34d399", gradTo: "#059669", Icon: MessageCircle }
    if (p === "website")   return { label: "Website",   color: "text-violet-400",  dot: "bg-violet-400",  gradFrom: "#a78bfa", gradTo: "#7c3aed", Icon: Globe }
    return                        { label: platform || "Chat", color: "text-zinc-400", dot: "bg-zinc-500", gradFrom: "#71717a", gradTo: "#52525b", Icon: MessageCircle }
}

type Period = "danas" | "sedmica" | "mesec"

// Vivid, brand-accurate channel colors — platform is the primary visual signal in the list.
const CHANNEL_HEX: Record<string, string> = {
    instagram: "#E1306C",
    whatsapp: "#25D366",
    facebook: "#1877F2",
    website: "#8b5cf6",
    web: "#8b5cf6",
}
const channelHex = (p?: string) => CHANNEL_HEX[(p ?? "").toLowerCase()] ?? "#71717a"

export function SocialChatbotModule({ clientId, selectedBrandIds, clientName, nicheKey, demoPlayback }: SocialChatbotModuleProps) {
    const bookStoreConfig = getBookStoreConfig(clientId)
    const isMultiBrand = (selectedBrandIds?.length ?? 0) > 1
    const brandIds = selectedBrandIds && selectedBrandIds.length > 0 ? selectedBrandIds : [clientId]
    const brandIdsKey = brandIds.join(',')
    const brandIdsRef = useRef(brandIds)

    const [conversations, setConversations] = useState<any[]>([])
    const [allMessages, setAllMessages] = useState<any[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [nameMap, setNameMap] = useState<Record<string, string>>({})
    const [togglingFlag, setTogglingFlag] = useState(false)
    const [msgPeriod, setMsgPeriod] = useState<Period>("sedmica")
    const [mobilePanel, setMobilePanel] = useState<"list" | "chat" | "profile">("list")
    const [channelFilter, setChannelFilter] = useState<'all' | 'instagram' | 'facebook' | 'whatsapp' | 'website'>('all')
    const [crmRows, setCrmRows] = useState<any[]>([])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    useEffect(() => { brandIdsRef.current = brandIds }, [brandIdsKey]) // eslint-disable-line

    const fetchConversations = useCallback(async () => {
        const ids = brandIdsRef.current

        const results = await Promise.all(
            ids.map(bid =>
                supabase.from("razgovori").select("*")
                    .eq("client_id", bid)
                    .order("created_at", { ascending: false })
                    .limit(1000)
            )
        )

        const allMsgs: any[] = []
        const allConvs: any[] = []

        for (let i = 0; i < ids.length; i++) {
            const bid = ids[i]
            const { data, error } = results[i]
            if (error || !data) continue

            if (data.length === 0 && getBookStoreConfig(bid)) {
                const { conversations: demoConvs, allMessages: demoMsgs } = generateBookstoreDemoData(bid)
                allConvs.push(...demoConvs.map((c: any) => ({ ...c, brandId: bid })))
                allMsgs.push(...demoMsgs)
                continue
            }

            allMsgs.push(...data)

            const grouped: Record<string, any> = {}
            for (const msg of data) {
                const id = msg.id_razgovora
                if (!grouped[id]) {
                    grouped[id] = {
                        id, leadId: msg.lead_id, lastMessage: msg,
                        messages: [], platform: msg.platform || "instagram",
                        candidateName: null, humanNeeded: false, phone: null, profilePic: null,
                        brandId: bid,
                    }
                }
                grouped[id].messages.push(msg)
                const meta = parseMeta(msg.metadata)
                if (msg.role === "system" && meta.human_needed) grouped[id].humanNeeded = true
                if (new Date(msg.created_at) > new Date(grouped[id].lastMessage.created_at)) grouped[id].lastMessage = msg
                if (meta.name && !grouped[id].candidateName) grouped[id].candidateName = meta.name
                if ((meta.phone || meta.number) && !grouped[id].phone)
                    grouped[id].phone = meta.phone || meta.number
                if (meta.profile_pic && !grouped[id].profilePic)
                    grouped[id].profilePic = meta.profile_pic
            }

            for (const id of Object.keys(grouped)) {
                const ns = grouped[id].messages
                    .filter((m: any) => m.role !== "system")
                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                grouped[id].lastVisibleMessage = ns[0] || grouped[id].lastMessage
            }

            allConvs.push(...Object.values(grouped))
        }

        allConvs.sort((a: any, b: any) =>
            new Date(b.lastVisibleMessage.created_at).getTime() - new Date(a.lastVisibleMessage.created_at).getTime()
        )
        setConversations(allConvs)
        setAllMessages(allMsgs)

        const razgovorIds = allConvs.map((c: any) => c.id).filter(Boolean)
        if (razgovorIds.length > 0) {
            const { data: kandRows } = await supabase
                .from("kandidati")
                .select("id_razgovora, full_name")
                .in("id_razgovora", razgovorIds)
                .not("full_name", "is", null)
            if (kandRows) {
                const map: Record<string, string> = {}
                for (const k of kandRows) if (k.id_razgovora && k.full_name) map[k.id_razgovora] = k.full_name
                setNameMap(map)
            }
        }
    }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (DEMO_MODE) {
            const { conversations: mockConvs, allMessages: mockMsgs } = generateMockData()
            setConversations(mockConvs)
            setAllMessages(mockMsgs)
            return
        }

        // Instant pre-populate for bookstore clients — eliminates blank flash on brand switch
        const ids = brandIdsRef.current
        const instantConvs: any[] = []
        for (const bid of ids) {
            if (getBookStoreConfig(bid)) {
                const { conversations: dc } = generateBookstoreDemoData(bid)
                instantConvs.push(...dc.map((c: any) => ({ ...c, brandId: bid })))
            }
        }
        if (instantConvs.length > 0) {
            instantConvs.sort((a: any, b: any) =>
                new Date(b.lastVisibleMessage.created_at).getTime() - new Date(a.lastVisibleMessage.created_at).getTime()
            )
            setConversations(instantConvs)
        }

        fetchConversations()

        const channels = ids.map(bid =>
            supabase.channel(`razgovori-rt-${bid}`)
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "razgovori", filter: `client_id=eq.${bid}` },
                    () => fetchConversations())
                .subscribe()
        )
        return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
    }, [brandIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch demo CRM rows for sidebar enrichment (non-bookstore clients)
    useEffect(() => {
        if (bookStoreConfig || DEMO_MODE) return
        supabase.from('demo_crm').select('full_name, status, proizvod, kategorija, telefon, izvor').eq('client_id', clientId)
            .then(({ data }: { data: any[] | null }) => { if (data) setCrmRows(data) })
    }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

    // Reset selection when brand set changes so we don't show a conversation from a hidden brand
    useEffect(() => {
        setSelectedId(null)
    }, [brandIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Detect newly-arrived conversations so they pop in + flash emerald ──────
    const seenConvIdsRef = useRef<Set<string>>(new Set())
    const firstConvLoadRef = useRef(true)
    const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
    useEffect(() => {
        if (conversations.length === 0) return
        const current = new Set<string>(conversations.map((c: any) => c.id))
        if (firstConvLoadRef.current) {
            firstConvLoadRef.current = false
            seenConvIdsRef.current = current
            return
        }
        const newcomers = [...current].filter(id => !seenConvIdsRef.current.has(id))
        seenConvIdsRef.current = current
        if (newcomers.length > 0) {
            setFlashIds(prev => new Set([...prev, ...newcomers]))
            setTimeout(() => setFlashIds(prev => {
                const n = new Set(prev); newcomers.forEach(id => n.delete(id)); return n
            }), 2800)
        }
    }, [conversations])

    useEffect(() => {
        if (conversations.length > 0 && !selectedId) setSelectedId(conversations[0].id)
    }, [conversations, selectedId])

    const selected = conversations.find(c => c.id === selectedId)
    const fullMessages = selected?.messages
        .filter((m: any) => m.role !== "system")
        .slice()
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) ?? []

    // ── Onboarding live playback: reveal the hero thread one message at a time ──
    const [pbCount, setPbCount] = useState(0)
    const [pbTyping, setPbTyping] = useState(false)
    useEffect(() => {
        if (!demoPlayback || !selectedId || fullMessages.length === 0) { setPbCount(fullMessages.length); setPbTyping(false); return }
        setPbCount(0); setPbTyping(false)
        let alive = true
        const timers: any[] = []
        const reveal = (i: number) => {
            if (!alive || i >= fullMessages.length) { setPbTyping(false); return }
            const isAgent = fullMessages[i].role !== "user"
            if (isAgent) {
                setPbTyping(true)
                timers.push(setTimeout(() => {
                    if (!alive) return
                    setPbTyping(false); setPbCount(i + 1)
                    timers.push(setTimeout(() => reveal(i + 1), 620))
                }, 1100))
            } else {
                setPbCount(i + 1)
                timers.push(setTimeout(() => reveal(i + 1), 780))
            }
        }
        timers.push(setTimeout(() => reveal(0), 600))
        return () => { alive = false; timers.forEach(clearTimeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [demoPlayback, selectedId, fullMessages.length])

    const currentMessages = demoPlayback ? fullMessages.slice(0, pbCount) : fullMessages

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [selectedId, currentMessages.length, pbTyping])

    const getDisplayName = (conv: any) => {
        const name = nameMap[conv.id] || conv.candidateName
        if (name) {
            const parts = name.trim().split(" ")
            return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]
        }
        return `Kandidat ${conv.id.substring(0, 6)}`
    }

    const getFullName = (conv: any) => nameMap[conv.id] || conv.candidateName || null

    const todayStr = new Date().toDateString()
    const weekAgo = subDays(new Date(), 7)
    const monthAgo = subDays(new Date(), 30)

    const inDateRange = (dateStr: string) => {
        const d = new Date(dateStr)
        if (msgPeriod === "danas") return d.toDateString() === todayStr
        if (msgPeriod === "sedmica") return d >= weekAgo
        return d >= monthAgo
    }

    // Calculate stats based on period
    const isCatalogProducts = bookStoreConfig?.tableType === 'proizvodi'
    const leadsLabel = nicheKey
        ? (NICHE_CONFIGS[nicheKey]?.terminology.plural ?? 'Korisnici')
        : isCatalogProducts ? 'Zainteresovani' : 'Prijave'

    // Resolve per-brand demo stats: sum across all active brandIds, fall back to clientId
    const _demoStats = (() => {
        const acc = { upiti: 0, konverzije: 0, poruke: 0 }
        let found = false
        for (const bid of brandIds) {
            const s = BRAND_DEMO_STATS[bid]
            if (s) { acc.upiti += s.upiti; acc.konverzije += s.konverzije; acc.poruke += s.poruke; found = true }
        }
        if (!found) {
            const s = BRAND_DEMO_STATS[clientId]
            if (s) { acc.upiti = s.upiti; acc.konverzije = s.konverzije; acc.poruke = s.poruke; found = true }
        }
        return found ? acc : null
    })()

    const _baseUpiti = _demoStats ? _demoStats.upiti : (DEMO_MODE ? 524 : conversations.length)
    const upitiPeriod = msgPeriod === "danas" ? Math.round(_baseUpiti / 30) : msgPeriod === "sedmica" ? Math.round(_baseUpiti / 4 * 1.2) : _baseUpiti

    const _baseKonverzije = _demoStats ? _demoStats.konverzije : (DEMO_MODE ? 142 : allMessages.filter(m =>
        m.role === "user" && (isCatalogProducts
            ? ["cena", "kupim", "narudžbin", "naruč", "dostav", "plaćan"].some(kw => m.message?.toLowerCase().includes(kw))
            : ["prijavim", "prijaviti", "prijavl", "zainteresova"].some(kw => m.message?.toLowerCase().includes(kw))
        )
    ).length)
    const prijavePeriod = msgPeriod === "danas" ? Math.round(_baseKonverzije / 30) : msgPeriod === "sedmica" ? Math.round(_baseKonverzije / 4 * 1.5) : _baseKonverzije

    const _baseMsgs = _demoStats ? _demoStats.poruke : (DEMO_MODE ? 1340 : allMessages.filter(m => m.role !== "system").length)
    const msgCount = msgPeriod === "danas" ? Math.round(_baseMsgs / 30 * 1.2) : msgPeriod === "sedmica" ? Math.round(_baseMsgs / 4 * 1.1) : _baseMsgs

    // Real, meaningful "closed by agent" count from CRM (booked / ordered / delivered)
    const closedByAgent = crmRows.filter(r => ['Zakazano', 'Naručio', 'Isporučeno', 'Završeno'].includes(r.status)).length
    const closedLabel = crmRows.some(r => ['Naručio', 'Isporučeno'].includes(r.status)) ? 'Naručilo' : 'Zakazano'

    const intervencije = conversations.filter((c: any) => c.humanNeeded).length
    const periodLabel = msgPeriod === "danas" ? "Danas" : msgPeriod === "sedmica" ? "7 dana" : "30 dana"

    const toggleHumanNeeded = async () => {
        if (!selected || togglingFlag) return
        setTogglingFlag(true)
        if (DEMO_MODE) {
            setConversations(prev => prev.map(c =>
                c.id === selected.id ? { ...c, humanNeeded: !c.humanNeeded } : c
            ))
            setTogglingFlag(false)
            return
        }
        if (!selected.humanNeeded) {
            await supabase.from("razgovori").insert({
                client_id: clientId,
                id_razgovora: selected.id,
                role: "system",
                message: "[HUMAN_NEEDED]",
                platform: selected.platform,
                metadata: { type: "flag", human_needed: true },
            })
        } else {
            await supabase.from("razgovori").delete()
                .eq("client_id", clientId)
                .eq("id_razgovora", selected.id)
                .eq("role", "system")
                .eq("message", "[HUMAN_NEEDED]")
        }
        await fetchConversations()
        setTogglingFlag(false)
    }

    const PERIODS: { key: Period; label: string }[] = [
        { key: "danas", label: "Danas" },
        { key: "sedmica", label: "7 dana" },
        { key: "mesec", label: "30 dana" },
    ]

    return (
        <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
                <div>
                    <h2 className="text-xl md:text-3xl font-outfit font-bold tracking-tight text-white">
                        AI{" "}
                        <span style={{ background: "linear-gradient(120deg, #34d39e, #10b981, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            Inbox
                        </span>
                    </h2>
                    <p className="text-[11px] font-mono text-zinc-500 mt-0.5 tracking-wider">
                        {isMultiBrand
                            ? `Svi brendovi · ${brandIds.length} brenda`
                            : bookStoreConfig
                                ? `${bookStoreConfig.brandName} AI Agent · Multi-channel`
                                : clientName
                                    ? `${clientName} AI Agent · Multi-channel`
                                    : "AI Inbox · Multi-channel"}
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2.5">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07]">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <Wifi className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Live</span>
                    </div>
                    {isMultiBrand ? (
                        <div className="flex items-center gap-1">
                            {brandIds.map(bid => {
                                const bc = getBookStoreConfig(bid)
                                if (!bc) return null
                                return (
                                    <div key={bid} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border"
                                        style={{ borderColor: `${bc.color}30`, background: `${bc.color}10` }}>
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: bc.color }} />
                                        <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color: bc.color }}>
                                            {bc.brandName.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <>
                            {bookStoreConfig && (
                            <>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-500/20 bg-pink-500/[0.07]">
                                    <Instagram className="w-3 h-3 text-pink-400" />
                                    <span className="text-[10px] font-mono font-bold text-pink-400 tracking-wide">{bookStoreConfig.instagramHandle}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.07] bg-white/[0.03]">
                                    <Globe className="w-3 h-3 text-zinc-400" />
                                    <span className="text-[10px] font-mono text-zinc-400 tracking-wide">{bookStoreConfig.websiteUrl}</span>
                                </div>
                            </>
                        )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Stats ──────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 shrink-0">
                <StatCard icon={<MessageCircle className="w-4 h-4" />} label={`Razgovori · ${periodLabel}`} value={upitiPeriod} variant="emerald" />
                <StatCard icon={<UserCheck className="w-4 h-4" />} label={`${closedLabel} (agent)`} value={closedByAgent} variant="emerald" />
                <StatCard
                    icon={<AlertTriangle className="w-4 h-4" />}
                    label="Intervencije"
                    value={intervencije}
                    variant={intervencije > 0 ? "amber" : "zinc"}
                    glow={intervencije > 0}
                />
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 md:p-4 flex items-center justify-between" style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl border border-cyan-500/20 bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Poruke</p>
                            <p className="text-2xl font-bold text-white font-outfit">{msgCount}</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        {PERIODS.map(p => (
                            <button
                                key={p.key}
                                onClick={() => setMsgPeriod(p.key)}
                                className={cn(
                                    "text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-md transition-all",
                                    msgPeriod === p.key ? "bg-cyan-500/20 text-cyan-400" : "text-zinc-600 hover:text-zinc-400"
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Mobile panel tabs ──────────────────────────────────────────── */}
            {selected && (
                <div className="md:hidden flex shrink-0 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1 gap-1">
                    {[
                        { key: "list" as const, label: "Inbox" },
                        { key: "chat" as const, label: "Chat" },
                        { key: "profile" as const, label: "Profil" },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setMobilePanel(tab.key)}
                            className={cn(
                                "flex-1 py-1.5 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider transition-all",
                                mobilePanel === tab.key ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-600 hover:text-zinc-400"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Main Panel ─────────────────────────────────────────────────── */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 min-h-0">

                {/* Conversation list */}
                <div className={cn(
                    "md:col-span-4 flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden backdrop-blur-xl",
                    // Mobile: show only when mobilePanel === "list" (or no selection yet)
                    selected ? (mobilePanel === "list" ? "flex" : "hidden md:flex") : "flex"
                )}>
                    <div className="border-b border-white/[0.05] shrink-0">
                        {/* Title row */}
                        <div className="px-4 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Inbox className="w-3.5 h-3.5 text-zinc-500" />
                                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Razgovori</span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-600 bg-white/5 rounded-full px-2 py-0.5">
                                {conversations.filter(c => {
                                    if (channelFilter !== 'all' && c.platform?.toLowerCase() !== channelFilter) return false
                                    if (c.lastVisibleMessage?.created_at && !inDateRange(c.lastVisibleMessage.created_at)) return false
                                    return true
                                }).length}
                            </span>
                        </div>
                        {/* Channel filter tabs */}
                        <div className="px-3 pb-2.5 flex items-center gap-1">
                            {([
                                { key: 'all',       label: 'Sve',       Icon: Inbox,          color: 'text-zinc-400',    active: 'bg-white/10 text-white' },
                                { key: 'instagram', label: 'Instagram', Icon: Instagram,       color: 'text-pink-400',    active: 'bg-pink-500/15 text-pink-400' },
                                { key: 'facebook',  label: 'Facebook',  Icon: Facebook,        color: 'text-blue-400',    active: 'bg-blue-500/15 text-blue-400' },
                                { key: 'whatsapp',  label: 'WhatsApp',  Icon: MessageCircle,   color: 'text-emerald-400', active: 'bg-emerald-500/15 text-emerald-400' },
                                { key: 'website',   label: 'Web',       Icon: Globe,           color: 'text-violet-400',  active: 'bg-violet-500/15 text-violet-400' },
                            ] as const).map(({ key, label, Icon, color, active }) => {
                                const count = key === 'all' ? conversations.length : conversations.filter(c => c.platform?.toLowerCase() === key).length
                                if (key !== 'all' && count === 0) return null
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setChannelFilter(key)}
                                        className={cn(
                                            "flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all duration-150 border",
                                            channelFilter === key
                                                ? `${active} border-current/20`
                                                : `${color} opacity-50 hover:opacity-80 border-transparent`
                                        )}
                                    >
                                        <Icon className="w-2.5 h-2.5" />
                                        <span className="hidden sm:inline">{label}</span>
                                        <span className="opacity-70">{count}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-none divide-y divide-white/[0.03]">
                        {conversations.filter(c => {
                            if (channelFilter !== 'all' && c.platform?.toLowerCase() !== channelFilter) return false
                            if (c.lastVisibleMessage?.created_at && !inDateRange(c.lastVisibleMessage.created_at)) return false
                            return true
                        }).map((conv, idx) => {
                            const isSelected = selectedId === conv.id
                            const pm = getPlatformMeta(conv.platform)
                            const name = getDisplayName(conv)
                            const convBrandConfig = getBookStoreConfig(conv.brandId ?? clientId)
                            const brandColor = convBrandConfig?.color
                            const fullName = getFullName(conv) || conv.candidateName
                            const crmMatch = crmRows.find(r => r.full_name?.toLowerCase() === fullName?.toLowerCase())
                            const STATUS_DOT: Record<string, string> = {
                                Naručio: '#10b981', Isporučeno: '#8b5cf6',
                                Zainteresovan: '#f59e0b', Novi: '#0ea5e9',
                                Reklamacija: '#f97316', Intervencija: '#ef4444',
                            }
                            const justArrived = flashIds.has(conv.id)
                            const statusColor = crmMatch?.status ? (STATUS_DOT[crmMatch.status] ?? '#6366f1') : null
                            const chHex = channelHex(conv.platform)
                            return (
                                <motion.button
                                    key={conv.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.92, y: -10 }}
                                    animate={justArrived
                                        ? { opacity: 1, scale: 1, y: 0, boxShadow: ["inset 0 0 0 0 rgba(16,185,129,0)", "inset 0 0 0 2px rgba(16,185,129,0.55), 0 0 24px -4px rgba(16,185,129,0.4)", "inset 0 0 0 0 rgba(16,185,129,0)"] }
                                        : { opacity: 1, scale: 1, y: 0 }}
                                    transition={justArrived
                                        ? { duration: 0.45, ease: [0.16, 1, 0.3, 1], boxShadow: { duration: 1.4, repeat: 1 } }
                                        : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                                    onClick={() => { setSelectedId(conv.id); setMobilePanel("chat") }}
                                    className={cn(
                                        "w-full text-left pl-3 pr-4 py-3.5 transition-colors duration-200 relative",
                                        isSelected ? "bg-emerald-500/[0.09]" : "hover:bg-white/[0.035]"
                                    )}
                                    style={{ borderLeft: `3px solid ${isSelected ? '#34d39e' : chHex}` }}
                                >
                                    {justArrived && (
                                        <span className="absolute top-2 right-3 text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-400 text-[#05140d]">novo</span>
                                    )}
                                    <div className="flex items-start gap-3">
                                        {/* Avatar with vivid channel badge — platform is the primary signal */}
                                        <div className="relative shrink-0">
                                            <Avatar conv={conv} size="md" />
                                            <span
                                                className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full flex items-center justify-center border-[2.5px] border-[#0e1117] shadow-lg"
                                                style={{ background: chHex }}
                                                title={pm.label}
                                            >
                                                <ChannelGlyph platform={conv.platform} className="w-[11px] h-[11px] text-white" />
                                            </span>
                                            {conv.humanNeeded && (
                                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-[#0e1117] flex items-center justify-center z-10">
                                                    <span className="text-[7px] font-black text-black leading-none">!</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-[15px] font-semibold text-white truncate font-outfit">{name}</span>
                                                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                        style={{ color: chHex, background: `${chHex}1f` }}>
                                                        {pm.label}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-zinc-500 shrink-0 tabular-nums">
                                                    {format(new Date(conv.lastVisibleMessage.created_at), "HH:mm")}
                                                </span>
                                            </div>
                                            <p className="text-[13px] text-zinc-400 truncate leading-snug">
                                                {conv.lastVisibleMessage?.role === "assistant" && <span className="text-emerald-400/80">Vi: </span>}
                                                {conv.lastVisibleMessage?.message?.substring(0, 48)}
                                            </p>
                                            {statusColor && (
                                                <span className="inline-flex items-center gap-1.5 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                    style={{ color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}35` }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                                                    {crmMatch.status}
                                                    {crmMatch?.proizvod && <span className="text-zinc-500 font-normal ml-0.5">· {crmMatch.proizvod}</span>}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.button>
                            )
                        })}
                        {conversations.length === 0 && (
                            <div className="p-10 text-center">
                                <MessageCircle className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                                <p className="text-zinc-600 text-sm font-mono">Nema razgovora</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat view */}
                <div className={cn(
                    "md:col-span-5 flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden backdrop-blur-xl",
                    mobilePanel === "chat" ? "flex" : "hidden md:flex"
                )}>
                    {selected ? (
                        <>
                            {/* Chat header */}
                            <div className={cn(
                                "px-5 py-3.5 border-b flex items-center gap-3 shrink-0 transition-colors",
                                selected.humanNeeded ? "border-amber-500/25 bg-amber-500/[0.04]" : "border-white/[0.05]"
                            )}>
                                <Avatar conv={selected} size="sm" className="shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white font-outfit leading-none mb-0.5 truncate">
                                        {getFullName(selected) || getDisplayName(selected)}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const pm = getPlatformMeta(selected.platform)
                                            return <>
                                                <pm.Icon className={cn("w-3 h-3", pm.color)} />
                                                <span className="text-[10px] font-mono text-zinc-500">{pm.label} DM</span>
                                            </>
                                        })()}
                                        <span className="text-zinc-700">·</span>
                                        <Clock className="w-2.5 h-2.5 text-zinc-600" />
                                        <span className="text-[10px] font-mono text-zinc-500">{currentMessages.length} poruka</span>
                                    </div>
                                </div>
                                {selected.humanNeeded && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                                        <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">Intervencija</span>
                                    </div>
                                )}
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 scrollbar-none bg-black/10">
                                {currentMessages.map((msg: any, i: number) => {
                                    const isUser = msg.role === "user"
                                    const meta = parseMeta(msg.metadata)
                                    const imageUrl = meta.image_url || meta.imageUrl
                                    const isStory = meta.type === "story_reply"
                                    const msgText = msg.message && msg.message !== "[slika]" ? msg.message : null
                                    return (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                            className={cn("flex gap-2.5", isUser ? "justify-start" : "justify-end")}
                                        >
                                            {isUser && (
                                                <div className="shrink-0 mt-1">
                                                    <Avatar conv={selected} size="sm" />
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    "max-w-[74%] rounded-2xl px-3.5 py-2.5 text-sm font-outfit",
                                                    isUser
                                                        ? "bg-[#1a1a28] text-zinc-200 rounded-tl-none border border-white/[0.07]"
                                                        : "text-[#05140d] rounded-tr-none shadow-lg"
                                                )}
                                                style={!isUser ? { background: "linear-gradient(135deg, #34d39e, #10b981)" } : undefined}
                                            >
                                                {isStory && (
                                                    <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1.5">↩ Story odgovor</p>
                                                )}
                                                {imageUrl && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={imageUrl}
                                                        alt="slika"
                                                        className="rounded-xl max-w-full max-h-56 object-cover mb-2 border border-white/10"
                                                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                                                    />
                                                )}
                                                {!imageUrl && !msgText && (
                                                    <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">📷 Slika</span>
                                                )}
                                                {msgText && <p className="leading-relaxed text-[13px]">{msgText}</p>}
                                                <span className={cn("text-[10px] mt-1.5 block font-mono", isUser ? "opacity-35 text-zinc-400" : "opacity-50 text-[#05140d]")}>
                                                    {format(new Date(msg.created_at), "HH:mm")}
                                                </span>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                                {demoPlayback && pbTyping && (
                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                                        <div className="rounded-2xl rounded-tr-none px-4 py-3 flex items-center gap-1.5" style={{ background: "linear-gradient(135deg, #34d39e, #10b981)" }}>
                                            {[0, 1, 2].map(d => (
                                                <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-[#05140d]"
                                                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat footer status */}
                            <div className={cn(
                                "px-4 py-2 border-t flex flex-col shrink-0 transition-colors",
                                selected.humanNeeded ? "border-amber-500/20 bg-amber-500/[0.04]" : "border-white/[0.05] bg-black/15"
                            )}>
                                <div className="flex items-center justify-between mb-2 px-1">
                                    {selected.humanNeeded ? (
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                            <p className="text-xs text-amber-400/80 font-mono">Čeka manuelnu intervenciju</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Bot className="w-3.5 h-3.5 text-emerald-400 opacity-50 shrink-0" />
                                            <p className="text-xs text-zinc-600 font-mono italic">AI automatski obrađuje poruke</p>
                                        </div>
                                    )}
                                </div>
                                <form 
                                    className="flex items-center gap-2"
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        const form = e.target as HTMLFormElement;
                                        const input = form.elements.namedItem('message') as HTMLInputElement;
                                        const text = input.value.trim();
                                        if(!text) return;

                                        // Store to DB via Supabase
                                        await supabase.from("razgovori").insert({
                                            client_id: clientId,
                                            id_razgovora: selected.id,
                                            role: "assistant",
                                            message: text,
                                            platform: selected.platform,
                                            metadata: { type: "dashboard_reply", profile_pic: null },
                                        });

                                        input.value = "";
                                        await fetchConversations();
                                    }}
                                >
                                    <input
                                        name="message"
                                        type="text"
                                        placeholder="Upišite poruku..."
                                        className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                    />
                                    <button
                                        type="submit"
                                        className="bg-emerald-500 hover:bg-emerald-400 text-[#05140d] px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                                    >
                                        Pošalji
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                            <div className="w-14 h-14 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] flex items-center justify-center">
                                <Inbox className="w-6 h-6 text-emerald-500/40" />
                            </div>
                            <p className="text-zinc-600 text-sm font-mono">Izaberite razgovor</p>
                        </div>
                    )}
                </div>

                {/* Profile sidebar */}
                <div className={cn(
                    "md:col-span-3 flex flex-col gap-3 overflow-y-auto scrollbar-none",
                    mobilePanel === "profile" ? "flex" : "hidden md:flex"
                )}>
                    {selected ? (
                        <>
                            {/* Profile card — clean, centered, no colored cover bleed */}
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-xl shrink-0">
                                <div className="px-4 pt-5 pb-4 flex flex-col items-center text-center">
                                    <div className="relative">
                                        <Avatar conv={selected} size="lg" className="w-16 h-16 ring-2 ring-white/10" />
                                        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#111118]"
                                            style={{ background: channelHex(selected.platform) }}>
                                            <ChannelGlyph platform={selected.platform} className="w-3 h-3 text-white" />
                                        </span>
                                    </div>
                                    <p className="font-semibold text-white text-base font-outfit leading-tight mt-3">
                                        {getFullName(selected) || getDisplayName(selected)}
                                    </p>
                                    {/* Badges */}
                                    <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                                        {(() => {
                                            const pm = getPlatformMeta(selected.platform)
                                            const ch = channelHex(selected.platform)
                                            return (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                                    style={{ color: ch, background: `${ch}1f`, border: `1px solid ${ch}40` }}>
                                                    <ChannelGlyph platform={selected.platform} className="w-2.5 h-2.5" />
                                                    {pm.label}
                                                </span>
                                            )
                                        })()}
                                        {selected.humanNeeded && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border border-amber-500/30 text-amber-400 bg-amber-500/10">
                                                <AlertTriangle className="w-2 h-2" />
                                                Intervencija
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Contact info */}
                            {(() => {
                                const fn = getFullName(selected) || selected.candidateName
                                const cm = crmRows.find(r => r.full_name?.toLowerCase() === fn?.toLowerCase())
                                const phone = cm?.telefon || selected.phone
                                const pmeta = getPlatformMeta(selected.platform)
                                return (
                                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-xl shrink-0">
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Kontakt</p>
                                        <div className="space-y-3">
                                            <InfoRow icon={<Phone />} label="Telefon" value={phone || "Nije ostavljen"} />
                                            <InfoRow icon={<ChannelGlyph platform={selected.platform} />} label="Kanal" value={pmeta.label} />
                                            <InfoRow icon={<Clock />} label="Prvi kontakt" value={format(new Date(conversations.find(c => c.id === selected.id)?.messages?.[0]?.created_at ?? selected.lastVisibleMessage.created_at), "d.MM.yyyy")} />
                                            {bookStoreConfig && (
                                                <InfoRow icon={<Globe />} label="Website" value={bookStoreConfig.websiteUrl} link={`https://${bookStoreConfig.websiteUrl}`} />
                                            )}
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Conversation stats */}
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-xl shrink-0">
                                <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest mb-3">Statistike</p>
                                <div className="space-y-2">
                                    <MiniStat label="Ukupno poruka" value={currentMessages.length} />
                                    <MiniStat label="Korisnički" value={currentMessages.filter((m: any) => m.role === "user").length} />
                                    <MiniStat label="AI odgovori" value={currentMessages.filter((m: any) => m.role === "assistant").length} />
                                    <MiniStat label="Sa slikom" value={currentMessages.filter((m: any) => m.metadata?.image_url || m.metadata?.imageUrl).length} />
                                </div>
                            </div>

                            {/* Human intervention toggle */}
                            <button
                                onClick={toggleHumanNeeded}
                                disabled={togglingFlag}
                                className={cn(
                                    "w-full rounded-2xl py-3 px-4 text-sm font-mono font-bold uppercase tracking-wider transition-all duration-300 border flex items-center justify-center gap-2 shrink-0",
                                    selected.humanNeeded
                                        ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
                                        : "bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/[0.05]"
                                )}
                            >
                                {togglingFlag ? (
                                    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                ) : selected.humanNeeded ? (
                                    <><CheckCircle2 className="w-4 h-4" /> Vrati na AI</>
                                ) : (
                                    <><AlertTriangle className="w-4 h-4" /> Zahtevaj Intervenciju</>
                                )}
                            </button>

                            {/* CRM breakdown for this customer */}
                            {(() => {
                                const fullName = getFullName(selected) || selected.candidateName
                                const crmMatch = crmRows.find(r => r.full_name?.toLowerCase() === fullName?.toLowerCase())
                                if (!crmMatch) return null
                                const STATUS_COLOR: Record<string, string> = {
                                    Naručio: '#10b981', Isporučeno: '#8b5cf6',
                                    Zainteresovan: '#f59e0b', Novi: '#0ea5e9',
                                    Reklamacija: '#f97316', Intervencija: '#ef4444',
                                }
                                const sc = STATUS_COLOR[crmMatch.status] ?? '#6366f1'
                                return (
                                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-xl shrink-0">
                                        <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest mb-3">Narudžbina / CRM</p>
                                        <div className="space-y-2.5">
                                            {crmMatch.status && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-zinc-600 font-mono">Status</span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                        style={{ color: sc, background: `${sc}18`, border: `1px solid ${sc}30` }}>
                                                        {crmMatch.status}
                                                    </span>
                                                </div>
                                            )}
                                            {crmMatch.proizvod && (
                                                <div>
                                                    <p className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest mb-0.5">Proizvod</p>
                                                    <p className="text-xs text-zinc-300 leading-snug">{crmMatch.proizvod}</p>
                                                </div>
                                            )}
                                            {crmMatch.kategorija && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-zinc-600 font-mono">Kategorija</span>
                                                    <span className="text-[10px] text-zinc-400">{crmMatch.kategorija}</span>
                                                </div>
                                            )}
                                            {crmMatch.izvor && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-zinc-600 font-mono">Izvor</span>
                                                    <span className="text-[10px] text-zinc-400">{crmMatch.izvor}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* AI Agent info */}
                            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 backdrop-blur-xl shrink-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">AI Agent Aktivan</span>
                                </div>
                                <p className="text-[11px] font-mono text-zinc-500 leading-relaxed">
                                    {bookStoreConfig
                                        ? `${bookStoreConfig.brandName} AI Agent obradjuje poruke 24/7 i automatski odgovara kupcima na svim kanalima.`
                                        : clientName
                                            ? `${clientName} AI Agent obradjuje poruke 24/7 i automatski odgovara klijentima na svim kanalima.`
                                            : "AI Agent obradjuje poruke 24/7 i automatski odgovara klijentima na svim kanalima."}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] flex items-center justify-center min-h-[200px]">
                            <p className="text-zinc-700 text-xs font-mono">Nema odabranog</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, variant, glow }: {
    icon: ReactNode
    label: string
    value: number
    variant: "pink" | "emerald" | "amber" | "zinc" | "cyan"
    glow?: boolean
}) {
    const styles = {
        pink:    { bg: "bg-pink-500/10",    border: "border-pink-500/20",    iconClass: "text-pink-400 border-pink-500/20 bg-pink-500/10",    num: "text-white" },
        emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", iconClass: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10", num: "text-white" },
        amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/20",   iconClass: "text-amber-400 border-amber-500/30 bg-amber-500/15",  num: "text-amber-400" },
        zinc:    { bg: "bg-white/[0.03]",   border: "border-white/[0.07]",   iconClass: "text-zinc-500 border-white/10 bg-white/5",           num: "text-white" },
        cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/20",    iconClass: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10",     num: "text-white" },
    }
    const s = styles[variant]
    return (
        <div className={cn("rounded-2xl border p-3 md:p-4 flex items-center gap-2 md:gap-3", s.bg, s.border, glow && "ring-1 ring-amber-500/20")}
             style={{ 
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)" 
             }}>
            <div className={cn("w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center border shrink-0", s.iconClass)}>
                {icon}
            </div>
            <div>
                <p className="text-[8px] md:text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
                <p className={cn("text-xl md:text-2xl font-bold font-outfit leading-none mt-0.5", s.num)}>{value}</p>
            </div>
        </div>
    )
}

function InfoRow({ icon, label, value, mono, link }: {
    icon: ReactNode
    label: string
    value: string
    mono?: boolean
    link?: string
}) {
    return (
        <div className="flex items-start gap-2.5">
            <span className="text-zinc-600 shrink-0 mt-0.5 [&>svg]:w-3 [&>svg]:h-3">{icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                {link ? (
                    <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1 font-mono"
                    >
                        {value} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                ) : (
                    <p className={cn("text-xs text-zinc-300 truncate", mono && "font-mono")}>{value}</p>
                )}
            </div>
        </div>
    )
}

function Avatar({ conv, size = "md", className }: { conv: any; size?: "sm" | "md" | "lg"; className?: string }) {
    const pm = getPlatformMeta(conv.platform)
    const initial = (conv.candidateName || conv.id || "?")[0]?.toUpperCase()
    const sizeMap = { sm: "w-6 h-6 text-[10px]", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" }
    const sizeClass = sizeMap[size]

    if (conv.profilePic) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={conv.profilePic}
                alt={initial}
                className={cn(sizeClass, "rounded-full object-cover ring-2 ring-black/30", className)}
                onError={e => {
                    // On error fall back to gradient initial
                    const el = e.currentTarget
                    el.style.display = "none"
                    const sibling = el.nextElementSibling as HTMLElement | null
                    if (sibling) sibling.style.display = "flex"
                }}
            />
        )
    }

    return (
        <div
            className={cn(sizeClass, "rounded-full flex items-center justify-center font-bold text-white ring-2 ring-black/30", className)}
            style={{ background: `linear-gradient(135deg, ${pm.gradFrom}, ${pm.gradTo})` }}
        >
            {initial}
        </div>
    )
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between py-0.5">
            <span className="text-[10px] font-mono text-zinc-500">{label}</span>
            <span className="text-xs font-mono font-bold text-zinc-300">{value}</span>
        </div>
    )
}
