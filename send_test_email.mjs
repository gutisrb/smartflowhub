import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve('.env.email') });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const subject = 'Rossen kozmetika — sistem koji rasterećuje tim od stalnih upita o proizvodima';

const textBody = `Poštovani,

Primetio sam u Vašem nedavnom videu da Vam "telefon ne prestaje da zvoni" zbog aktuelnih akcija — što je dobar problem, ali samo ako svaka ta poruka zaista dobije odgovor na vreme.

Mislim da biste imali manje haosa, a bolju prodaju, reputaciju i odnos sa klijentkinjama — uz AI sistem koji vodi sve razgovore na društvenim mrežama 24/7 i beleži svaki upit.

Vaš tim štedi 15–20 sati nedeljno. Svaka poruka odgovorena. Svaki upit ispraćen.

Svaki razgovor, svaki detalj je na jednom mestu: ko je pisao, za šta pita, šta ga zanima, gde je stao.
Dobijate konkretne podatke pomoću kojih možete da prilagodite ponudu, procese, marketing — sve na osnovu onoga što Vam klijentkinje zapravo govore.
Informacije koje trenutno jednostavno nemate.

Ali ovo nije šablonski chatbot.
Ovo je jedini agent na tržištu koji ima analizu slika i videa, i razume odgovore na stori — napravljen od nule.

Rezultat? Više prodaje, bez dodatnog posla.

Kada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za Rossen kozmetika — besplatno i bez ikakvih obaveza, uživo ili online: https://cal.com/smartflow.rs/20min

Veliki pozdrav,

Nikola Guteša
Smartflow
Smartflow.rs
+381 64 118 2200`;

// HTML rules:
// - Each <p> = one standalone paragraph (double newline in text)
// - <br> = single newline between complete sentences within a block
// - Never <br> mid-sentence
// - Bold: "15–20 sati nedeljno" (concrete number) + "Rezultat? Više prodaje, bez dodatnog posla." (payoff)
const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#000;max-width:580px">

<p>Poštovani,</p>

<p>Primetio sam u Vašem nedavnom videu da Vam "telefon ne prestaje da zvoni" zbog aktuelnih akcija — što je dobar problem, ali samo ako svaka ta poruka zaista dobije odgovor na vreme.</p>

<p>Mislim da biste imali manje haosa, a bolju prodaju, reputaciju i odnos sa klijentkinjama — uz AI sistem koji vodi sve razgovore na društvenim mrežama 24/7 i beleži svaki upit.</p>

<p>Vaš tim štedi <b>15–20 sati nedeljno</b>. Svaka poruka odgovorena. Svaki upit ispraćen.</p>

<p>Svaki razgovor, svaki detalj je na jednom mestu: ko je pisao, za šta pita, šta ga zanima, gde je stao.<br>
Dobijate konkretne podatke pomoću kojih možete da prilagodite ponudu, procese, marketing — sve na osnovu onoga što Vam klijentkinje zapravo govore.<br>
Informacije koje trenutno jednostavno nemate.</p>

<p>Ali ovo nije šablonski chatbot.<br>
Ovo je jedini agent na tržištu koji ima analizu slika i videa, i razume odgovore na stori — napravljen od nule.</p>

<p><b>Rezultat? Više prodaje, bez dodatnog posla.</b></p>

<p>Kada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za Rossen kozmetika — besplatno i bez ikakvih obaveza, uživo ili online: https://cal.com/smartflow.rs/20min</p>

<p>Veliki pozdrav,</p>

<p><b>Nikola Guteša</b><br><b>Smartflow</b><br><i>Smartflow.rs</i><br>+381 64 118 2200</p>

</div>`;

async function sendTest() {
  const mailOptions = {
    from: `"Nikola Guteša" <${process.env.GMAIL_USER}>`,
    to: 'johhnylaa@gmail.com',
    subject,
    text: textBody,
    html: htmlBody,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Error:', error);
  }
}

sendTest();
