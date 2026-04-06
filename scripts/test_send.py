import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os

# Credentials from .env.email
GMAIL_USER = "nikola@smartflow.rs"
GMAIL_PASS = "ysfp prtt jsvb jkxo"

def send_test_email():
    target = "johhnylaa@gmail.com"
    subject = "Re: Eurosalon Fabrika — dopuna (nevidljivi podaci)"
    
    # Plain text version (best for deliverability fallback)
    text_body = """Dobar dan, Nikola,

Samo kratka misao — u svetu nameštaja po meri, 'nevidljivost' podataka o tome šta kupce najviše koči pre posete salonu je veliki propust. SmartFlow te prepreke prepoznaje i pretvara u uvide koji vam pomažu da bolje planirate proizvodnju i kampanje.

Vredi li popričati o ovome u sredu?

Pozdrav,
Nikola
SmartFlow

---
Ukoliko ne želite da primate dalje poruke, odgovorite sa 'STOP'."""

    # HTML version (clean, minimal styling)
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Dobar dan, Nikola,</p>
        <p>Samo kratka misao — u svetu nameštaja po meri, "nevidljivost" podataka o tome šta kupce najviše koči pre posete salonu je veliki propust. SmartFlow te prepreke prepoznaje i pretvara u uvide koji vam pomažu da bolje planirate proizvodnju i kampanje.</p>
        <p>Vredi li popričati o ovome u sredu?</p>
        <br>
        <p>Pozdrav,<br>Nikola<br>SmartFlow</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">Ukoliko ne želite da primate dalje poruke, odgovorite sa "STOP" ili <a href="https://smartflow.rs/unsubscribe" style="color: #999;">kliknite ovde</a>.</p>
    </body>
    </html>
    """

    # Create message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Nikola (SmartFlow) <{GMAIL_USER}>"
    msg["To"] = target
    
    # Add both parts
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        # Gmail SMTP setup
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(GMAIL_USER, GMAIL_PASS)
        server.sendmail(GMAIL_USER, target, msg.as_string())
        server.quit()
        print(f"Uspesno poslata test poruka na {target}")
    except Exception as e:
        print(f"Greska pri slanju: {e}")

if __name__ == "__main__":
    send_test_email()
