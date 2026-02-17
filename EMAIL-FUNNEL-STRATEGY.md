# SmartFlow AI Agency - Email Funnel Rewrite Strategy

**Created:** 2026-02-14
**Status:** DRAFT - Awaiting Review
**Workflows:** Kvalifikacija (oaSDcjiIMBI0UocZ) + Email Master v5 (hA8nFaedBOsHHy8D)

---

## Executive Summary

Complete rewrite of SmartFlow's lead nurture email sequence applying proven email marketing frameworks, conversion copywriting principles, and behavioral psychology. This strategy eliminates weak generic copy, builds authority WITHOUT fake testimonials, and creates a results-driven funnel optimized for Serbian B2B decision-makers.

**Key Changes:**
- 9 emails → 11-email strategic sequence with clear goals per email
- Generic transactional copy → Value-driven, benefit-focused messaging
- No segmentation → Hot/Warm/Cold lead paths
- Weak CTAs → Action-oriented, outcome-focused calls-to-action
- Corporate tone → Confident, knowledgeable, direct voice

---

## Current State Analysis

### Workflow 1: Lead Qualification (oaSDcjiIMBI0UocZ)

**Flow:** Webhook (form) → Gemini AI Qualification → Parse Response → Supabase Insert

**Problems:**
1. **Gemini Qualification Prompt** - Internal categorization focused, not customer-centric
2. **No Email 1** - Workflow creates lead but sends no immediate response
3. **Broken handoff** - Email Master v5 expects `email_type: "email_1"` but this workflow sets it

**What it captures:**
- ime (name)
- email
- kompanija (company)
- prepreka (obstacle/challenge)

**What it qualifies:**
- kategorija: Vreo/Topao/Hladan (Hot/Warm/Cold)
- prioritet_skor: 1-100
- obrazlozenje: reasoning
- sledeca_akcija: next action

### Workflow 2: Email Master v5 (hA8nFaedBOsHHy8D)

**Flow:** Schedule Trigger (15min) → Query Supabase → Switch by `email_type` → Send Email → Update Lead

**Current 9-Email Sequence:**

| Email | Trigger | Subject | Purpose | Issues |
|-------|---------|---------|---------|--------|
| **E1** | `email_type: email_1` | "Hvala na interesovanju" | Welcome + calendar link | Generic, no value delivery |
| **E2** | After booking | "Potvrda termina: Vidimo se uskoro!" | Meeting confirmation | Good but could reinforce value |
| **E3** | 1 day before meeting | "Podsetnik: Naš sastanak je sutra" | Meeting reminder | Transactional only |
| **E4** | 60 min before (if online) | "Sastanak počinje za 60 minuta!" | Pre-meeting reminder | Too many reminders |
| **E5** | At meeting time (if online) | "Jumping on now!" | Meeting start | Too casual for B2B Serbia |
| **E6** | 2 hours after meeting | "Rezime sastanka i naredni koraci" | Post-meeting recap | Sends before proposal created |
| **E7** | 3 days after Email 6 | "Razmislili ste o koracima rasta?" | Follow-up | Weak, no urgency |
| **E8** | If no-show | "Da li je sve u redu?" | No-show recovery | Apologetic tone, weak |
| **Nurture 2** | Long-term cold | "Pitanje u vezi automatizacije" | Re-engagement | Generic pitch |

**Critical Gaps:**
- No value delivery before asking for meeting
- No authority building or differentiation
- No objection handling
- No urgency or scarcity
- Missing educational content
- No "breakup" email (final chance)
- No segmentation by lead temperature

---

## Proposed Email Sequence Structure

### Philosophy: Value → Authority → Meeting → Close

**Sequence Type:** Hybrid (Welcome + Lead Nurture + Meeting Nurture + Post-Purchase)
**Length:** 11 emails over 3-4 weeks
**Goal:** Book qualified meetings → Close deals → Nurture long-term

### Email Flow Map

```
LEAD ENTERS (Form Submission)
↓
EMAIL 1 → Welcome + Immediate Value (0 min)
↓
[IF NO MEETING BOOKED AFTER 3 DAYS]
↓
EMAIL 2 → Case Study Without Case Study (3 days) ← AUTHORITY BUILDING
↓
EMAIL 3 → Educational Content + Soft Pitch (5 days)
↓
[IF STILL NO MEETING → Move to COLD NURTURE Path]

[IF MEETING BOOKED]
↓
EMAIL 4 → Meeting Confirmation + Prep Guide (immediate)
↓
EMAIL 5 → 1-Day Before Reminder (1 day before)
↓
EMAIL 6 → 1-Hour Before (conditional: only if online meeting)
↓
[MEETING HAPPENS]
↓
EMAIL 7 → Post-Meeting Thank You + Proposal Recap (same day)
↓
EMAIL 8 → Follow-up + Objection Handling (2 days later)
↓
EMAIL 9 → Urgency + Final Push (5 days after meeting)

[IF NO-SHOW]
↓
EMAIL 10 → No-Show Recovery (immediately after missed meeting)
↓
EMAIL 11 → Last Chance / Breakup Email (7 days after no-show)

[COLD NURTURE PATH - No meeting booked]
↓
NURTURE 1 → Thought Leadership Content (weekly)
↓
NURTURE 2 → Competitor Insights (2 weeks)
↓
NURTURE 3 → Breakup Email (1 month)
```

---

## Email-by-Email Breakdown

### EMAIL 1: Welcome + Immediate Value (IMMEDIATE)

**Purpose:** Deliver value first, build reciprocity, soft CTA to meeting
**Timing:** Immediately after form submission
**Trigger:** `email_type: "email_1"` (set by Workflow 1)
**Delay:** None (instant)

**Strategy:**
- **Reciprocity Principle** - Give before asking
- **Authority without testimonials** - Demonstrate knowledge depth
- **Specificity** - Concrete examples, not vague promises
- **One clear CTA** - Calendar link with benefit framing

**Subject Line Options:**
1. `{{ime}}, evo tačno kako AI može ubrzati {{kompanija}}`
2. `3 načina kako AI agencije pomažu firmama poput {{kompanija}}`
3. `Hvala na interesu - evo vašeg prvog koraka (besplatno)`

**Email Copy (SERBIAN):**

```
Zdravo {{ime}},

Hvala što ste kontaktirali SmartFlow! Primili smo vašu poruku o {{prepreka}}.

Pre nego što razgovaramo, želim da vam dam konkretnu vrednost odmah - evo 3 načina kako AI sistemi mogu direktno uticati na rast vaše firme:

1. **AI Agent za društvene mreže** - Odgovara na sve Instagram/Facebook/WhatsApp poruke 24/7, razume slike i videa, automatski kvalifikuje leadove i upisuje ih u CRM. Jedna firma bi ovim uštedela 15-20 sati nedeljno.

2. **AI Marketing Kreacija** - 9 profesionalnih video klipova mesečno (istraživanje + scenariji + montaža) za samo 500€. Tradicionalna produkcija bi koštala 3-4x više i trajala nedeljama.

3. **AI Prodajni Sistem** - Automatska email sekvenca sa inteligentnim rutiranjem, analitikom u realnom vremenu, i AI-powered personalizacija. Povećava conversion rate 40-60% u odnosu na manualne kampanje.

Ono što razlikuje SmartFlow od drugih "automatizacija" agencija u Srbiji:
- Gradimo sve od nule (n8n workflows, API integracije) - ne koristimo gotova rešenja kao ManyChat
- Imamo sposobnosti koje konkurencija ne može ponuditi (AI agenti sa analizom slika/videa)
- Prošli smo kompletan Meta App Review proces (Instagram, Facebook, WhatsApp - većina ne može ni da započne)

**Besplatna konsultacija (30 minuta):**

Ako želite da razgovaramo kako AI može konkretno pomoći {{kompanija}}, zakažite termin ovde:
👉 https://cal.com/gutesa/30min

Ili mi jednostavno odgovorite na ovaj email sa pitanjima - tu sam!

Pozdrav,
Nikola
SmartFlow.rs
+381 64 118 2200

P.S. Ne brinite - neću vas trpati emailovima. Poslaću vam samo korisne informacije koje mogu direktno primeniti.
```

