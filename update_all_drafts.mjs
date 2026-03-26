import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SMARTFLOW_CLIENT_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MASTER_TEMPLATES = {
  SMS: {
    subject: "Ko u {{company_name}} vodi komunikaciju sa klijentima? Stvarno nema smisla.",
    body: `Dobar dan {{contact_name}},

Stvarno nema smisla da neko u {{company_name}} troši ceo ili deo radnog dana na poruke i vođenje društvenih mreža — a da vi pritom nemate nikakav uvid u to šta klijente zapravo zanima, koja pitanja imaju i zašto odustaju od prijave ili kupovine.

Mislim da biste imali manje haosa, a više prodaje i bolji odnos sa klijentima, uz AI sistem koji radi 24/7 na svim mrežama za manje nego što vas taj isti posao košta sada.
Sistem radi 168 sati nedeljno. Košta manje od tog istog radnika. I za razliku od njega — pamti svaki razgovor.

Vodi razgovor na tečnom srpskom, kao vaš najbolji prodavac — samo bez pauze, bolovanja i propuštenih poruka. {{engagement_line}} ovakav pristup pravi ogromnu razliku. 
Ali ovo nije šablonski chatbot. Ovo je jedini agent na tržištu koji ima analizu slika i videa, i razume odgovore na stori — napravljen od nule.

Svaki razgovor i svaki detalj se nalazi na jednom mestu: ko je pisao, šta mu treba, zbog čega je pitao, i gde je stao. 
Dobijate konkretne podatke iz razgovora i na osnovu njih možete da prilagodite ponudu, cene i marketing. Dobijate metrike koje u trenutnom sistemu nemate, a koje ljudski radnik jednostavno ne može da prikupi na ovaj način.

Osim toga, svi ovi podaci nam tačno govore šta vaši klijenti žele da vide. Umesto da plaćate skupe produkcije, možemo iskoristiti AI sistem za kreiranje video sadržaja i objava koje direktno odgovaraju na ta ista pitanja klijenata. 

Ovo nije "AI slop" – govorimo o 4K rezoluciji, najrealističnijem audio i video kvalitetu na tržištu, bez ikakvog plafona u kreativnosti. Sadržaj koji izgleda premium, a radi za vas 24/7 za delić cene tradicionalne produkcije.

Rezultat? Više klijenata. Zadovoljniji kupci. Bolja reputacija.

Kada god biste imali dvadesetak minuta slobodno, voleo bih da vam pokažem kako bi ovo tačno izgledalo za {{company_name}} — besplatno i bez obaveza.

Veliki pozdrav,

Nikola Guteša
Smartflow.rs
+381 64 118 2200`
  },
  AIO: {
    subject: "Koliko {{company_name}} organizaciono košta vođenje mreža? Stvarno nema smisla.",
    body: `Dobar dan {{contact_name}},

Da li ste se ikada zapitali zašto {{company_name}} troši toliko vremena na koordinaciju sa marketing agencijama, odobravanje objava i planiranje snimanja — a da pritom nemate sadržaj koji konzistentno, svakog dana, direktno donosi preglede i nove klijente?

Mislim da biste mogli da imate mnogo više rezultata — uz drastično manji budžet i nula organizacionog pritiska — uz AI sistem za generisanje videa i objavljivanje koji radi na autopilotu.

Tradicionalna produkcija je spora i skupa. Dok oni montiraju jedan video, naši AI sistemi produkuju desetine visoko-optimizovanih, vizuelno superiornih videa u 4K rezoluciji sa najrealističnijim AI tonom na tržištu. Bez ograničenja u produkciji, {{engagement_line}} ovi videi direktno rešavaju probleme vaših pratilaca.

Više niste ograničeni na dve objave nedeljno jer "produkcija košta". Dobijate neverovatan volumen sadržaja, testirate šta radi u realnom vremenu, smanjujete troškove reklamiranja i gradite organski doseg mnogo agresivnije.

Svaki video je prilagođen isključivo vašem brendu — to može biti pametan sistem koji edukuje klijente, prikazuje proizvod u najboljem svetlu, ili priča priču.

Rezultat? Masovno prisustvo na internetu. Ogromna ušteda u budžetu za agencije. Sadržaj koji zapravo konvertuje pratioce u kupce.

Kada god biste imali dvadesetak minuta slobodno, voleo bih da vam pokažem primere AI videa i kako bi ovo tačno izgledalo za {{company_name}} — besplatno i bez obaveza.

Veliki pozdrav,

Nikola Guteša
Smartflow.rs
+381 64 118 2200`
  },
  AIS: {
    subject: "Gde tačno nestaju klijenti {{company_name}}? Stvarno nema smisla.",
    body: `Dobar dan {{contact_name}},

Pitam se da li tačno znate u kom trenutku gubite potencijalne klijente koji dođu preko {{engagement_line}}? 

Mnogi biznisi ulažu velika sredstva u marketing, ali gube ogroman novac jer izostane precizna, trenutna komunikacija baš onda kada je interesovanje klijenta na vrhuncu. Lead-ovi se hlade dok čekaju na ljudski odgovor, a dragoceni podaci o tome zašto odustaju ostaju izgubljeni.

Mislim da biste uz AI prodajni sistem (Sales System) mogli da imate drastično veći povrat na uložene reklame. 

Ovaj sistem ne donosi haos, naprotiv – on momentalno uspostavlja kontakt sa svakim zainteresovanim klijentom, odgovara na njihova prva pitanja na srpskom jeziku (potpuno autonomno), i kvalifikuje ih pre nego što ikada dođu do prodajnog tima. Dok se vaš tim bavi administrativnim stvarima, sistem već obavlja preliminarni posao najboljeg stručnjaka za prodaju i nikada ne previđa follow-up sastanak.

Dobijate jasne metrike i sve detalje na jednom mestu: koji klijent je u kojoj fazi, šta ih koči, koje su bile zamerke. To su suvi podaci na osnovu kojih menjate prodaju, a koje klasični prodajni menadžeri često ne stignu uredno da zabeleže.

Rezultat? Više zatvorenih prodaja. Mnogo efikasnije iskorišćen budžet za reklame. Sigurnost da nijedan klijent nije propušten.

Kada god biste imali dvadesetak minuta slobodno, voleo bih da vam pokažem kako bi ovo tačno optimizovalo prodaju za {{company_name}} — besplatno i bez obaveza.

Veliki pozdrav,

Nikola Guteša
Smartflow.rs
+381 64 118 2200`
  }
};

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

