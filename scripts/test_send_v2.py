import json, os, smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Credentials
GMAIL_USER = "nikola@smartflow.rs"
GMAIL_PASS = "ysfp prtt jsvb jkxo"

def send_clean_test():
    base_path = "/Users/johhn/.gemini/antigravity/playground/photonic-lunar/ai-growth-dashboard"
    target_company = "Eurosalon Fabrika"
    target_email = "johhnylaa@gmail.com"
    
    # Load from bco_batch_6.json (where Eurosalon was drafted)
    with open(os.path.join(base_path, "bco_batch_6.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
        
    entry = next(item for item in data if item["company_name"] == target_company)
    
    subject = entry["email_2_draft"].split("Subject: ")[1].split("\n")[0]
    body_text = entry["email_2_draft"].split("\n\n", 1)[1] # Strip subject
    
    # Simple plain text version
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Nikola (SmartFlow) <{GMAIL_USER}>"
    msg["To"] = target_email
    
    # Body with no fake name
    plain_text = body_text.replace("<p>", "").replace("</p>", "\n")
    plain_text += "\n---\nUkoliko ne želite da primate dalje poruke, odgovorite sa 'STOP'."
    
    html_text = f"<html><body>{body_text}<hr><p style='font-size:12px; color: grey;'>Ukoliko ne želite da primate dalje poruke, odgovorite sa 'STOP' ili <a href='https://smartflow.rs/unsubscribe'>kliknite ovde</a>.</p></body></html>"
    
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_text, "html"))
    
    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(GMAIL_USER, GMAIL_PASS)
        server.sendmail(GMAIL_USER, target_email, msg.as_string())
        server.quit()
        print(f"Uspesno poslata ČISTA test poruka na {target_email}")
    except Exception as e:
        print(f"Greska: {e}")

if __name__ == "__main__":
    send_clean_test()
