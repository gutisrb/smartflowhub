import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const leadDrafts = {
  "59cc2f8f-4998-49f6-957b-d9f98103bdec": { // La Force
    subject: "Pitanje za operacije u La Force (AI sistem za 400+ modela)",
    body: "Radimo sa brendovima kože i obuće koji aktivno oglašavaju stotine artikala (poput Vaših 400+ modela) i kojima je manuelna obrada upita postala glavna kočnica za dalji rast.\n\nPružamo kompletan AI operativni sistem koji tečno prepoznaje artikle sa slika koje Vam kupci šalju, samostalno vodi prodajni razgovor i sve podatke pakuje u jedan premium dashboard.\n\nRezultat je eliminacija 80% administrativnog tereta u prvih 30 dana, uz nivo kontrole i preciznosti u prodaji koji je fizički nemoguće ispratiti ručnim radom."
  },
  "b70c3021-d687-43ca-a309-8d19760a5d40": { // Magic Beauty
    subject: "Magic Beauty — Operativni sistem za 116k pratilaca (AI Dashboard)",
    body: "Radimo sa online prodavnicama kozmetike koje imaju preko 100k pratilaca i gde stalni upiti o viralnim proizvodima (poput Caudalie i arapskih parfema) stvaraju usko grlo u operacijama.\n\nPružamo AI operativni sistem koji samostalno obrađuje 100% upita i porudžbina 168 sati nedeljno, dok kroz jedan centralni dashboard dobijate jasnu analitiku o tome šta tržište traži u realnom vremenu.\n\nSistem vam omogućava da skalirate prodaju bez uvođenja novih smena za podršku, zadržavajući potpunu preglednost nad svakom interakcijom."
  },
  "186f3f7e-a4a5-4d19-bf42-0844b06a76fb": { // Computer Eyewear RS
    subject: "Computer Eyewear RS — Prodaja na Autopilotu (AI + Dashboard)",
    body: "Radimo sa shopovima zaštitnih naočara u Srbiji kojima edukativna prodaja i upiti o ramovima troše sate manuelnog rada na mrežama.\n\nPružamo AI sistem koji automatizuje ceo prodajni put — od stručnih odgovora o plavom svetlu do finalne porudžbine, uz premium dashboard koji služi kao komandna tabla za vaše digitalne operacije.\n\nUmesto manuelnog odgovaranja, dobijate infrastrukturu koja vodi svaku prodaju besprekorno i bez prestanka, dok vi imate punu kontrolu nad podacima."
  }
};

async function updateFollowUps() {
  for (const [id, draft] of Object.entries(leadDrafts)) {
    const fullDraft = `Subject: ${draft.subject}\n\n${draft.body}\n\nKada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za Vas — besplatno i bez obaveza: https://cal.com/smartflow.rs/20min\n\nPozdrav,\nNikola Guteša\nSmartflow.rs`;
    
    console.log(`Updating lead ${id}...`);
    const { error } = await supabase
      .from('contacts')
      .update({ 
        email_2_draft: fullDraft,
        email_framework: '3-sentence-bco' // Tracking the framework
      })
      .eq('id', id);

    if (error) {
      console.error(`Error updating lead ${id}:`, error);
    } else {
      console.log(`Successfully updated lead ${id}`);
    }
  }
}

updateFollowUps();