function generateEmail(lead) {
  const intake = lead.intake_data || {};
  const enrichment = intake.enrichment || {};
  const igProfile = enrichment.instagram_profile || {};
  const followers = igProfile.followers || igProfile.follower_count || 0;
  const ads = intake.active_ads_count || 0;
  
  // Decide template
  let type = 'SMS';
  if (ads > 3) type = 'AIS';
  else if (followers > 10000) type = 'AIO';
  
  const template = MASTER_TEMPLATES[type];
  let body = template.body;
  let subject = template.subject;
  
  // Custom engagement lines
  let engagementLine = "";
  if (type === 'SMS') {
    engagementLine = followers > 0 
      ? `Imajući u vidu da vas prati preko ${formatNumber(followers)} ljudi,`
      : "S obzirom na intenzitet komunikacije koji imate,";
  } else if (type === 'AIO') {
    engagementLine = followers > 0
      ? `ovi videi direktno rešavaju probleme vaših ${formatNumber(followers)} pratilaca.`
      : "ovi videi direktno rešavaju probleme vaših pratilaca.";
    body = body.replace('{{engagement_line}}', engagementLine);
    engagementLine = ""; // Already replaced
  } else if (type === 'AIS') {
    engagementLine = ads > 0
      ? `vaših ${ads} aktivnih reklamnih kampanja`
      : "vaših reklamnih kampanja";
  }
  
  const replacements = {
    '{{company_name}}': lead.company_name || 'vaš brend',
    '{{contact_name}}': enrichment.contact?.name || '',
    '{{followers_count}}': formatNumber(followers),
    '{{active_ads_count}}': ads.toString(),
    '{{engagement_line}}': engagementLine
  };
  
  for (const [key, val] of Object.entries(replacements)) {
    body = body.replaceAll(key, val);
    subject = subject.replaceAll(key, val);
  }
  
  return `Subject: ${subject}\n\n${body}`;
}

async function main() {
  const { data: leads, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('client_id', SMARTFLOW_CLIENT_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Updating ${leads.length} leads...`);

  for (const lead of leads) {
    const draft = generateEmail(lead);
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ email_draft: draft })
      .eq('id', lead.id);
      
    if (updateError) {
      console.error(`Error updating ${lead.company_name}:`, updateError);
    } else {
      console.log(`✓ Updated ${lead.company_name}`);
    }
  }
}

main();
