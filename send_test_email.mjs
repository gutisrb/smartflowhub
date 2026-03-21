import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load from our custom email env
dotenv.config({ path: resolve('.env.email') });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function sendTest() {
  const mailOptions = {
    from: `"SmartFlow AI" <${process.env.GMAIL_USER}>`,
    to: 'johhnylaa@gmail.com',
    subject: 'TEST: Vatanmed i Vaših 15 reklama – Ko tačno odgovara na poruke?',
    text: `Dobar dan, Olgice,

Stvarno nema smisla da Vatanmed gubi pacijente zbog propuštenih upita na društvenim mrežama. Trenutno imate 15 aktivnih reklama, što sigurno generiše ogroman broj poruka.

Ko u Vatanmed-u vodi komunikaciju sa potencijalnim klijentima? Ako su to zaposleni u prodaji, oni verovatno gube dragoceno vreme na osnovne odgovore umesto na konsultacije.

SmartFlow rešava ovo uvođenjem AI agenta koji trenutno odgovara na svaku poruku, kvalifikuje pacijente i zakazuje termine direktno u vaš kalendar (CRM). Umesto čekanja od sat vremena ili prebacivanja odgovornosti, komunikacija je instant.

Interesuje vas kako smo ovo već uradili za klinike slične vašoj?

Veliki pozdrav,

Nikola Guteša
Smartflow
Smartflow.rs
+381 64 118 2200`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

sendTest();
