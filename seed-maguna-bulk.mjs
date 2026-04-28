/**
 * Bulk seed — adds ~55 more conversations to razgovori and ~33 more records to crm_maguna
 * so that all dashboard modules (AI Agent inbox, analytics, CRM) show consistent numbers.
 *
 * Target after seeding:
 *   razgovori:  ~65 conversations, ~310 messages (30-day window)
 *   crm_maguna: ~45 records, ~40% conversion
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://ndazbdkytcksmhoabtgs.supabase.co"
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k"
const CLIENT_ID    = "0c25e7c2-360c-418a-816a-34444d304698"

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

function daysAgo(d, h = 10, m = 0) {
    const dt = new Date()
    dt.setDate(dt.getDate() - d)
    dt.setHours(h, m, 0, 0)
    return dt.toISOString()
}

// ── Conversation definitions ──────────────────────────────────────────────────
// Each entry becomes one thread in razgovori.
// format: { id, platform, name, daysBack, msgs: [{role, text, minutesOffset}], crm? }

const NAMES = [
    ["Jelena Marković", "jelena.markovic"], ["Petar Savić", "petar.savic"],
    ["Ana Nikolić", "ana.nikolic2"], ["Marko Đorđević", "marko.djordjevic"],
    ["Ivana Popović", "ivana.popovic"], ["Stefan Jović", "stefan.jovic"],
    ["Milena Stanković", "milena.stankovic"], ["Vladimir Ristić", "vladimir.ristic"],
    ["Tamara Vuković", "tamara.vukovic"], ["Nikola Ilić", "nikola.ilic"],
    ["Bojana Đukić", "bojana.djukic"], ["Aleksandar Tošić", "aleksandar.tosic"],
    ["Sara Lazić", "sara.lazic"], ["Miloš Petković", "milos.petkovic"],
    ["Dragana Simić", "dragana.simic"], ["Filip Matić", "filip.matic"],
    ["Jovana Kovačević", "jovana.kovacevic"], ["Nemanja Stojanović", "nemanja.stojanovic"],
    ["Kristina Đurić", "kristina.djuric"], ["Branko Vasić", "branko.vasic"],
    ["Tijana Lukić", "tijana.lukic"], ["Uroš Pejić", "uros.pejic"],
    ["Nataša Bogdanović", "natasa.bogdanovic"], ["Đorđe Milošević", "djordje.milosevic"],
    ["Vesna Pavlović", "vesna.pavlovic"], ["Igor Janković", "igor.jankovic"],
    ["Slađana Filipović", "sladjana.filipovic"], ["Vanja Radović", "vanja.radovic"],
    ["Dejan Živković", "dejan.zivkovic"], ["Andrijana Stevanović", "andrijana.stevanovic"],
    ["Lazar Antonić", "lazar.antonic"], ["Milica Vukić", "milica.vukic"],
    ["Srđan Đević", "srdjan.djevic"], ["Katarina Obradović", "katarina.obradovic"],
    ["Zoran Milovanović", "zoran.milovanovic"], ["Maja Hadžić", "maja.hadzic"],
    ["Ivan Stević", "ivan.stevic"], ["Nevena Aleksić", "nevena.aleksic"],
    ["Predrag Nastić", "predrag.nastic"], ["Radmila Spasić", "radmila.spasic"],
    ["Goran Đenić", "goran.djenic"], ["Dunja Marić", "dunja.maric"],
    ["Saša Perić", "sasa.peric"], ["Tanja Milić", "tanja.milic"],
    ["Miodrag Knežević", "miodrag.knezevic"], ["Gordana Vukovic2", "gordana.vukovic2"],
    ["Bojan Tomić", "bojan.tomic2"], ["Olivera Đorić", "olivera.djoric"],
    ["Milan Zdravković", "milan.zdravkovic"], ["Snežana Ninić", "snezana.ninic"],
    ["Danilo Stefanović", "danilo.stefanovic"], ["Zorica Jovović", "zorica.jovovic"],
    ["Nenad Ranković", "nenad.rankovic"], ["Veselin Paunović", "veselin.paunovic"],
    ["Rada Milić", "rada.milic2"],
]

const PLATFORMS = ["instagram","instagram","instagram","facebook","facebook","website"]

const CONVERSATIONS = [
    // ── Quick orders ──────────────────────────────────────────────────────────
    { days:1,  platform:"instagram", msgs:[
        {role:"user",      text:"Zdravo! Kolika je cena sklopivog stola kutija beli 70x70?", min:0},
        {role:"assistant", text:"Zdravo! Sklopivi sto kutija BELI 70×70 cm je 13.900 RSD. Dostupan odmah, dostava 2-3 radna dana. Želite da naručite?", min:2},
        {role:"user",      text:"Da, naručujem. Adresa je Bulevar Oslobođenja 45, Beograd.", min:5},
        {role:"assistant", text:"Odlično! Narudžbina je evidentirana. Kurirska služba će vas kontaktirati sutra za dostavu. 📦", min:7},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto kutija BELI 70×70", status:"Poručio", status_porudzbine:"Poslato"}},

    { days:1, platform:"facebook", msgs:[
        {role:"user",      text:"Imam dete od 4 godine, šta preporučujete?", min:0},
        {role:"assistant", text:"Za uzrast 4 godine odlično odgovara naš Sklopivi dečiji sto i stolica SET — stabilan, lak za čišćenje, 11.800 RSD. Ima i garnitura sa dve stolice. Zanima vas?", min:3},
        {role:"user",      text:"Da zanima me, pošaljite mi više slika", min:6},
        {role:"assistant", text:"Naravno! Šaljem vam galeriju sa svim bojama i dimenzijama. Koji grad ste? Da proverim dostupnost.", min:8},
    ], crm:{kategorija:"Dečiji nameštaj", proizvod:"Sklopivi dečiji sto i stolica SET", status:"Zainteresovan", razlog:"Čeka više slika"}},

    { days:2, platform:"instagram", msgs:[
        {role:"user",      text:"Zdravo, radim od kuće i trebam sto koji ne zauzima puno mesta", min:0},
        {role:"assistant", text:"Savršen izbor je naš Sklopivi radni sto BELI 100×60 cm — sklopi se za par sekundi i stane u orman. Cena 16.500 RSD, dostava cela Srbija.", min:2},
        {role:"user",      text:"Super! Da li ima i u crnoj boji?", min:5},
        {role:"assistant", text:"Za radne stolove trenutno imamo samo belu i sivi hrast. Da vas obaveštim kada dođe crna?", min:7},
        {role:"user",      text:"Da molim vas, ostavite moj broj 063/221-445", min:10},
        {role:"assistant", text:"Zapisano! Čim bude dostupna crna varijanta, javljamo se. Hvala!", min:12},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto BELI 100×60", status:"Zainteresovan", razlog:"Nema u crnoj boji"}},

    { days:2, platform:"website", msgs:[
        {role:"user",      text:"Da li dostavate u Novi Sad?", min:0},
        {role:"assistant", text:"Da, dostavljamo po celoj Srbiji! Novi Sad — dostava 1-2 radna dana. Koji sto vas zanima?", min:1},
        {role:"user",      text:"Stočić za šminkanje sa ogledalom", min:3},
        {role:"assistant", text:"Stočić za šminkanje sa velikim ogledalom je 22.500 RSD. Dolazi u beloj boji sa ladicama. Ima i LED osvetljenje u premium verziji za 26.800 RSD. Što vam odgovara?", min:5},
        {role:"user",      text:"Uzimam osnovni model. Kako plaćam?", min:8},
        {role:"assistant", text:"Plaćanje pouzećem ili uplatom unapred (5% popust). Koji datum vam odgovara za dostavu?", min:10},
        {role:"user",      text:"Petak, 2. maj", min:13},
        {role:"assistant", text:"Petak 2. maj je potvrđen. Ostavljamo narudžbinu. Puno hvala! 🎉", min:15},
    ], crm:{kategorija:"Šminkanje", proizvod:"Stočić za šminkanje sa ogledalom", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:3, platform:"instagram", msgs:[
        {role:"user",      text:"Koliko se sklopi sto kutija, kolika su max gabaritna pri sklapanju?", min:0},
        {role:"assistant", text:"Sto kutija BELI 70×70 se sklopi na 73×70×7 cm — stane i ispod kreveta! Težina 8 kg. Puno slika imam na profilu ako pogledate 👇", min:3},
        {role:"user",      text:"Hvala, razmisliću", min:6},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto kutija BELI 70×70", status:"Zainteresovan", razlog:"Nije odgovorio"}},

    { days:3, platform:"facebook", msgs:[
        {role:"user",      text:"Imam malu garsonjeru 28m2, šta mi preporučujete za trpezariju?", min:0},
        {role:"assistant", text:"Za malu garsonjeru je idealan Sklopivi sto za 4 osobe BELI sa nogama — kada nije u upotrebi zauzima samo 10 cm dubine uz zid. Cena 19.900 RSD. Ima i verzija za 6 osoba.", min:4},
        {role:"user",      text:"A da li je stabilan? Videla sam na TikToku da neki stolovi pucaju", min:7},
        {role:"assistant", text:"Razumem zabrinutost! Naši stolovi su od bukve i MDF-a, nosivost do 80 kg. Garantujemo 2 godine. Ako želite mogu vam poslati video testa čvrstoće.", min:9},
        {role:"user",      text:"Da pošaljite video i cenovnik za dostavu u Kruševac", min:12},
        {role:"assistant", text:"Video šaljem u DM-u odmah. Kruševac — dostava 350 RSD, 3-4 dana. 👍", min:14},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto za 4 osobe BELI", status:"Zainteresovan", razlog:"Pita za termin isporuke"}},

    { days:4, platform:"instagram", msgs:[
        {role:"user",      text:"Kolika je cena stočića za šminkanje LUKSUZ roza?", min:0},
        {role:"assistant", text:"Stočić za šminkanje LUKSUZ roza je 29.500 RSD — dolazi sa led ogledalom, 5 ladicom i tapecirani taburet. Pravi luksuz! Ima i bela i mint varijanta.", min:3},
        {role:"user",      text:"Uzimam roze za poklon ćerki. Kako naručujem?", min:6},
        {role:"assistant", text:"Odlično! Pišite nam email ili DM sa adresom isporuke i brojem telefona, pa šaljemo fakturu. Mogu i gift-wrapping na zahtev 🎁", min:8},
        {role:"user",      text:"OK šaljem email odmah", min:10},
        {role:"assistant", text:"Čekamo vas! Email: magunadizajn@gmail.com 📧", min:11},
    ], crm:{kategorija:"Šminkanje", proizvod:"Stočić za šminkanje LUKSUZ roza", status:"Poručio", status_porudzbine:"Poslato"}},

    { days:4, platform:"website", msgs:[
        {role:"user",      text:"Dete mi ima 6 godina, koliki sto mu treba za crtanje?", min:0},
        {role:"assistant", text:"Za 6 godina odlično odgovara naš Dečiji sto sa policama BEO — visina 55 cm, može da se prilagodi. Dolazi sa stolicom i ima policu za knjige. 14.900 RSD.", min:2},
        {role:"user",      text:"A da li je sigurno za decu? Oštre ivice?", min:5},
        {role:"assistant", text:"Sve ivice su zaobljene i bezbedne za decu. Materijal je E1 MDF bez štetnih hemikalija. Sertifikovan za decu od 3+.", min:7},
        {role:"user",      text:"Super, naručujem. Plaćanje karticom?", min:10},
        {role:"assistant", text:"Karticom nažalost ne, ali možete uplatom na račun ili pouzećem. Šaljete adresu?", min:12},
        {role:"user",      text:"Šaljem odmah na mejl", min:14},
    ], crm:{kategorija:"Dečiji nameštaj", proizvod:"Dečiji sto sa policama BEO", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:5, platform:"instagram", msgs:[
        {role:"user",      text:"Imate li popust za više komada? Treba mi 3 stola ista za firmu", min:0},
        {role:"assistant", text:"Za porudžbine 3+ komada dajemo 10% popust. Za firme možemo i fakturu sa PDV-om. Koji model vas zanima?", min:3},
        {role:"user",      text:"Sklopivi radni sto beli 100x60, treba 3 komada", min:6},
        {role:"assistant", text:"3 komada = 3×16.500 − 10% = 44.550 RSD. Faktura + dostava gratis za Beograd. Šaljemo ponudu na email?", min:9},
        {role:"user",      text:"Da, email je office@agencija.rs", min:12},
        {role:"assistant", text:"Ponuda je poslata! Važi 7 dana. Javite se sa bilo kojim pitanjem. 🤝", min:15},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto BELI 100×60", status:"Zainteresovan", razlog:"Čeka odgovor na email"}},

    { days:5, platform:"facebook", msgs:[
        {role:"user",      text:"Koliko traje dostava u Kragujevac?", min:0},
        {role:"assistant", text:"Kragujevac — dostava 2-3 radna dana, cena 350 RSD. Koji sto naručujete?", min:2},
        {role:"user",      text:"Stočić za šminkanje sa ogledalom, beli", min:4},
        {role:"assistant", text:"Odlično! Stočić za šminkanje beli je 22.500 + 350 dostava = 22.850 RSD ukupno. Način plaćanja?", min:6},
        {role:"user",      text:"Pouzećem, adresa je Cara Dušana 12, Kragujevac", min:9},
        {role:"assistant", text:"Narudžbina potvrđena! Pakujemo danas, kurirska služba preuzima sutra. Hvala! 🎉", min:11},
    ], crm:{kategorija:"Šminkanje", proizvod:"Stočić za šminkanje sa ogledalom", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:6, platform:"instagram", msgs:[
        {role:"user",      text:"Postoji li sto koji može da se koristi i za ručavanje i za rad?", min:0},
        {role:"assistant", text:"Da! Naš Sklopivi radni sto sa policom 120×60 je idealan — velika radna površina, polica za laptop i knjige, a kad gosti dođu skupi se za par sekundi. 21.500 RSD.", min:4},
        {role:"user",      text:"Super izgleda! Šaljete u Niš?", min:7},
        {role:"assistant", text:"Šaljemo celu Srbiju! Niš — 2-3 dana, dostava 350 RSD. Naručujete?", min:9},
        {role:"user",      text:"Razmisliću, hvala", min:12},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto sa policom 120×60", status:"Zainteresovan", razlog:"Nije odgovorio"}},

    { days:7, platform:"instagram", msgs:[
        {role:"user",      text:"Ima li sto za balkon otporan na kišu?", min:0},
        {role:"assistant", text:"Naši stolovi su za unutrašnju upotrebu — za balkon bih preporučio naše sklopive stolove od plastike (nemamo u ponudi), ali sklopivi sto kutija može na natkrivenom balkonu bez direktne kiše.", min:5},
        {role:"user",      text:"Ok razumem, hvala na iskrenosti", min:8},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:null, status:"Novi"}},

    { days:7, platform:"facebook", msgs:[
        {role:"user",      text:"Zdravo! Imam reklamaciju na sto koji sam naručila pre mesec dana, nogica se odlomila", min:0},
        {role:"assistant", text:"Žao nam je! Odmah eskaliramo reklamaciju servisu. Pošaljite sliku oštećenja na magunadizajn@gmail.com i naš tim će reagovati u roku od 24h sa rešenjem.", min:3},
        {role:"user",      text:"OK šaljem slike", min:6},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto BELI 100×60", status:"Intervencija", razlog:"Reklamacija"}},

    { days:8, platform:"instagram", msgs:[
        {role:"user",      text:"Koliko košta dečija kuhinjica?", min:0},
        {role:"assistant", text:"Dečija kuhinjica mala (za uzrast 2-5 god.) je 12.500 RSD, srednja 14.500 RSD, a sa frižiderom 16.500 RSD. Sve dolaze u beloj boji. Koji uzrast deteta?", min:2},
        {role:"user",      text:"3 godine", min:4},
        {role:"assistant", text:"Za 3 godine savršena je mala — stabilna, prava visina, ima šporet, sudoper i police. Naručujete?", min:6},
        {role:"user",      text:"Naručujem. Adresa Vojvode Stepe 88, Beograd", min:9},
        {role:"assistant", text:"Narudžbina je primljena! Isporuka za 2-3 radna dana. Hvala! 😊", min:11},
    ], crm:{kategorija:"Dečiji nameštaj", proizvod:"Dečija kuhinjica mala", status:"Poručio", status_porudzbine:"Poslato"}},

    { days:9, platform:"website", msgs:[
        {role:"user",      text:"Koji sto preporučujete za WFH (rad od kuće) u stanu 45m2?", min:0},
        {role:"assistant", text:"Za WFH u manjem stanu preporučujemo Sklopivi sto za laptop 60×40 — sklopi se za 5 sekundi, ne zauzima gotovo ništa mesta. 9.800 RSD. Ili ako trebate više prostora, radni 100×60 za 16.500 RSD.", min:3},
        {role:"user",      text:"100x60 deluje bolje. Ima li na zalihama?", min:6},
        {role:"assistant", text:"Da, ima na stanju! Moguća isporuka već sutra za Beograd. Potvrđujete narudžbinu?", min:8},
        {role:"user",      text:"Da, potvrđujem. Šaljem email sa adresom.", min:11},
        {role:"assistant", text:"Odlično, čekamo vas! Email: magunadizajn@gmail.com 👍", min:12},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto BELI 100×60", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:10, platform:"instagram", msgs:[
        {role:"user",      text:"Dobar dan, imam pitanje — da li se sto isporučuje montiran ili u dijelovima?", min:0},
        {role:"assistant", text:"Dobar dan! Svi naši stolovi dolaze već montirani, samo ih otpakujete i koristite odmah. Nema šrafova ni alata. 😊", min:3},
        {role:"user",      text:"Odlično! Naručujem sklopivi sto kutija 70x70 beli", min:6},
        {role:"assistant", text:"Super! Adresa isporuke?", min:8},
        {role:"user",      text:"Cara Lazara 7, Subotica", min:10},
        {role:"assistant", text:"Subotica — 3-4 radna dana, 350 RSD dostava. Narudžbina potvrđena! 📦", min:12},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto kutija BELI 70×70", status:"Poručio", status_porudzbine:"Poslato"}},

    { days:11, platform:"facebook", msgs:[
        {role:"user",      text:"Imam mali stan i trebam nešto za pisanje detetu. Šta imate?", min:0},
        {role:"assistant", text:"Za pisanje u malom stanu idealan je Sklopivi dečiji sto i stolica SET — kompaktan, siguran, 11.800 RSD. Sklopi se i stane uz zid. Koliko ima godina detetu?", min:4},
        {role:"user",      text:"7 godina. A da li ima dovoljno prostora za pisanje zadataka?", min:7},
        {role:"assistant", text:"Površina je 60×40 cm, dovoljno za sveske, udžbenike i lak top. Za 7 godina savršena veličina. Naručujete?", min:9},
        {role:"user",      text:"Da, naručujem pouzećem. Adresa Cara Dušana 34, Zemun.", min:13},
        {role:"assistant", text:"Potvrđeno! Zemun isporuka sutra. Hvala na narudžbini! 🎉", min:15},
    ], crm:{kategorija:"Dečiji nameštaj", proizvod:"Sklopivi dečiji sto i stolica SET", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:12, platform:"instagram", msgs:[
        {role:"user",      text:"Kolika je visina stočića za šminkanje?", min:0},
        {role:"assistant", text:"Stočić za šminkanje sa ogledalom — visina 130 cm (sa ogledalom), sedišna visina taboureta 45 cm. Idealno za odrasle.", min:2},
        {role:"user",      text:"A ima li niži model?", min:5},
        {role:"assistant", text:"Za sada nemamo niži model u ponudi. Možemo vas obaveštiti ako ga uvedemo u asortiaman?", min:7},
        {role:"user",      text:"Da molim, broj 064/333-222", min:9},
        {role:"assistant", text:"Zapisano! Javljamo se čim bude dostupno. Hvala!", min:11},
    ], crm:{kategorija:"Šminkanje", proizvod:null, status:"Zainteresovan", razlog:"Nema odgovarajuće veličine"}},

    { days:13, platform:"website", msgs:[
        {role:"user",      text:"Poštovanje, radim video sadržaj i trebam sto koji može da se sklopi brzo između snimanja", min:0},
        {role:"assistant", text:"Odlično za produkciju! Naš Sklopivi radni sto sa policom 120×60 je profesionalnog kvaliteta i sklopi se za 8 sekundi. Ima i policu za opremu. 21.500 RSD.", min:3},
        {role:"user",      text:"Super! Ima li i u crnoj boji? Bolje za video pozadinu", min:6},
        {role:"assistant", text:"Crna verzija je u pripremi za sledeći mesec! Možemo vas staviti na listu čekanja i obavestiti prvog.", min:8},
        {role:"user",      text:"Molim stavite na listu. Email: studio@kreativni.rs", min:11},
        {role:"assistant", text:"Na listi ste! Email je evidentiran. 🎬", min:13},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto sa policom 120×60", status:"Zainteresovan", razlog:"Čeka crnu boju"}},

    { days:14, platform:"instagram", msgs:[
        {role:"user",      text:"Zdravo! Gledam vaš TikTok, divni su stolovi. Koliko košta onaj beli koji se sklopi u kutiju?", min:0},
        {role:"assistant", text:"Hvala puno! ❤️ Sklopivi sto kutija BELI 70×70 je 13.900 RSD, a ima i manji 60×60 za 11.800 RSD. Koji bi vam odgovarao?", min:3},
        {role:"user",      text:"Uzimam 70x70. Kako se plaća?", min:6},
        {role:"assistant", text:"Plaćanje pouzećem ili uplatom (bez doplata). Adresa isporuke?", min:8},
        {role:"user",      text:"Nemanjina 15, Beograd, Vračar", min:10},
        {role:"assistant", text:"Vračar — isporuka sutra! Narudžbina potvrđena. 📦 Hvala!", min:12},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto kutija BELI 70×70", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:15, platform:"facebook", msgs:[
        {role:"user",      text:"Imam pitanje za dečiji sto — da li se može koristiti i za jelo i za crtanje?", min:0},
        {role:"assistant", text:"Apsolutno! Sklopivi dečiji sto je lako povrišina čisti — savršen i za obede i za zadatke. Presvlaka je vodootporna.", min:2},
        {role:"user",      text:"Super. Ima li na zalihama u Beogradu?", min:5},
        {role:"assistant", text:"Ima! Beograd — isporuka 1-2 radna dana. Naručujete?", min:7},
        {role:"user",      text:"Naručujem. Šaljem podatke u inbox", min:9},
        {role:"assistant", text:"Čekamo vas! 😊", min:11},
    ], crm:{kategorija:"Dečiji nameštaj", proizvod:"Sklopivi dečiji sto i stolica SET", status:"Poručio", status_porudzbine:"Poslato"}},

    { days:16, platform:"instagram", msgs:[
        {role:"user",      text:"Videla sam post sa stočićem za šminkanje, koji model je to bio?", min:0},
        {role:"assistant", text:"To je naš najpopularniji model — Stočić za šminkanje sa ogledalom, beli, 22.500 RSD. Velika radna površina, 3 ladice i taburet u kompletu.", min:3},
        {role:"user",      text:"Skupo mi malo. Ima li šta jeftinije?", min:6},
        {role:"assistant", text:"Imamo kompaktni model bez tabureta za 17.900 RSD. Ili može na 3 rate bez kamate ako platite karticom partnera. Da vas povežem?", min:9},
        {role:"user",      text:"OK hvala, razmisliću", min:12},
    ], crm:{kategorija:"Šminkanje", proizvod:"Stočić za šminkanje sa ogledalom", status:"Zainteresovan", razlog:"Cena previsoka"}},

    { days:17, platform:"website", msgs:[
        {role:"user",      text:"Dobro jutro! Trebam sto za terasu, natkrivenu.", min:0},
        {role:"assistant", text:"Dobro jutro! Za natkrivenu terasu može naš sklopivi sto kutija — nije potpuno otporan na vlagu ali na natkrivenom mestu bez direktne kiše traje odlično. Dimenzije 70×70, 13.900 RSD.", min:4},
        {role:"user",      text:"Naručujem. Plaćanje karticom je li moguće?", min:7},
        {role:"assistant", text:"Za online plaćanje karticom možete naručiti direktno sa maguna.rs — bezbedan checkout. Ili pouzećem na vašu adresu.", min:9},
        {role:"user",      text:"OK naručujem na sajtu direktno, hvala!", min:12},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto kutija BELI 70×70", status:"Poručio"}},

    { days:18, platform:"instagram", msgs:[
        {role:"user",      text:"Kolika je nosivost sklopivog radnog stola?", min:0},
        {role:"assistant", text:"Sklopivi radni sto BELI 100×60 — nosivost 60 kg. Stabilne čelične noge + MDF ploča. Testiran za dugotrajna opterećenja.", min:3},
        {role:"user",      text:"Super, imam dva monitora, mislio sam da je to previše", min:6},
        {role:"assistant", text:"Dva monitora oko 15kg — bez problema! Sto to podnosi lako. 💪", min:8},
        {role:"user",      text:"Odlično, naručujem!", min:10},
        {role:"assistant", text:"Super! Pošaljite adresu i narudžbina je vaša. 😊", min:12},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto BELI 100×60", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:19, platform:"facebook", msgs:[
        {role:"user",      text:"Imam restoran i treba mi 8 sklopivih stolova za terasu u leto", min:0},
        {role:"assistant", text:"Za restoran imamo B2B ponude! 8+ komada = 12% popust + dostava gratis + faktura sa PDV-om. Koji model vas zanima?", min:4},
        {role:"user",      text:"Sklopivi sto za 4 osobe, trebam spoljni ako imate", min:7},
        {role:"assistant", text:"Spoljne modele nemamo u ponudi, ali za natkrivene terase možemo preporučiti naš INOX model koji dolazi u septembru. Ostavite email da vas obavestimo?", min:10},
        {role:"user",      text:"Da, restoran@kafanadj.rs", min:13},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:null, status:"Zainteresovan", razlog:"Čeka spoljni model"}},

    { days:20, platform:"instagram", msgs:[
        {role:"user",      text:"Zdravo može pitanje? Koji je rok isporuke?", min:0},
        {role:"assistant", text:"Beograd i okolina: 1-2 radna dana. Ostala Srbija: 2-4 radna dana. Sve šaljemo kurirski sa praćenjem pošiljke.", min:2},
        {role:"user",      text:"OK hvala, naručujem sto kutija beli", min:5},
        {role:"assistant", text:"Sjajno! Adresa isporuke i broj telefona?", min:7},
        {role:"user",      text:"Kneza Miloša 22, Čačak, 069 123 456", min:10},
        {role:"assistant", text:"Čačak — 3 radna dana. Narudžbina potvrđena! 🎉", min:12},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto kutija BELI 70×70", status:"Poručio", status_porudzbine:"U dostavi"}},

    { days:21, platform:"website", msgs:[
        {role:"user",      text:"Koji sto je dobar za malu sobu deteta, 10m2?", min:0},
        {role:"assistant", text:"Za 10m2 — idealan je Sklopivi dečiji sto i stolica SET jer se sklopi i skloni kada nije u upotrebi. Alternativno, dečiji sto sa policama BEO je kompaktan i ima storage. Koliko ima godina detetu?", min:3},
        {role:"user",      text:"5 godina, za crtanje uglavnom", min:6},
        {role:"assistant", text:"Za crtanje u 5. godini — Sklopivi dečiji SET je savršen. Visina se može podesiti dok raste. 11.800 RSD, dostava 2-3 dana.", min:9},
        {role:"user",      text:"Naručujem! Email vam šaljem.", min:12},
    ], crm:{kategorija:"Dečiji nameštaj", proizvod:"Sklopivi dečiji sto i stolica SET", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:22, platform:"instagram", msgs:[
        {role:"user",      text:"Pozdrav, može li garancija na sto?", min:0},
        {role:"assistant", text:"Da! Svi stolovi imaju 2 godine garancije od datuma kupovine. U slučaju fabričke greške zamena besplatno.", min:2},
        {role:"user",      text:"Super, naručujem sklopivi sto za laptop", min:5},
        {role:"assistant", text:"Sto za laptop 60×40 je 9.800 RSD. Adresa isporuke?", min:7},
        {role:"user",      text:"Bulevar Kralja Aleksandra 105, Beograd", min:10},
        {role:"assistant", text:"Potvrđeno! Isporuka sutra. Hvala!", min:12},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto za laptop 60×40", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:23, platform:"facebook", msgs:[
        {role:"user",      text:"Imam stan na spratu, liftovi nema. Može li se sto preneti bez problema?", min:0},
        {role:"assistant", text:"Naravno! Naši stolovi su kompaktni i laki — sto kutija 70×70 teži samo 8 kg. Jedna osoba bez problema. 💪", min:3},
        {role:"user",      text:"Odlično. Naručujem dva ista za rodbinu.", min:6},
        {role:"assistant", text:"2 komada = 2×13.900 = 27.800 RSD, dostava gratis za 2+! Adresa isporuke?", min:9},
        {role:"user",      text:"Šaljem vam u inbox sa podacima.", min:12},
        {role:"assistant", text:"Čekamo! 📦", min:13},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto kutija BELI 70×70", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:24, platform:"instagram", msgs:[
        {role:"user",      text:"Radim kao slobodnjak, koje radno okruženje preporučujete?", min:0},
        {role:"assistant", text:"Za slobodnjake — Sklopivi radni sto sa policom 120×60 je savršen. Ima policu za drugu opremu, a kada završite radni dan — složite i imate slobodnu sobu!", min:4},
        {role:"user",      text:"Zvuči idealno. Koliko košta?", min:7},
        {role:"assistant", text:"21.500 RSD, dostava 2-3 dana. U beloj i sivoj boji.", min:9},
        {role:"user",      text:"Uzimam sivu. Da li se online plaća?", min:12},
        {role:"assistant", text:"Online plaćanje je dostupno na maguna.rs. Ili pouzećem. Šta vam više odgovara?", min:14},
        {role:"user",      text:"Pouzećem. Adresa Jurija Gagarina 45, Novi Beograd.", min:17},
        {role:"assistant", text:"Potvrđeno! Sutra isporuka. Hvala! 🎉", min:19},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto sa policom 120×60", status:"Poručio", status_porudzbine:"Potvrđeno"}},

    { days:25, platform:"website", msgs:[
        {role:"user",      text:"Ima li sto koji mogu da koristim i kao blagovaonički i kao radni?", min:0},
        {role:"assistant", text:"Da! Sklopivi sto sa policom 120×60 je multi-funkcionalan — ujutru radni sto, uveče trpezarijski za 4 osobe. Najpopularniji model kod nas.", min:5},
        {role:"user",      text:"Ok, hvala na informaciji. Razmisliću.", min:9},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto sa policom 120×60", status:"Zainteresovan", razlog:"Nije odgovorio"}},

    { days:26, platform:"instagram", msgs:[
        {role:"user",      text:"Pozdrav! Koliko košta kucica za barbike?", min:0},
        {role:"assistant", text:"Kućica za Barbie je 16.500 RSD — dolazi u roze i beloj boji, ima 2 sprata, nameštaj u kompletu. Savršen poklon za dece 3-8 god! 🏠", min:3},
        {role:"user",      text:"Uzimam roze za ćerku 5 god. Šta treba da uradim?", min:6},
        {role:"assistant", text:"Pošaljite nam adresu i kontakt u inbox, šaljemo fakturu i isporučujemo za 2-3 dana!", min:8},
        {role:"user",      text:"Šaljem odmah!", min:10},
        {role:"assistant", text:"Odlično, čekamo! 🎁", min:11},
    ], crm:{kategorija:"Dečiji nameštaj", proizvod:"Kućica za barbike", status:"Poručio", status_porudzbine:"Poslato"}},

    { days:27, platform:"facebook", msgs:[
        {role:"user",      text:"Zdravo, mogu li napraviti custom narudžbinu — sto u određenoj boji?", min:0},
        {role:"assistant", text:"Za custom boje radimo za narudžbine 5+ komada. Za manje količine, naši standardni modeli su bela, sivi hrast i crna. Koji model vas zanima?", min:4},
        {role:"user",      text:"Hteo bih zelenu. Pretpostavljam da ne ide...", min:7},
        {role:"assistant", text:"Za sada ne, ali možemo vas staviti na listu interesnih kupaca — ako skupimo dovoljno upita za zelenu, pravimo seriju!", min:9},
        {role:"user",      text:"OK okej, hvala!", min:11},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:null, status:"Zainteresovan", razlog:"Nema željene boje"}},

    { days:28, platform:"instagram", msgs:[
        {role:"user",      text:"Šta je razlika između modela 70x70 i 80x80?", min:0},
        {role:"assistant", text:"70×70 je naš klasični model za 2-4 osobe. 80×80 (koji dolazi sledeći mesec) ima veću radnu površinu i stabilniju nogu. Cena 70×70 je 13.900, 80×80 će biti oko 16.500.", min:4},
        {role:"user",      text:"Uzimam 70x70 sada, 80x80 čekam.", min:7},
        {role:"assistant", text:"Razumno! 70×70 naručujete odmah ili čekate? 😊", min:9},
        {role:"user",      text:"Odmah. Adresa: Vojislava Ilića 33, Beograd", min:12},
        {role:"assistant", text:"Beograd — isporuka sutra! Narudžbina potvrđena. Hvala! 📦", min:14},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi sto kutija BELI 70×70", status:"Poručio", status_porudzbine:"U dostavi"}},

    { days:29, platform:"website", msgs:[
        {role:"user",      text:"Dobar dan! Pitanje o stočiću za šminkanje — ima li ga na zalihama ili se čeka?", min:0},
        {role:"assistant", text:"Dobar dan! Stočić za šminkanje sa ogledalom je na zalihama — isporuka 2-3 radna dana. Koji grad ste?", min:2},
        {role:"user",      text:"Novi Sad", min:4},
        {role:"assistant", text:"Novi Sad — 2 radna dana, 350 RSD dostava. Naručujete?", min:6},
        {role:"user",      text:"Da! Pošaljite mi instrukcije za narudžbinu.", min:9},
        {role:"assistant", text:"Pošaljite email na magunadizajn@gmail.com sa: ime, adresa, telefon i model koji naručujete. Ili mi ovde direktno napišite podatke! 📧", min:11},
    ], crm:{kategorija:"Šminkanje", proizvod:"Stočić za šminkanje sa ogledalom", status:"Zainteresovan", razlog:"Pita za termin isporuke"}},

    { days:30, platform:"instagram", msgs:[
        {role:"user",      text:"Može li sklopivi sto da se koristi svaki dan ili je samo za goste?", min:0},
        {role:"assistant", text:"Naši stolovi su dizajnirani za svakodnevnu upotrebu! Korisnici ih koriste dnevno godinama. Mehanizam sklapanja je testiran na 10.000+ ciklusa.", min:4},
        {role:"user",      text:"Super, naručujem radni sto 100x60", min:7},
        {role:"assistant", text:"Odlično! Adresa isporuke?", min:9},
        {role:"user",      text:"Masarikova 12, Beograd", min:12},
        {role:"assistant", text:"Narudžbina potvrđena! Isporuka za 1-2 radna dana. 🙏", min:14},
    ], crm:{kategorija:"Sklopivi stolovi", proizvod:"Sklopivi radni sto BELI 100×60", status:"Poručio", status_porudzbine:"Potvrđeno"}},
]

async function run() {
    console.log("🔄 Seeding bulk Maguna conversations + CRM records...")

    let convCount = 0
    let crmCount = 0

    for (let i = 0; i < CONVERSATIONS.length; i++) {
        const conv = CONVERSATIONS[i]
        const nameEntry = NAMES[i % NAMES.length]
        const fullName = nameEntry[0]
        const handle   = nameEntry[1]
        const platform = conv.platform
        const convId   = `mg_bulk_${i}_${handle}`
        const baseTs   = daysAgo(conv.days, 10 + (i % 8))

        // Insert razgovori messages
        const rows = conv.msgs.map((m, mi) => {
            const ts = new Date(new Date(baseTs).getTime() + m.min * 60 * 1000).toISOString()
            return {
                id_razgovora: convId,
                role: m.role,
                message: m.text,
                platform,
                client_id: CLIENT_ID,
                created_at: ts,
                metadata: { name: fullName, profile_pic: null }
            }
        })

        const { error: razErr } = await sb.from("razgovori").insert(rows)
        if (razErr) {
            console.error(`  ✗ razgovori[${i}]:`, razErr.message)
        } else {
            convCount++
        }

        // Insert CRM record if defined
        if (conv.crm) {
            const { error: crmErr } = await sb.from("crm_maguna").insert({
                client_id: CLIENT_ID,
                id_razgovora: convId,
                full_name: fullName,
                izvor: platform === "instagram" ? "Instagram" : platform === "facebook" ? "Facebook" : "Website",
                zdravstveni_cilj: conv.crm.kategorija || null,
                proizvod: conv.crm.proizvod || null,
                status: conv.crm.status || "Novi",
                razlog: conv.crm.razlog || null,
                status_porudzbine: conv.crm.status_porudzbine || null,
                created_at: baseTs,
            })
            if (crmErr) {
                console.error(`  ✗ crm_maguna[${i}]:`, crmErr.message)
            } else {
                crmCount++
            }
        }
    }

    console.log(`✅ Done: ${convCount} conversations, ${crmCount} CRM records seeded`)

    // Summary
    const { count: razTotal } = await sb.from("razgovori").select("*", { count: "exact", head: true }).eq("client_id", CLIENT_ID)
    const { count: crmTotal } = await sb.from("crm_maguna").select("*", { count: "exact", head: true }).eq("client_id", CLIENT_ID)
    console.log(`📊 Total in DB: ${razTotal} conversations, ${crmTotal} CRM records`)
}

run().catch(console.error)
