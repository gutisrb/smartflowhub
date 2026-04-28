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
    ]

    const convDefs = clientId === PUBLIK_ID ? publikConvDefs
        : clientId === STELA_ID ? stelaConvDefs
        : [
        // Instagram — delivery inquiry, warm lead
        { id: "bs_ig_ana", platform: "instagram", name: "Ana Živković", pic: "https://randomuser.me/api/portraits/women/29.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_ig_ana","user","Zdravo 😊 Da li imate 'Moć sadašnjeg trenutka' od Ekharta Tolija na stanju?",t(2,20),"instagram","Ana Živković","https://randomuser.me/api/portraits/women/29.jpg"),
            ms("bs_ig_ana","assistant","Zdravo Ana! Da, Moć sadašnjeg trenutka je na stanju — cena 1.490 din. Slobodna poštarina za narudžbine iznad 2.500 din. Preporučujem i 'Nova Zemlja' od istog autora kao sjajnu pratnju 🙏",t(2,18),"instagram","Ana Živković","https://randomuser.me/api/portraits/women/29.jpg"),
            ms("bs_ig_ana","user","Super! Koliko košta dostava do Novog Sada?",t(2,5),"instagram","Ana Živković","https://randomuser.me/api/portraits/women/29.jpg"),
            ms("bs_ig_ana","assistant","Dostava do Novog Sada je 350 din (BEX Express, 2-3 dana). Uz dve knjige prelazite limit za besplatnu dostavu 📦 Naručite na harmonijaknjige.rs ili ostavite email za direktan link.",t(2,3),"instagram","Ana Živković","https://randomuser.me/api/portraits/women/29.jpg"),
        ]},
        // Instagram — Intervencija (lost shipment, needs human)
        { id: "bs_ig_milos", platform: "instagram", name: "Miloš Jevtić", pic: "https://randomuser.me/api/portraits/men/41.jpg", humanNeeded: true, phone: null, msgs: [
            ms("bs_ig_milos","user","Narucio sam knjigu pre 10 dana i jos nisam dobio nista. Placen post ekspres!",t(4,10),"instagram","Miloš Jevtić","https://randomuser.me/api/portraits/men/41.jpg"),
            ms("bs_ig_milos","assistant","Miloše, razumem frustraciju — 10 dana jeste predugo. Prosleđujem vaš slučaj timu odmah. Možete li mi dati email ili broj narudžbine?",t(4,8),"instagram","Miloš Jevtić","https://randomuser.me/api/portraits/men/41.jpg"),
            ms("bs_ig_milos","user","milos.jevtic87@gmail.com, narudžbina od 4. aprila",t(4,5),"instagram","Miloš Jevtić","https://randomuser.me/api/portraits/men/41.jpg"),
            ms("bs_ig_milos","system","[HUMAN_NEEDED]",t(4,4),"instagram","Miloš Jevtić","https://randomuser.me/api/portraits/men/41.jpg",{ human_needed: true }),
        ]},
        // Facebook — gift recommendation flow
        { id: "bs_fb_zorana", platform: "facebook", name: "Zorana Blagojević", pic: "https://randomuser.me/api/portraits/women/52.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_fb_zorana","user","Dobar dan, tražim poklon za prijatelju koja voli psihologiju i razvoj ličnosti",t(6,15),"facebook","Zorana Blagojević","https://randomuser.me/api/portraits/women/52.jpg"),
            ms("bs_fb_zorana","assistant","Dobar dan! Odlično 🎁 Za ljubitelje psihologije, top 3 preporuke: Atomske navike (navike i produktivnost), Moć sadašnjeg trenutka (mindfulness), Mit o normalnom (trauma i telo). Koliko godina ima prijateli?",t(6,13),"facebook","Zorana Blagojević","https://randomuser.me/api/portraits/women/52.jpg"),
            ms("bs_fb_zorana","user","35, bavi se meditacijom — hvala, uzimam Moć sadašnjeg trenutka!",t(6,5),"facebook","Zorana Blagojević","https://randomuser.me/api/portraits/women/52.jpg"),
            ms("bs_fb_zorana","assistant","Savršen izbor za nju 🙏 Naručite na harmonijaknjige.rs ili mi ostavite email za direktan link ka knjizi.",t(6,3),"facebook","Zorana Blagojević","https://randomuser.me/api/portraits/women/52.jpg"),
        ]},
        // WhatsApp — bulk corporate order
        { id: "bs_wa_svetlana", platform: "whatsapp", name: "Svetlana Jović", pic: "https://randomuser.me/api/portraits/women/68.jpg", humanNeeded: false, phone: "svetlana.jovic@firma.rs", msgs: [
            ms("bs_wa_svetlana","user","Zdravo, zanima me da naručim 8-10 knjiga za kolege kao poklon. Ima li popust za veće narudžbine?",t(8,0),"whatsapp","Svetlana Jović","https://randomuser.me/api/portraits/women/68.jpg"),
            ms("bs_wa_svetlana","assistant","Zdravo Svetlana! Za grupne narudžbine od 8+ knjiga možemo dogovoriti popust 10-15%. Bestselleri za korporativne poklone: Atomske navike, Ikigaj, Nesavršeni roditelji. Da li biste voleli ponudu na email?",t(7,55),"whatsapp","Svetlana Jović","https://randomuser.me/api/portraits/women/68.jpg"),
            ms("bs_wa_svetlana","user","Da, sjajno! svetlana.jovic@firma.rs",t(7,50),"whatsapp","Svetlana Jović","https://randomuser.me/api/portraits/women/68.jpg"),
            ms("bs_wa_svetlana","assistant","Odlično, šaljemo vam detaljnu ponudu u roku od sat vremena. Hvala Svetlana! 📚",t(7,48),"whatsapp","Svetlana Jović","https://randomuser.me/api/portraits/women/68.jpg"),
        ]},
        // Website — delivery/pricing question, resolved
        { id: "bs_web_petra", platform: "website", name: "Petra Stojanović", pic: "https://randomuser.me/api/portraits/women/77.jpg", humanNeeded: false, phone: null, msgs: [
            ms("bs_web_petra","user","Zdravo, cena na sajtu za 'Budite oslonac svojoj deci' — je li to sa ili bez dostave?",t(1,30),"website","Petra Stojanović","https://randomuser.me/api/portraits/women/77.jpg"),
            ms("bs_web_petra","assistant","Zdravo Petra! Cena od 1.590 din je bez dostave. Dostava je 350 din, ali je besplatna za narudžbine iznad 2.500 din 😊 Uz ovu knjigu dodajte još jednu i dostava je gratis.",t(1,28),"website","Petra Stojanović","https://randomuser.me/api/portraits/women/77.jpg"),
            ms("bs_web_petra","user","I da li šaljete subotom?",t(1,20),"website","Petra Stojanović","https://randomuser.me/api/portraits/women/77.jpg"),
            ms("bs_web_petra","assistant","Da, slažemo subotom za narudžbine do petka u 13h. BEX Express — 1-2 dana za Beograd, 2-3 za ostatak Srbije 📦 Naručite danas i možete očekivati dostavu u utorak.",t(1,18),"website","Petra Stojanović","https://randomuser.me/api/portraits/women/77.jpg"),
        ]},
        // Website — address correction, needs human
        { id: "bs_web_dragan", platform: "website", name: "Dragan Nikolić", pic: "https://randomuser.me/api/portraits/men/72.jpg", humanNeeded: true, phone: null, msgs: [
            ms("bs_web_dragan","user","Naručio sam knjigu i sad vidim da sam upisao pogrešnu adresu. Mogu li da promenim?",t(0,30),"website","Dragan Nikolić","https://randomuser.me/api/portraits/men/72.jpg"),
            ms("bs_web_dragan","assistant","Dragan, rešivemo odmah! Ako narudžbina još nije otpremljena, adresa može da se koriguje. Daj mi email ili broj narudžbine da proverim status.",t(0,28),"website","Dragan Nikolić","https://randomuser.me/api/portraits/men/72.jpg"),
            ms("bs_web_dragan","user","dragan.nikolic@gmail.com",t(0,25),"website","Dragan Nikolić","https://randomuser.me/api/portraits/men/72.jpg"),
            ms("bs_web_dragan","system","[HUMAN_NEEDED]",t(0,24),"website","Dragan Nikolić","https://randomuser.me/api/portraits/men/72.jpg",{ human_needed: true }),
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

export function SocialChatbotModule({ clientId, selectedBrandIds }: SocialChatbotModuleProps) {
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

    // Reset selection when brand set changes so we don't show a conversation from a hidden brand
    useEffect(() => {
        setSelectedId(null)
    }, [brandIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (conversations.length > 0 && !selectedId) setSelectedId(conversations[0].id)
    }, [conversations, selectedId])

    const selected = conversations.find(c => c.id === selectedId)
    const currentMessages = selected?.messages
        .filter((m: any) => m.role !== "system")
        .slice()
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) ?? []

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [selectedId, currentMessages.length])

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

    const _baseUpiti = DEMO_MODE ? 524 : conversations.length
    const upitiPeriod = msgPeriod === "danas" ? Math.round(_baseUpiti / 30) : msgPeriod === "sedmica" ? Math.round(_baseUpiti / 4 * 1.2) : _baseUpiti

    const _baseKonverzije = DEMO_MODE ? 142 : allMessages.filter(m =>
        m.role === "user" && (isCatalogProducts
            ? ["cena", "kupim", "narudžbin", "naruč", "dostav", "plaćan"].some(kw => m.message?.toLowerCase().includes(kw))
            : ["prijavim", "prijaviti", "prijavl", "zainteresova"].some(kw => m.message?.toLowerCase().includes(kw))
        )
    ).length
    const prijavePeriod = msgPeriod === "danas" ? Math.round(_baseKonverzije / 30) : msgPeriod === "sedmica" ? Math.round(_baseKonverzije / 4 * 1.5) : _baseKonverzije

    const _baseMsgs = DEMO_MODE ? 1340 : allMessages.filter(m => m.role !== "system").length
    const msgCount = msgPeriod === "danas" ? Math.round(_baseMsgs / 30 * 1.2) : msgPeriod === "sedmica" ? Math.round(_baseMsgs / 4 * 1.1) : _baseMsgs

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
                        Social{" "}
                        <span style={{ background: "linear-gradient(120deg, #f472b6, #c084fc, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            Inbox
                        </span>
                    </h2>
                    <p className="text-[11px] font-mono text-zinc-500 mt-0.5 tracking-wider">
                        {isMultiBrand
                            ? `Svi brendovi · ${brandIds.length} brenda`
                            : bookStoreConfig
                                ? `${bookStoreConfig.brandName} AI Agent · Multi-channel`
                                : "SmartFlow AI Agent · Multi-channel"}
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
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-500/20 bg-pink-500/[0.07]">
                                <Instagram className="w-3 h-3 text-pink-400" />
                                <span className="text-[10px] font-mono font-bold text-pink-400 tracking-wide">{bookStoreConfig ? bookStoreConfig.instagramHandle : "@smartflow.rs"}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.07] bg-white/[0.03]">
                                <Globe className="w-3 h-3 text-zinc-400" />
                                <span className="text-[10px] font-mono text-zinc-400 tracking-wide">{bookStoreConfig ? bookStoreConfig.websiteUrl : "smartflow.rs"}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Stats ──────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 shrink-0">
                <StatCard icon={<MessageCircle className="w-4 h-4" />} label={`Upiti · ${periodLabel}`} value={upitiPeriod} variant="pink" />
                <StatCard icon={<UserCheck className="w-4 h-4" />} label={`${isCatalogProducts ? "Zainteresovani" : "Prijave"} · ${periodLabel}`} value={prijavePeriod} variant="emerald" />
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
                                mobilePanel === tab.key ? "bg-pink-500/20 text-pink-400" : "text-zinc-600 hover:text-zinc-400"
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
                                {channelFilter === 'all' ? conversations.length : conversations.filter(c => c.platform?.toLowerCase() === channelFilter).length}
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
                        {conversations.filter(c => channelFilter === 'all' || c.platform?.toLowerCase() === channelFilter).map((conv, idx) => {
                            const isSelected = selectedId === conv.id
                            const pm = getPlatformMeta(conv.platform)
                            const name = getDisplayName(conv)
                            const convBrandConfig = getBookStoreConfig(conv.brandId ?? clientId)
                            const brandColor = convBrandConfig?.color
                            return (
                                <motion.button
                                    key={conv.id}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                                    onClick={() => { setSelectedId(conv.id); setMobilePanel("chat") }}
                                    className={cn(
                                        "w-full text-left px-4 py-3.5 transition-all duration-200 relative border-l-2",
                                        isSelected
                                            ? "bg-pink-500/[0.08] border-l-pink-500"
                                            : "hover:bg-white/[0.03]"
                                    )}
                                    style={!isSelected ? { borderLeftColor: brandColor ? `${brandColor}50` : 'transparent', borderLeftWidth: '2px', borderLeftStyle: 'solid' } : undefined}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            <Avatar conv={conv} size="md" />
                                            {conv.humanNeeded && (
                                                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-[#0d0d14] flex items-center justify-center">
                                                    <span className="text-[7px] font-black text-black leading-none">!</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                                <span className="text-sm font-semibold text-white truncate font-outfit">{name}</span>
                                                <span className="text-[9px] font-mono text-zinc-600 shrink-0">
                                                    {format(new Date(conv.lastVisibleMessage.created_at), "d.M HH:mm")}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <pm.Icon className={cn("w-2.5 h-2.5", pm.color)} />
                                                <span className={cn("text-[9px] font-mono font-bold uppercase tracking-wider", pm.color)}>{pm.label}</span>
                                                {isMultiBrand && convBrandConfig && (
                                                    <span
                                                        className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none"
                                                        style={{ color: convBrandConfig.color, background: `${convBrandConfig.color}15`, border: `1px solid ${convBrandConfig.color}30` }}
                                                    >
                                                        {convBrandConfig.brandName.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-500 truncate leading-relaxed">
                                                {conv.lastVisibleMessage?.role === "assistant" ? "🤖 " : ""}
                                                {conv.lastVisibleMessage?.message?.substring(0, 50)}
                                            </p>
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
                                                        : "text-white rounded-tr-none shadow-lg"
                                                )}
                                                style={!isUser ? { background: "linear-gradient(135deg, #7c3aed, #db2777)" } : undefined}
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
                                                <span className={cn("text-[10px] mt-1.5 block font-mono", isUser ? "opacity-35 text-zinc-400" : "opacity-40 text-white")}>
                                                    {format(new Date(msg.created_at), "HH:mm")}
                                                </span>
                                            </div>
                                        </motion.div>
                                    )
                                })}
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
                                        className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500/50"
                                    />
                                    <button 
                                        type="submit"
                                        className="bg-pink-500/90 hover:bg-pink-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                                    >
                                        Pošalji
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                            <div className="w-14 h-14 rounded-2xl border border-pink-500/20 bg-pink-500/[0.06] flex items-center justify-center">
                                <Inbox className="w-6 h-6 text-pink-500/40" />
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
                            {/* Profile card */}
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden backdrop-blur-xl shrink-0">
                                {/* Cover */}
                                <div
                                    className="h-14 relative overflow-hidden"
                                    style={{ background: `linear-gradient(135deg, ${getPlatformMeta(selected.platform).gradFrom}33, ${getPlatformMeta(selected.platform).gradTo}55)` }}
                                >
                                    {(() => {
                                        const pm = getPlatformMeta(selected.platform)
                                        return <pm.Icon className={cn("absolute right-3 bottom-2 w-5 h-5 opacity-25", pm.color)} />
                                    })()}
                                </div>
                                <div className="px-4 pb-4">
                                    {/* Avatar overlapping cover */}
                                    <div className="-mt-5 mb-2.5">
                                        <Avatar conv={selected} size="lg" className="border-2 border-[#111118]" />
                                    </div>
                                    <p className="font-semibold text-white text-sm font-outfit leading-tight">
                                        {getFullName(selected) || getDisplayName(selected)}
                                    </p>
                                    <p className="text-[10px] font-mono text-zinc-600 mt-0.5 truncate" title={selected.id}>
                                        ID: {selected.id.substring(0, 14)}…
                                    </p>
                                    {/* Badges */}
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {(() => {
                                            const pm = getPlatformMeta(selected.platform)
                                            return (
                                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border border-current/20 bg-current/5", pm.color)}>
                                                    <pm.Icon className="w-2 h-2" />
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
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-xl shrink-0">
                                <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest mb-3">Kontakt Info</p>
                                <div className="space-y-3">
                                    <InfoRow icon={<Hash />} label="Meta Sender ID" value={selected.id.substring(0, 12) + "…"} mono />
                                    <InfoRow icon={<Instagram />} label="Platforma" value={getPlatformMeta(selected.platform).label + " DM"} />
                                    <InfoRow icon={<Phone />} label="Telefon" value={selected.phone || "—"} />
                                    <InfoRow
                                        icon={<Globe />}
                                        label="Website"
                                        value={bookStoreConfig ? bookStoreConfig.websiteUrl : "smartflow.rs"}
                                        link={bookStoreConfig ? `https://${bookStoreConfig.websiteUrl}` : "https://smartflow.rs"}
                                    />
                                </div>
                            </div>

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

                            {/* AI Agent info */}
                            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 backdrop-blur-xl shrink-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">AI Agent Aktivan</span>
                                </div>
                                <p className="text-[11px] font-mono text-zinc-500 leading-relaxed">
                                    {bookStoreConfig ? `${bookStoreConfig.brandName} AI Agent obradjuje poruke 24/7 i automatski odgovara kupcima na svim kanalima.` : "SmartFlow AI Agent obradjuje poruke 24/7 i automatski odgovara kandidatima na svim kanalima."}
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