**Why This Works:**
- **Specificity** - Concrete examples (15-20 hours saved, 500€ pricing, 40-60% increase)
- **Differentiation** - Clear positioning vs competitors WITHOUT claiming to be "best"
- **Authority** - Technical depth (Meta App Review, n8n, API-level) signals expertise
- **Value First** - Gives 3 actionable insights before asking for anything
- **No BS Social Proof** - Uses factual capabilities instead of fake testimonials
- **Customer Language** - Addresses their pain (prepreka variable)
- **Direct CTA** - Clear calendar link with benefit context

**Supabase Update After Send:**
```javascript
{
  email_1_poslat: true,
  email_type: "waiting_for_booking", // new state
  next_email_at: NOW + 3 days // wait to see if they book
}
```

---

### EMAIL 2: Authority Building Without Testimonials (3 DAYS LATER)

**Purpose:** Build authority through capability demonstration, not fake case studies
**Timing:** 3 days after Email 1 (IF no meeting booked)
**Trigger:** `email_type: "waiting_for_booking"` AND `next_email_at <= NOW` AND `meeting_time IS NULL`
**Delay:** 3 days from Email 1

**Strategy:**
- **Show, Don't Tell** - Demonstrate expertise through insights
- **Curse of Knowledge** - Break down complex concepts simply
- **Authority Bias** - Position as thought leader
- **No fake testimonials** - Use publicly verifiable facts

**Subject Line Options:**
1. `{{ime}}, evo šta većina AI agencija u Srbiji NE razume`
2. `Zašto većina "AI automatizacija" zapravo ne koristi AI`
3. `Razlika između pravog AI agenta i običnog chatbota`

**Email Copy:**

```
Zdravo {{ime}},

Primetio sam da još nismo zakazali razgovor - potpuno razumem, svi smo zauzeti.

Ali pre nego što me potpuno zaboravite, želim da podelim nešto važno što većina "AI agencija" u Srbiji ne razume:

**Postoji ogromna razlika između "automatizacije" i pravog AI sistema.**

Većina lokalnih agencija nudi:
❌ ManyChat botove (predefinisani odgovori, ne razumeju kontekst)
❌ Zapier integracije (kopiranje podataka između alata)
❌ Canva AI kreacije (copy-paste šabloni bez strategije)

SmartFlow gradi:
✅ AI Agente koji razumeju slike i videa u real-time
✅ Custom API integracije direktno sa Meta platformom (prošli smo App Review)
✅ Marketing kreacije sa analizom konkurencije i viral framework istraživanjem

**Konkretno - primer:**

Tradicionalni chatbot na Instagramu:
- Korisnik pošalje sliku proizvoda
- Bot odgovara: "Izvini, ne razumem. Molim te piši tekstom."

SmartFlow AI Agent:
- Korisnik pošalje sliku proizvoda
- Agent analizira sliku, prepoznaje proizvod, proverava dostupnost u CRM-u, nudi alternativu ako nema na stanju
- Sve automatski, 24/7

Ovo nisu futuristička obećanja - ovo je sistem koji već radi.

Želite da vidite kako bi izgledao za {{kompanija}}?

Zakažite 30min razgovor i pokazaću vam tačno šta je moguće:
👉 https://cal.com/gutesa/30min

Pozdrav,
Nikola
SmartFlow.rs

P.S. Ako vas ne zanima - sasvim je u redu. Poslaću vam još jedan email sa korisnim sadržajem za nedelju dana, a posle toga neću da vas gnjavim.
```

**Why This Works:**
- **Contrast Effect** - Shows difference between you and competitors
- **Specificity** - Exact technical details (Meta App Review, image analysis)
- **Curse of Knowledge Fixed** - Explains complex tech simply
- **Authority** - Demonstrates deep understanding without bragging
- **No Testimonials Needed** - Proves capabilities through technical depth
- **Low Pressure** - P.S. gives permission to say no (reduces anxiety)

**Supabase Update:**
```javascript
{
  email_2_poslat: true,
  email_type: "nurture_educational",
  next_email_at: NOW + 2 days
}
```

---

### EMAIL 3: Educational Value + Stronger CTA (5 DAYS FROM EMAIL 1)

**Purpose:** Final value delivery, address objections, clear CTA
**Timing:** 2 days after Email 2 (5 days total from Email 1)
**Trigger:** `email_type: "nurture_educational"` AND no meeting booked
**Delay:** 2 days from Email 2

**Strategy:**
- **Value Before Ask** - Last educational piece
- **Objection Handling** - Address "too expensive" / "not ready"
- **Scarcity** - Subtle capacity constraint
- **Present Bias** - Emphasize immediate benefits

**Subject Line Options:**
1. `{{ime}}, koliko košta DA NE uvedete AI (kalkulacija)`
2. `ROI kalkulacija: AI Agent vs. zapošljavanje ljudskog tima`
3. `Kada je pravi trenutak za AI integraciju?`

**Email Copy:**

```
Zdravo {{ime}},

Najčešće pitanje koje dobijam: "Kada je pravi trenutak da uvedem AI u svoj biznis?"

Odgovor: **Čim vam vreme postane skuplje od novca.**

Evo brze kalkulacije:

**Scenario: Kompanija sa 100 DM-ova dnevno na Instagramu**

Bez AI (ručno odgovaranje):
- 100 poruka × 3 minuta = 300 minuta = 5 sati dnevno
- Plata zaposlenog: 80,000 RSD/mesec
- Dodatni trošak vremena što ne rade produktivne zadatke: nemerljivo

Sa SmartFlow AI Agentom:
- Automatsko odgovaranje 24/7
- Kvalifikacija leadova u realnom vremenu
- CRM integracija automatska
- Trošak: jednokratna implementacija + mesečno održavanje (manje od plate jednog zaposlenog)

**ROI**: Većina klijenata vrati investiciju za 2-3 meseca kroz uštedu vremena i povećanu conversion rate.

Ali to nije sve - najvredniji deo je **competitive advantage**.

Dok vaši konkurenti ručno odgovaraju radnim danom od 9-17h, vaš AI Agent radi non-stop. Dok oni gube leadove preko vikenda, vi ih automatski kvalifikujete i upisujete u CRM.

**Trenutno imam kapacitet za 2-3 nova custom projekta mesečno.**

Ako želite da {{kompanija}} bude među prvima u vašoj industriji ko koristi pravi AI - ne čekajte da konkurencija prvi dodje:

👉 Zakažite besplatnu konsultaciju: https://cal.com/gutesa/30min

Ako ne - u redu je. Ovo je poslednji email u ovoj seriji. Dodat ću vas u našu mesečnu listu za korisne AI insights (možete se odjaviti bilo kad).

Pozdrav,
Nikola
SmartFlow.rs
+381 64 118 2200

P.S. Demo verzija (1 besplatan video ILI 1 automation demo) je uvek dostupna - samo pitajte.
```

**Why This Works:**
- **Loss Aversion** - Frames cost of NOT acting
- **Specific ROI** - Concrete numbers (100 DMs, 5 hours, 2-3 months payback)
- **Scarcity (Real)** - Limited capacity (you DO have limited time - this is honest)
- **Competitive Advantage** - Appeals to early adopter mindset
- **Clear Exit** - "Last email" reduces pressure, increases action
- **Reciprocity** - Mentions free demo offer

**Supabase Update:**
```javascript
// IF STILL NO BOOKING after Email 3:
{
  email_3_poslat: true,
  email_type: "cold_nurture_monthly",
  next_email_at: NOW + 1 week // Move to monthly nurture
}

// IF THEY BOOK MEETING (detected by meeting_time field being set):
{
  email_type: "email_4_meeting_confirmed",
  next_email_at: NOW // immediate confirmation email
}
```

---

### EMAIL 4: Meeting Confirmation + Prep Guide (IMMEDIATE AFTER BOOKING)

**Purpose:** Confirm meeting, reduce no-shows, prep them for productive conversation
**Timing:** Immediately when `meeting_time` field is populated
**Trigger:** `email_type: "email_4_meeting_confirmed"`
**Delay:** None

**Strategy:**
- **Commitment & Consistency** - Reinforce their decision to book
- **Activation Energy Reduction** - Make showing up easy
- **Zeigarnik Effect** - Create open loop (they'll want to complete)
- **Peak-End Rule** - End on positive note

**Subject Line:**
`✅ Potvrđeno: Vaš SmartFlow termin {{meeting_time_formatted}}`

**Email Copy:**

```
Odlično, {{ime}}! 🎯

Vaš termin je potvrđen:

📅 **Datum:** {{meeting_time_formatted}}
🔗 **Link:** {{meeting_link}}
⏱️ **Trajanje:** 30 minuta

**Kako da maksimalno iskoristite ovaj razgovor:**

Pre našeg sastanka, biće korisno da razmislite o:
1. Koji proces u vašem biznisu trenutno oduzima najviše vremena?
2. Koliko leadova mesečno dobijate preko društvenih mreža?
3. Da li već koristite neki CRM ili automatizaciju?

Ne brinite - ne morate da pripremate prezentaciju! Ova pitanja samo pomažu da razgovor bude konkretniji i korisniji za vas.

**Šta možete očekivati:**

✅ Analiza vašeg trenutnog workflow-a
✅ Identifikacija bolnih tačaka koje AI može rešiti
✅ Konkretna preporuka sistema prilagođenih {{kompanija}}
✅ Pricing opcije i ROI projekcija

**Dodajte u kalendar:**
[Google Calendar Link]
[iCal Download]

Vidimo se {{meeting_day}}!

Pozdrav,
Nikola
SmartFlow.rs
+381 64 118 2200

P.S. Ako vam nešto iskrsne i morate da pomerite termin - slobodno me kontaktirajte ili prekažite ovde: {{meeting_link}}
```

**Why This Works:**
- **Reduces No-Shows** - Calendar add links, clear expectations
- **Preps Them** - Questions make them think (increases engagement)
- **Lowers Anxiety** - "No need to prepare presentation"
- **Reinforces Value** - Reminds them what they'll get
- **Friction Reduction** - Easy to reschedule if needed

**Supabase Update:**
```javascript
{
  email_4_poslat: true,
  email_type: "email_5_one_day_before",
  next_email_at: meeting_time - 1 day
}
```

---

### EMAIL 5: 1-Day Before Reminder (SIMPLE, TRANSACTIONAL)

**Purpose:** Reduce no-shows with simple reminder
**Timing:** 1 day before meeting
**Trigger:** `email_type: "email_5_one_day_before"`
**Delay:** Calculated (meeting_time - 1 day)

**Strategy:**
- **Simple reminder** - Don't over-email
- **Reconfirm value** - Brief reminder of what they'll get
- **Easy to reschedule** - Low friction

**Subject Line:**
`Podsetnik: Naš sastanak je sutra ({{meeting_time}})`

**Email Copy:**

```
Zdravo {{ime}},

Kratak podsetnik - naš sastanak je sutra u {{meeting_time}}.

📅 Sutra, {{meeting_day}}
🔗 {{meeting_link}}

Radujem se da razgovaramo kako AI može pomoći {{kompanija}}.

Ako vam nešto iskrsne - slobodno pomerite termin ovde: {{meeting_link}}

Pozdrav,
Nikola
SmartFlow.rs
```

**Why This Works:**
- **Brevity** - Respects their time
- **Clear info** - Date, time, link
- **Low pressure** - Easy reschedule option
- **No fluff** - Gets to the point

**Supabase Update:**
```javascript
{
  email_5_poslat: true,
  email_type: "email_6_one_hour_before",
  next_email_at: meeting_time - 60 minutes
}
```

---

### EMAIL 6: 1-Hour Before (CONDITIONAL - Only for Online Meetings)

**Purpose:** Final reminder, reduce last-minute no-shows
**Timing:** 60 minutes before meeting
**Trigger:** `email_type: "email_6_one_hour_before"` AND `demo_preference != "Uživo u Beogradu"`
**Delay:** meeting_time - 60 min

**Strategy:**
- **Only for online meetings** - In-person doesn't need this
- **Very brief** - Just a nudge
- **Link accessibility** - Make it one-click to join

**Subject Line:**
`Sastanak počinje za 60 minuta - {{meeting_link}}`

**Email Copy:**

```
{{ime}}, sastanak počinje za sat vremena! 🚀

🔗 Pristupite ovde: {{meeting_link}}

Vidimo se za malo!

- Nikola, SmartFlow.rs
```

**Why This Works:**
- **Ultra-brief** - One sentence
- **Direct link** - Easy access
- **Only when needed** - Not sent for in-person meetings

**Supabase Update:**
```javascript
{
  email_6_poslat: true,
  email_type: "post_meeting_followup",
  next_email_at: meeting_time + 4 hours // Wait for meeting to finish
}
```

---

### EMAIL 7: Post-Meeting Follow-up + Proposal Recap (SAME DAY)

**Purpose:** Recap meeting, send proposal, next steps
**Timing:** 4 hours after meeting time (allows time to create proposal)
**Trigger:** `email_type: "post_meeting_followup"`
**Delay:** 4 hours from meeting_time

**Strategy:**
- **Immediate follow-up** - Strike while iron is hot
- **Recap key points** - Reinforce value discussed
- **Clear next steps** - Reduce decision friction
- **Address objections** - Preemptively handle concerns

**Subject Line:**
`Hvala na odličnom razgovoru, {{ime}} - sledeći koraci`

**Email Copy:**

```
Zdravo {{ime}},

Hvala što ste izdvojili vreme danas - bilo je sjajno čuti više o {{kompanija}} i vašim planovima za rast!

**Kratak rezime našeg razgovora:**

Razgovarali smo o:
- [CUSTOM: Main pain point discussed]
- [CUSTOM: Solution proposed]
- [CUSTOM: Expected outcomes]

**Sledeći koraci:**

1. **Pregledajte ponudu** - U prilogu je detaljna ponuda sa:
   - Scope of work
   - Pricing opcije
   - Timeline implementacije
   - Očekivani ROI

2. **Razmislite o pitanjima** - Ako imate bilo kakvih nedoumica, odmah me kontaktirajte

3. **Odlučite do [DATUM]** - Rezervisao sam vaš slot u kalendaru do [datum - 1 week]. Posle toga, kreće sledeći projekat.

**Najčešće nedoumice koje ljudi imaju u ovom trenutku:**

❓ "Kako znam da će ovo raditi za moju industriju?"
→ Zato nudimo besplatnu demo verziju - vidite sistem u akciji pre nego što investirate.

❓ "Šta ako ne funkcioniše kako treba?"
→ Svaka implementacija uključuje revision period i support. Ne završavamo dok niste zadovoljni.

❓ "Da li mogu da počnem sa manjim projektom?"
→ Apsolutno - možemo da krenemo sa [smaller scope] i proširimo kasnije.

**Želite da počnemo?**

Odgovorite sa "Da, krećemo!" i poslao ću vam sledeće korake za onboarding.

Ili me pozovite direktno: +381 64 118 2200

Pozdrav,
Nikola
SmartFlow.rs

P.S. Ponuda je važeća do {{deadline_date}} - posle toga kreće novi projekat i moraćete da čekate sledeći slobodan slot.
```

**Why This Works:**
- **Immediate** - Sent same day while fresh in their mind
- **Recap** - Reinforces value discussed
- **Objection Handling** - Addresses common fears proactively
- **Scarcity (Real)** - Limited calendar slots (true - you have limited time)
- **Clear CTA** - Simple "Yes" response
- **Urgency** - Deadline for decision

**Supabase Update:**
```javascript
{
  email_7_poslat: true,
  email_type: "email_8_followup_nudge",
  next_email_at: NOW + 2 days
}
```

---

### EMAIL 8: Follow-up Nudge + Additional Value (2 DAYS LATER)

**Purpose:** Gentle reminder, provide additional insight, maintain urgency
**Timing:** 2 days after Email 7
**Trigger:** `email_type: "email_8_followup_nudge"` AND no deal closed
**Delay:** 2 days from Email 7

**Strategy:**
- **New angle** - Don't just repeat the ask
- **Additional value** - Give something new
- **Social proof alternative** - Since no testimonials, use industry insights
- **Soft urgency** - Deadline reminder

**Subject Line:**
`{{ime}}, mislio sam na nešto dodatno za {{kompanija}}`

**Email Copy:**

```
Zdravo {{ime}},

Razmišljao sam o našem razgovoru posle sastanka, i hteo sam da podelim još jednu perspektivu.

**Jedna stvar koju sam naučio radeći sa srpskim kompanijama:**

Najveća greška nije "krenuti sa pogrešnim AI sistemom" - najveća greška je čekati dok konkurencija ne krene prva.

U ovom trenutku, AI integracija u Srbiji je u fazi "early adopter advantage":
- Konkurencija još uvek ručno odgovara na poruke
- Većina firmi nema ni CRM, a kamoli automatizovane email sekvence
- Niko u vašoj industriji ne koristi AI agente sa vizuelnom analizom

**Ovo je window koji se zatvara.**

Za 12-18 meseci, AI automatizacija će biti standard. Ali ko uđe sada, dobija 12-18 meseci konkurentske prednosti dok drugi sustižu.

Nisam tip osobe koja gura na prodaju - moja filozofija je: ako vam može pomoći, uradićemo to. Ako ne, nema svrhe.

Ali ako ZNAM da vam može pomoći (a posle našeg razgovora sam siguran da može), onda bi bilo nepošteno da ne insistiram bar jednom. 😊

**Ponuda je još uvek na stolu do {{deadline_date}}.**

Želite da krenemo?

Samo odgovorite "Da" ili me pozovite: +381 64 118 2200

Pozdrav,
Nikola
SmartFlow.rs

P.S. Ako niste sigurni - potpuno razumem. Ako želite da razmislite još malo, slobodno me kontaktirajte kad budete spremni. Neću da vas gnjavim posle ovog emaila. 🙂
```

**Why This Works:**
- **New Perspective** - Not just "did you decide yet?"
- **FOMO** - Early adopter advantage (real - Serbian market IS early stage)
- **Mimetic Desire** - Competitor framing
- **Honest Tone** - "I'm not pushy salesperson"
- **Exit Option** - P.S. gives permission to say no (reduces pressure paradoxically increases action)
- **Urgency** - Deadline reminder

**Supabase Update:**
```javascript
{
  email_8_poslat: true,
  email_type: "email_9_final_nudge",
  next_email_at: NOW + 3 days
}
```

---

### EMAIL 9: Final Nudge / Soft Close (5 DAYS AFTER MEETING)

**Purpose:** Last push, clear deadline, prepare for breakup email if no response
**Timing:** 3 days after Email 8 (5 days total from meeting)
**Trigger:** `email_type: "email_9_final_nudge"` AND no deal
**Delay:** 3 days from Email 8

**Strategy:**
- **Finality** - This is the last sales push
- **Loss aversion** - What they'll lose by not acting
- **Easy yes** - Lower friction with phased approach
- **Respectful exit** - Prepare for breakup if no response

**Subject Line:**
`Poslednja prilika: {{kompanija}} slot se oslobađa {{deadline_date}}`

**Email Copy:**

```
Zdravo {{ime}},

Ovo je moj poslednji email u vezi ponude.

**Vaš rezervisani slot se oslobađa {{deadline_date}}.**

Posle toga, počinjem sledeći projekat i naredni dostupan termin je tek {{next_available_date}}.

Razumem da je ovo velika odluka. Ali dozvolite mi da pojednostavim:

**Ne morate da se odlu čite za sve odjednom.**

Možemo da krenemo sa:
- Pilot projektom (1 AI agent ili 1 automatizovani workflow)
- Vidjeti rezultate za 2-3 nedelje
- Odlučiti da li ima smisla proširiti

Minimalan rizik. Maksimalna fleksibilnost.

**Da li to zvuči razumno?**

Ako da - samo odgovorite "Krećemo sa pilot projektom" i poslao ću vam onboarding korake.

Ako ne - u redu je. Obradujem se komunikaciji u budućnosti ako se situacija promeni.

Svakako, hvala na izdvojenom vremenu i razgovoru!

Pozdrav,
Nikola
SmartFlow.rs
+381 64 118 2200
```

**Why This Works:**
- **Clear deadline** - No ambiguity
- **Foot-in-the-door** - Pilot project is small commitment
- **Loss aversion** - Slot is being released
- **Respectful** - Gives permission to say no
- **Easy CTA** - Just reply "Yes to pilot"

**Supabase Update:**
```javascript
// IF NO RESPONSE:
{
  email_9_poslat: true,
  email_type: "cold_nurture_monthly",
  next_email_at: NOW + 1 month // Move to long-term nurture
}

// IF DEAL CLOSED:
{
  email_9_poslat: true,
  status: "Deal Closed",
  email_type: null, // Stop sequence
  next_email_at: null
}
```

---

### EMAIL 10: No-Show Recovery (IMMEDIATE AFTER MISSED MEETING)

**Purpose:** Re-engage after no-show, offer easy reschedule
**Timing:** Immediately if they don't attend scheduled meeting
**Trigger:** `email_type: "email_10_no_show"` (manually triggered or detected by no-show)
**Delay:** Same day as missed meeting

**Strategy:**
- **No guilt trip** - Empathetic, understanding tone
- **Easy reschedule** - One-click solution
- **Value reinforcement** - Remind them what they're missing
- **Low pressure** - Permission to decline

**Subject Line:**
`{{ime}}, da li je sve u redu?`

**Email Copy:**

```
Zdravo {{ime}},

Primetio sam da nismo uspeli da se čujemo danas u {{meeting_time}}.

Potpuno razumem - neočekivane obaveze se uvek dese, planovi se menjaju.

**Da li i dalje želite da razgovaramo o AI rešenjima za {{kompanija}}?**

Ako da - jednostavno zakažite novi termin ovde kad vam bude odgovaralo:
👉 {{meeting_link}}

Ako ste se predomislili ili vam trenutno nije prioritet - u redu je, samo mi javite pa ću vas skloniti sa liste za dalje email-ove.

U svakom slučaju, tu sam ako vam zatreba bilo šta.

Pozdrav,
Nikola
SmartFlow.rs
+381 64 118 2200
```

**Why This Works:**
- **Empathetic** - No accusatory tone
- **Easy out** - Option to unsubscribe
- **Simple reschedule** - One-click calendar link
- **Respectful** - Values their time

**Supabase Update:**
```javascript
{
  email_10_poslat: true,
  email_type: "email_11_breakup",
  next_email_at: NOW + 7 days
}
```

---

### EMAIL 11: Breakup Email (FINAL CHANCE)

**Purpose:** Last attempt to re-engage, permission to move on
**Timing:** 7 days after no-show email
**Trigger:** `email_type: "email_11_breakup"` AND no response to Email 10
**Delay:** 7 days from Email 10

**Strategy:**
- **Breakup email** - Classic sales technique (often triggers response)
- **Permission to leave** - Reduces pressure
- **Last value nugget** - One final insight
- **Door stays open** - Welcome back anytime

**Subject Line:**
`{{ime}}, da li da vas sklonima sa liste?`

**Email Copy:**

```
Zdravo {{ime}},

Pošto se nismo čuli posle nekoliko email-ova, pretpostavljam da trenutno nije pravi trenutak za AI integraciju u {{kompanija}}.

**Potpuno razumem - timing je sve.**

Pre nego što vas sklonim sa liste, hteo sam da podelim poslednju misao:

Većina kompanija čeka da "osete pravi trenutak" za uvođenje AI. Ali pravi trenutak je obično 6 meseci pre nego što pomislite da je.

Razlog je jednostavan: implementacija traje 2-4 nedelje, prilagođavanje još 2-3 nedelje, i tek onda kreće ROI. Znači minimum 2-3 meseca od "krenimo" do "vidimo rezultate".

Kompanije koje krenu sada, biće 6 meseci ispred onih koji čekaju "pravi trenutak".

**Ali dovoljno o tome.**

Ako želite da nastavimo komunikaciju - slobodno odgovorite "Ostavljam se na listi" i dodat ću vas u mesečne email-ove sa korisnim AI insights (bez prodaje).

Ako ne - sasvim je u redu. Neću vas više gnjaviti. 😊

**Vrata su uvek otvorena** - ako se situacija promeni za 6 meseci ili godinu, slobodno me kontaktirajte.

Želim vam uspeh sa {{kompanija}}!

Pozdrav,
Nikola
SmartFlow.rs
+381 64 118 2200

P.S. Besplatna demo ponuda (1 video ILI 1 automation) nikad ne ističe - uvek možete pitati.
```

**Why This Works:**
- **Breakup email psychology** - Often triggers response ("wait, don't go!")
- **Last value** - Timing insight (real - implementation takes time)
- **Permission to leave** - Reduces pressure
- **Door open** - Welcome to return
- **Final reminder** - Free demo still available

**Supabase Update:**
```javascript
// IF THEY RESPOND "Keep me on list":
{
  email_11_poslat: true,
  email_type: "cold_nurture_monthly",
  next_email_at: NOW + 1 month
}

// IF NO RESPONSE (after 1 week):
{
  email_11_poslat: true,
  status: "Not Interested",
  email_type: null, // Stop all emails
  next_email_at: null
}
```

---

## COLD NURTURE PATH (Monthly Educational Emails)

### NURTURE 1: Thought Leadership Content (MONTHLY)

**Purpose:** Stay top-of-mind without being salesy
**Timing:** 1 month after entering cold nurture
**Trigger:** `email_type: "cold_nurture_monthly"`
**Delay:** 30 days between each

**Strategy:**
- **Educational only** - No sales pitch
- **Genuine value** - Industry insights, trends
- **Soft CTA** - Easy to book if they want
- **Easily unsubscribe** - Respect their inbox

**Subject Line:**
`[SmartFlow Insights] Šta se dešava sa AI automatizacijom u Srbiji ({{current_month}})`

**Email Copy:**

```
Zdravo {{ime}},

Mesečni update sa SmartFlow insights - bez prodaje, samo korisne informacije.

**Šta vidim u AI trendu u Srbiji ({{current_month}} {{current_year}}):**

1. **Povećan interes za CRM automatizaciju** - Sve više kompanija shvata da Excel tabele nisu održive za duži rok

2. **Meta zateguje pravila za bote** - App Review proces je postao stroži, što znači da "amaterski" chatbotovi neće moći da funkcionišu

3. **AI video kreacije postaju mainstream** - Već vidim konkurente koji koriste AI za marketing (kvalitet im je loš, ali krenit će)

**Jedan quick win koji možete primeniti odmah:**

Ako koristite Instagram za leadove - postavite automatski odgovor na prvi DM. Čak i jednostavno "Hvala na poruci, javljam se za 10min" povećava odgovor rate 30-40%.

Ne morate AI za ovo - Instagram ima ugrađenu opciju u podesavanjima.

**Ako želite dubinsku automatizaciju** - znate gde me naći. 😊

👉 https://cal.com/gutesa/30min

Pozdrav,
Nikola
SmartFlow.rs

P.S. Ako vam ovi email-ovi ne pružaju vrednost - [kliknite ovde da se odjavite]. Bez uvrede, obećavam!
```

**Why This Works:**
- **No sales pitch** - Builds trust through value
- **Quick win** - Actionable tip they can use immediately
- **Industry insights** - Positions you as thought leader
- **Easy unsubscribe** - Shows respect

**Supabase Update:**
```javascript
{
  nurture_1_poslat: true,
  next_email_at: NOW + 1 month // Continue monthly
}
```

---

## System Prompt Rewrites

### 1. Gemini Qualification Prompt (Workflow 1)

**Current Issues:**
- Too focused on internal categorization
- Doesn't output data useful for email personalization
- Budget/timeline criteria don't match actual lead behavior
- Doesn't capture psychographic data

**NEW PROMPT:**

```
Ti si AI asistent za kvalifikaciju potencijalnih klijenata (leadova) za SmartFlow - AI agenciju koja gradi custom AI sisteme, agente, i marketing rešenja za srpske kompanije.

TVOJ ZADATAK:
Analiziraj podatke o lead-u i kreiraj:
1. Kategoriju kvalifikacije (Hot/Warm/Cold)
2. Priority skor (1-100)
3. Personalizovane varijable za email kampanju
4. Preporuku za sledeću akciju

---

PODATCI O LEAD-U:

Ime: {{$json.body.ime}}
Email: {{$json.body.email}}
Kompanija: {{$json.body.kompanija}}
Najveća prepreka/izazov: {{$json.body.prepreka}}
Budžet: {{$json.body.budget}}
Vremenski okvir: {{$json.body.timeline}}
Tip usluge koja ih zanima: {{$json.body.service_interest}}

---

KRITERIJUMI ZA KATEGORIJU:

🔥 HOT LEAD (Vreo):
- Vremenski okvir: "Hitno" ili "1-3 meseca"
- Jasno definisan problem u "prepreka" polju
- Budžet: >5,000€ ILI spremni da investiraju (mentions ROI, investment)
- Kompanija postoji i konkretna je (ne generički "moja firma")
- Service interest: Konkretna usluga (AI Agent, Marketing, Prodajni Sistemi)
- Priority skor: 70-100
- SLEDEĆA AKCIJA: "Prioritetni poziv u roku od 24h"

🔸 WARM LEAD (Topao):
- Vremenski okvir: "3-6 meseci" ili "nije hitno ali planiram uskoro"
- Problem je opisan ali nije kritičan
- Budžet: 2,000-5,000€ ILI ne pominje budžet
- Kompanija postoji
- Service interest: Interesuju se ali nisu sigurni koji tip usluge
- Priority skor: 40-69
- SLEDEĆA AKCIJA: "Poslati Email 1 sa value delivery, zakazati discovery call u narednih 48-72h"

❄️ COLD LEAD (Hladan):
- Vremenski okvir: "6+ meseci" ili "samo istražujem opcije"
- Nejasan problem ili copy-paste generička poruka
- Budžet: <2,000€ ili "što jeftinije"
- Kompanija nije navedena ili generička ("moj biznis", "privatno")
- Service interest: Nejasno ili "sve me zanima"
- Priority skor: 1-39
- SLEDEĆA AKCIJA: "Dodati u nurture sekvencu, poslati Email 1, follow-up za 3 dana"

---

EMAIL PERSONALIZACIJA:

Na osnovu "prepreka" polja, identifikuj:
- pain_point_category: "time_shortage" | "lead_generation" | "content_creation" | "manual_work" | "competitor_advantage" | "other"
- suggested_solution: Kratak opis (1 rečenica) koji AI sistem bi najbolje rešio ovaj problem
- industry_guess: Na osnovu kompanije i prepreke, proceni industriju (ako nije očigledno, stavi "general")

---

DODATNI SIGNALI KVALITETA:

POZITIVNI SIGNALI (povećaj priority):
- Pominje konkurenciju ("vidim da konkurenti koriste...")
- Pominje ROI ili merljive rezultate
- Konkretan problem sa brojevima ("100+ DM-ova dnevno", "5 sati na ručne odgovore")
- Profesionalni email (company domain, ne gmail/yahoo)
- Kompanija ima online presence (možeš pretpostaviti ako je .rs ili .com domen)

NEGATIVNI SIGNALI (smanji priority):
- Copy-paste generička poruka
- "Samo da vidim cene"
- Red flags: "besplatno", "što jeftinije", "odmah treba odgovor"
- Gmail/Yahoo email sa generičkim imenom
- Nejasna kompanija

---

FORMAT ODGOVORA:

Vrati SAMO validan JSON (bez markdown, bez dodatnog teksta):

{
  "kategorija": "Vreo" | "Topao" | "Hladan",
  "prioritet_skor": 1-100,
  "obrazlozenje": "Kratko objašnjenje (2-3 rečenice) zašto je lead kategorisan ovako. Profesionalan ali prijateljski ton.",
  "sledeca_akcija": "Konkretna preporučena akcija za tim.",
  "pain_point_category": "time_shortage" | "lead_generation" | "content_creation" | "manual_work" | "competitor_advantage" | "other",
  "suggested_solution": "Jedan AI sistem koji bi rešio njihov problem (1 rečenica)",
  "industry_guess": "Procenjena industrija ili 'general'"
}

---

VAŽNO:
- Odgovori na srpskom jeziku
- Budi precizan u oceni - ne naduvaj prioritet bez razloga
- Ako je očigledno spam ili low-quality lead, kategorisaj kao "Hladan" čak i ako pominje veliki budžet
- Obrazloženje treba da bude korisno za sales team - konkretno objasni ZAšto je kategorija takva
```

**Why This is Better:**
- **Captures psychographic data** - pain_point_category, industry_guess for email personalization
- **More realistic criteria** - 5000€ threshold instead of 10,000€ for hot leads
- **Positive/negative signals** - Accounts for lead behavior patterns
- **Email-ready output** - suggested_solution can be used in email copy
- **Spam filtering** - Explicitly handles low-quality submissions

---

## Implementation Plan: Supabase & n8n Backend Changes

### Phase 1: Database Schema Updates (Supabase)

#### New Fields to Add to `kontakti` Table:

```sql
-- Email tracking (expand existing)
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_3_poslat BOOLEAN DEFAULT FALSE;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_9_poslat BOOLEAN DEFAULT FALSE;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_10_poslat BOOLEAN DEFAULT FALSE;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_11_poslat BOOLEAN DEFAULT FALSE;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS nurture_1_poslat BOOLEAN DEFAULT FALSE;

-- Meeting tracking
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS meeting_day VARCHAR(50); -- e.g. "utorak" for email copy
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS meeting_time_formatted VARCHAR(100); -- e.g. "15. februar u 14:00"
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS next_available_date DATE; -- For deadline urgency

-- Qualification enhancements (from AI)
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS pain_point_category VARCHAR(50); -- from Gemini output
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS suggested_solution TEXT; -- from Gemini output
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS industry_guess VARCHAR(100); -- from Gemini output

-- Email type states (expand existing)
-- NEW STATES:
-- "email_1" - welcome email (existing)
-- "waiting_for_booking" - sent Email 1, waiting to see if they book
-- "nurture_educational" - Email 2-3 educational sequence
-- "email_4_meeting_confirmed" - meeting booked, send confirmation
-- "email_5_one_day_before" - 1 day before meeting
-- "email_6_one_hour_before" - 1 hour before (conditional)
-- "post_meeting_followup" - Email 7, post-meeting
-- "email_8_followup_nudge" - Email 8, gentle nudge
-- "email_9_final_nudge" - Email 9, final push
-- "email_10_no_show" - no-show recovery
-- "email_11_breakup" - breakup email
-- "cold_nurture_monthly" - monthly educational emails

-- Intake form enhancements (NEW FIELDS TO CAPTURE)
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS budget VARCHAR(50); -- "< 2000€", "2000-5000€", "> 5000€"
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS timeline VARCHAR(50); -- "Hitno", "1-3 meseca", "3-6 meseci", "6+ meseci"
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS service_interest VARCHAR(100); -- "AI Agent", "Marketing", "Prodajni Sistemi", "Integracija"
```

#### Migration Script:

```sql
-- Run this in Supabase SQL Editor

-- 1. Add new email tracking fields
ALTER TABLE kontakti
  ADD COLUMN IF NOT EXISTS email_3_poslat BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_9_poslat BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_10_poslat BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_11_poslat BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nurture_1_poslat BOOLEAN DEFAULT FALSE;

-- 2. Add meeting formatting fields
ALTER TABLE kontakti
  ADD COLUMN IF NOT EXISTS meeting_day VARCHAR(50),
  ADD COLUMN IF NOT EXISTS meeting_time_formatted VARCHAR(100),
  ADD COLUMN IF NOT EXISTS next_available_date DATE;

-- 3. Add AI qualification enhancements
ALTER TABLE kontakti
  ADD COLUMN IF NOT EXISTS pain_point_category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS suggested_solution TEXT,
  ADD COLUMN IF NOT EXISTS industry_guess VARCHAR(100);

-- 4. Add intake form fields
ALTER TABLE kontakti
  ADD COLUMN IF NOT EXISTS budget VARCHAR(50),
  ADD COLUMN IF NOT EXISTS timeline VARCHAR(50),
  ADD COLUMN IF NOT EXISTS service_interest VARCHAR(100);

-- 5. Update existing records to new email_type states
UPDATE kontakti
SET email_type = 'waiting_for_booking'
WHERE email_type = 'email_1'
  AND email_1_poslat = TRUE
  AND meeting_time IS NULL;

-- 6. Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_kontakti_email_type ON kontakti(email_type);
CREATE INDEX IF NOT EXISTS idx_kontakti_next_email_at ON kontakti(next_email_at);
```

---

### Phase 2: Workflow 1 Updates (Kvalifikacija)

**File:** Workflow ID `oaSDcjiIMBI0UocZ`

#### Changes Required:

**1. Update Gemini Node (AI Qualification)**
- Replace system prompt with new prompt (see "System Prompt Rewrites" section above)
- Node ID: `6e9dfbb9-dbf1-4142-94d9-d7bd582fa631`

**2. Update Parse AI Response Code Node**
- Node ID: `67b720b9-fae5-46e1-a08b-9f6ca3d0ac89`

**NEW CODE:**

```javascript
const inputData = $input.first().json;
const content = inputData.content;
const responseText = typeof content === 'string' ? content : (content?.parts?.[0]?.text || "");

try {
  // Extract JSON from potentially markdown-formatted text
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
  const parsed = JSON.parse(jsonStr);

  const validCategories = ['Vreo', 'Topao', 'Hladan'];
  let kategorija = parsed.kategorija;
  if (!validCategories.includes(kategorija)) {
    kategorija = 'Hladan';
  }

  // Get intake form data
  const formData = $('Webhook - Lead Form').item.json.body;

  return [{
    // Existing fields
    kategorija: kategorija,
    prioritet_skor: parseInt(parsed.prioritet_skor) || 0,
    obrazlozenje: parsed.obrazlozenje || "Nema obrazloženja.",
    sledeca_akcija: parsed.sledeca_akcija || "Proveriti ručno.",
    ime: formData.ime,
    email: formData.email,
    kompanija: formData.kompanija,
    problem: formData.prepreka,

    // NEW: AI-generated personalization fields
    pain_point_category: parsed.pain_point_category || 'other',
    suggested_solution: parsed.suggested_solution || 'AI sistem prilagođen vašim potrebama',
    industry_guess: parsed.industry_guess || 'general',

    // NEW: Intake form enhancements
    budget: formData.budget || null,
    timeline: formData.timeline || null,
    service_interest: formData.service_interest || null
  }];
} catch (e) {
  return [{
    kategorija: "Hladan",
    prioritet_skor: 0,
    obrazlozenje: "Greška pri parsiranju AI odgovora: " + e.message,
    sledeca_akcija: "Ručna provera",
    ime: $('Webhook - Lead Form').item.json.body.ime,
    email: $('Webhook - Lead Form').item.json.body.email,
    pain_point_category: 'other',
    suggested_solution: 'Kontaktirajte nas za prilagođeno rešenje',
    industry_guess: 'general'
  }];
}
```

**3. Update Supabase Insert Node**
- Node ID: `1c06769d-7879-464d-9de3-321d0c8db5a9`

**NEW FIELD MAPPINGS:**

```javascript
{
  // Existing fields (keep these)
  ime: "={{$('Webhook - Lead Form').item.json.body.ime}}",
  email: "={{$('Webhook - Lead Form').item.json.body.email}}",
  kompanija: "={{$('Webhook - Lead Form').item.json.body.kompanija}}",
  problem: "={{ $('Webhook - Lead Form').item.json.body.prepreka }}",
  kategorija: "={{$json.kategorija}}",
  prioritet_skor: "={{$json.prioritet_skor}}",
  obrazlozenje: "={{$json.obrazlozenje}}",
  sledeca_akcija: "={{$json.sledeca_akcija}}",
  status: "Novi Lead",
  izvor: "Landing Page",
  intake_data: "={{ $('Webhook - Lead Form').item.json.body }}",
  client_id: "69acf7e9-557e-4ca3-85bd-a785ef39e351",

  // UPDATED: Email sequence starts with email_1
  email_type: "email_1",
  next_email_at: "={{ $now.toISO() }}", // CHANGED: Send Email 1 immediately

  // NEW FIELDS: AI personalization
  pain_point_category: "={{$json.pain_point_category}}",
  suggested_solution: "={{$json.suggested_solution}}",
  industry_guess: "={{$json.industry_guess}}",

  // NEW FIELDS: Intake form data
  budget: "={{ $('Webhook - Lead Form').item.json.body.budget }}",
  timeline: "={{ $('Webhook - Lead Form').item.json.body.timeline }}",
  service_interest: "={{ $('Webhook - Lead Form').item.json.body.service_interest }}"
}
```

**4. ADD NEW NODE: Send Email 1 (Welcome)**

**Add after Supabase Insert node:**

- **Type:** Gmail node
- **Name:** "Gmail - Email 1 Welcome"
- **Position:** After Supabase Insert
- **Configuration:**
  - Send To: `={{ $json.email }}`
  - Subject: Use Email 1 subject from email copy section
  - Message: Use Email 1 body from email copy section
  - Use personalization variables: `{{ime}}`, `{{kompanija}}`, `{{prepreka}}`, `{{suggested_solution}}`

**Connection:**
```
Supabase Insert → Gmail Email 1 → Update Lead (set email_type to "waiting_for_booking")
```

---

### Phase 3: Workflow 2 Updates (Email Master v5)

**File:** Workflow ID `hA8nFaedBOsHHy8D`

#### Changes Required:

**1. Update Switch Node**
- Node ID: `c61376bd-2a8d-4e3b-aeb0-33709f9c6184`
- **ADD NEW CONDITIONS:**

```javascript
// EXISTING conditions (keep):
- email_2 → GmailE2
- email_3 → GmailE3
- email_4 → GmailE4
- email_5 → GmailE5
- email_6 → GmailE6
- email_7 → GmailE7
- email_8 → GmailE8
- nurture_2 → Gmail-Nurture2

// NEW CONDITIONS to add:
{
  conditions: {
    conditions: [{
      leftValue: "={{ $json.email_type }}",
      rightValue: "email_1",
      operator: "equals"
    }]
  }
} → Route to NEW "GmailE1" node

{
  conditions: {
    conditions: [{
      leftValue: "={{ $json.email_type }}",
      rightValue: "waiting_for_booking",
      operator: "equals"
    }]
  }
} → Route to NEW "Check If Booked" IF node

{
  conditions: {
    conditions: [{
      leftValue: "={{ $json.email_type }}",
      rightValue: "nurture_educational",
      operator: "equals"
    }]
  }
} → Route to NEW "GmailE2-Educational" node

// ... continue for all new email_type states
```

**2. ADD NEW NODES:**

**Email 1 (Welcome + Value)**
- **Node Type:** Gmail
- **Name:** "GmailE1-Welcome"
- **Copy:** See EMAIL 1 section above
- **Personalization:**
  - `{{ime}}`
  - `{{kompanija}}`
  - `{{prepreka}}` (from problem field)
  - `{{suggested_solution}}` (from AI)

**After Email 1 Update:**
```javascript
{
  email_1_poslat: true,
  email_type: "waiting_for_booking",
  next_email_at: NOW + 3 days
}
```

**Check If Booked (IF Node)**
- **Condition:** `meeting_time IS NOT NULL`
- **TRUE branch:** Route to "Email 4 Meeting Confirmation"
- **FALSE branch:** Route to "Email 2 Educational"

**Email 2 (Authority Building)**
- **Node:** GmailE2-Educational
- **Copy:** See EMAIL 2 section
- **Update after:** `email_type: "nurture_educational", next_email_at: NOW + 2 days`

**Email 3 (Educational + CTA)**
- **Node:** GmailE3-Educational
- **Copy:** See EMAIL 3 section
- **Update after:** Check if meeting booked. If yes → email_4, if no → cold_nurture_monthly

**Continue for all 11 emails...**

**3. UPDATE EXISTING EMAIL NODES:**

Replace copy in these nodes:
- **GmailE2 (Meeting Confirmation)** → Use EMAIL 4 copy
- **GmailE3 (1-Day Reminder)** → Use EMAIL 5 copy
- **GmailE4 (1-Hour Before)** → Use EMAIL 6 copy (add IF condition for online only)
- **GmailE6 (Post-Meeting)** → Use EMAIL 7 copy
- **GmailE7 (Follow-up)** → Use EMAIL 8 copy
- **GmailE8 (No-Show)** → Use EMAIL 10 copy

**4. ADD MISSING NODES:**

- **Email 9 (Final Nudge)** - NEW
- **Email 11 (Breakup)** - NEW
- **Nurture 1 (Monthly)** - Replace existing Nurture 2

---

### Phase 4: Intake Form Updates (Landing Page)

**Current Form Fields:**
- ime
- email
- kompanija
- prepreka

**NEW FORM STRUCTURE:**

```html
<!-- SECTION 1: Basic Info -->
<h2>Hajde da se upoznamo</h2>

<label>Vaše ime *</label>
<input type="text" name="ime" placeholder="npr. Marko Petrović" required>

<label>Email *</label>
<input type="email" name="email" placeholder="marko@vasafirma.rs" required>

<label>Kompanija *</label>
<input type="text" name="kompanija" placeholder="npr. Petrović Solutions d.o.o." required>

<!-- SECTION 2: Qualification Questions -->
<h2>Pomozite nam da razumemo vaše potrebe</h2>

<label>Koja je vaša najveća prepreka trenutno? *</label>
<textarea name="prepreka" placeholder="npr. Trošimo 5+ sati dnevno na ručne odgovore Instagram poruka" required></textarea>

<label>Šta vas najviše zanima? *</label>
<select name="service_interest" required>
  <option value="">Izaberite...</option>
  <option value="AI Agent">AI Agent za društvene mreže (Instagram/FB/WhatsApp)</option>
  <option value="Marketing">AI Marketing kreacije (video, slike, content)</option>
  <option value="Prodajni Sistemi">AI Prodajni Sistemi (lead gen, email, CRM)</option>
  <option value="Integracija">AI Integracija (custom rešenja)</option>
  <option value="Nisam siguran">Nisam siguran - želim da razgovaram</option>
</select>

<label>Kada planirate da krenete? *</label>
<select name="timeline" required>
  <option value="">Izaberite...</option>
  <option value="Hitno">Hitno - što pre moguće</option>
  <option value="1-3 meseca">U narednih 1-3 meseca</option>
  <option value="3-6 meseci">Za 3-6 meseci</option>
  <option value="6+ meseci">Samo istražujem opcije (6+ meseci)</option>
</select>

<label>Budžet koji imate na umu? *</label>
<select name="budget" required>
  <option value="">Izaberite...</option>
  <option value="> 5000€">Više od 5,000€</option>
  <option value="2000-5000€">2,000€ - 5,000€</option>
  <option value="< 2000€">Manje od 2,000€</option>
  <option value="Nisam siguran">Nisam siguran - želim da čujem opcije</option>
</select>

<!-- CTA -->
<button type="submit">Pošalji zahtev →</button>

<p class="privacy-note">🔒 Vaši podaci su bezbedni. Nikad ne delimo informacije sa trećim licima.</p>
```

**Form Copy Updates:**

**Above form:**
```
# Zakažite besplatnu konsultaciju (30 minuta)

Popunite formu ispod i javićemo vam se u roku od 24h sa konkretnim predlogom kako AI može ubrzati rast vaše firme.

**Šta dobijate:**
✅ Analizu vašeg trenutnog workflow-a
✅ Preporuku AI sistema za vaše potrebe
✅ Pricing opcije i ROI projekciju
✅ *Bonus: 1 besplatna demo verzija* (AI video ILI automation demo)
```

**After submit (Thank You Page):**
```
# Hvala, {{ime}}! Primili smo vaš zahtev. 🎯

Proverite svoj email ({{email}}) - poslali smo vam:
- Potvrdu prijema
- 3 konkretna načina kako AI može pomoći {{kompanija}}
- Link za zakazivanje termina

**Očekujte odgovor u roku od 24h.**

Pitanja? Pozovite direktno: +381 64 118 2200

[Nazad na SmartFlow.rs →]
```

---

### Phase 5: Implementation Checklist

**Step 1: Database** (15 min)
- [ ] Run Supabase migration script
- [ ] Verify new fields exist in `kontakti` table
- [ ] Test with sample insert

**Step 2: Workflow 1 (Qualification)** (30 min)
- [ ] Update Gemini prompt in node `6e9dfbb9-dbf1-4142-94d9-d7bd582fa631`
- [ ] Update Parse code in node `67b720b9-fae5-46e1-a08b-9f6ca3d0ac89`
- [ ] Update Supabase insert field mappings
- [ ] Add Email 1 Gmail node
- [ ] Add update node after Email 1
- [ ] Test workflow with test webhook

**Step 3: Workflow 2 (Email Master)** (2-3 hours)
- [ ] Add new Switch conditions for new email_type states
- [ ] Create Email 1 node (welcome)
- [ ] Create Email 2 node (authority)
- [ ] Create Email 3 node (educational)
- [ ] Update Email 4-8 copy in existing nodes
- [ ] Create Email 9 node (final nudge)
- [ ] Create Email 10 node (no-show - already exists, update copy)
- [ ] Create Email 11 node (breakup)
- [ ] Update Nurture nodes with new copy
- [ ] Add IF conditions for meeting type (online vs in-person)
- [ ] Test each email path with pinned data

**Step 4: Intake Form** (1 hour)
- [ ] Update form HTML with new fields
- [ ] Update form copy (header, CTA, privacy)
- [ ] Create thank you page
- [ ] Test form submission → Workflow 1 → Email 1 delivery
- [ ] Verify Supabase data capture

**Step 5: Testing** (2 hours)
- [ ] Test full happy path: Form → Email 1 → Email 2 → Email 3 → Meeting Booked → Emails 4-9
- [ ] Test no-show path: Meeting booked → No-show → Emails 10-11
- [ ] Test cold nurture: No meeting booked → Cold nurture monthly
- [ ] Verify all personalization variables work
- [ ] Check timing/delays are correct
- [ ] Test conditional logic (online vs in-person)
- [ ] Verify Supabase updates happen correctly

**Step 6: Deployment** (30 min)
- [ ] Backup current workflows (export JSON)
- [ ] Deploy Workflow 1 changes
- [ ] Deploy Workflow 2 changes
- [ ] Deploy intake form changes
- [ ] Monitor first 10 real submissions
- [ ] Fix any issues immediately

---

## Timeline Estimate

**Total Implementation Time:** 8-10 hours

- Database setup: 15 min
- Workflow 1 updates: 30 min
- Workflow 2 updates: 3 hours
- Intake form: 1 hour
- Testing: 2 hours
- Deployment & monitoring: 1 hour
- Buffer for unexpected issues: 2 hours

**Can be done in phases:**
- **Phase 1 (Day 1):** Database + Workflow 1 + Email 1 only → Test immediately
- **Phase 2 (Day 2):** Emails 2-3 educational sequence → Test nurture path
- **Phase 3 (Day 3):** Meeting confirmation emails 4-6 → Test meeting flow
- **Phase 4 (Day 4):** Post-meeting emails 7-9 → Test full sales cycle
- **Phase 5 (Day 5):** No-show & breakup emails 10-11 → Test recovery paths

---

## Success Metrics to Track

**Before vs After Comparison:**

| Metric | Current (Estimated) | Target (After Rewrite) |
|--------|---------------------|------------------------|
| Form completion rate | Unknown | Baseline + track |
| Email 1 open rate | N/A (no Email 1) | 40-50% |
| Meeting booking rate | ~16.7% (1 of 6 from cold email) | 25-30% from warm inbound |
| Meeting show rate | Unknown | 70-80% |
| Proposal acceptance | Unknown | Track for 3 months |
| Time to close | Unknown | Measure avg days |

**Track in Supabase:**
```sql
-- Add tracking fields
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS email_1_opened_at TIMESTAMP;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS calendar_link_clicked_at TIMESTAMP;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS proposal_sent_at TIMESTAMP;
ALTER TABLE kontakti ADD COLUMN IF NOT EXISTS deal_closed_at TIMESTAMP;
```

---

## A/B Testing Recommendations

**Once baseline is established (after 50 leads), test:**

1. **Subject Lines (Email 1)**
   - Variant A: `{{ime}}, evo tačno kako AI može ubrzati {{kompanija}}`
   - Variant B: `3 načina kako AI agencije pomažu firmama poput {{kompanija}}`
   - Measure: Open rate

2. **Email 1 CTA**
   - Variant A: Calendar link at bottom
   - Variant B: Calendar link mid-email + at bottom
   - Measure: Click-through rate

3. **Email Timing (Email 2-3)**
   - Variant A: 3 days, 5 days
   - Variant B: 2 days, 4 days
   - Measure: Meeting booking rate

4. **Intake Form**
   - Variant A: All fields required
   - Variant B: Only ime/email/prepreka required, rest optional
   - Measure: Form completion rate

---

## Notes & Constraints

**What I CANNOT Include (No Hallucination):**
- ❌ Testimonials from OZ Avala (meeting happened, no deal yet)
- ❌ Specific ROI numbers from past clients (no clients yet)
- ❌ Case study details (no completed projects for external clients)
- ❌ "Join 50+ companies" social proof (no client base yet)

**What I CAN Include (Factual):**
- ✅ Technical capabilities (Meta App Review, image analysis, n8n custom builds)
- ✅ Market positioning (only one in Serbia with these capabilities)
- ✅ Free demo offer (real offer you make)
- ✅ Competitive comparison (most agencies use ManyChat - verifiable)
- ✅ ROI calculations based on standard metrics (time saved, conversion lift)
- ✅ Pricing transparency (you have pricing structure)

**Voice & Tone Principles:**
- Confident without arrogance
- Knowledgeable without jargon
- Direct without being pushy
- Results-focused without fake metrics
- Serbian B2B professional (not American startup casual)

---

## Questions for Review

Before implementation, please confirm:

1. **Email sequence structure** - Does the 11-email flow make sense? Any emails to add/remove?
2. **Timing** - Are the delays between emails appropriate? (3 days, 2 days, 4 hours, etc.)
3. **Tone** - Does the copy match SmartFlow's voice? Too aggressive? Too passive?
4. **Intake form** - Are budget/timeline/service questions appropriate? Too invasive?
5. **Personalization** - Any additional variables you want to capture for customization?
6. **No-testimonial strategy** - Is the authority-building approach without testimonials strong enough?
7. **Meeting format** - Do you offer both online and in-person? If only online, we can remove that conditional logic.
8. **Capacity constraint** - You mentioned "2-3 projects per month" - is this accurate for scarcity messaging?

---

**Next Step:** Review this document, provide feedback, and I'll create the final implementation files with exact n8n node configurations and copy-paste ready email templates in Serbian.
