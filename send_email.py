import json
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import ssl

def send_real_draft(company_name):
    SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co'
    SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTc0ODEsImV4cCI6MjA4NjA3MzQ4MX0.ZvJKvdaVIGPJMVxmVCALJzWuHsOfkQzNpWpC8W8tiR8'
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    # Fetch from kontakti
    url = f"{SUPABASE_URL}/rest/v1/kontakti?company_name=eq.{company_name}&select=email_draft,email"
    res = requests.get(url, headers=headers)
    data = res.json()
    
    if not data or not data[0].get('email_draft'):
        print(f"FAILED: Draft not found for {company_name}")
        return

    draft_text = data[0]['email_draft']
    receiver_email = "johhnylaa@gmail.com" # Test receiver for now
    
    # Parse Subject and Body
    lines = draft_text.split('\n')
    subject = ""
    body = ""
    for line in lines:
        if line.startswith("Subject: "):
            subject = line.replace("Subject: ", "")
        else:
            body += line + "\n"

    # Gmail SMTP with App Password (works for personal auth)
    sender_email = "nikola@smartflow.rs"
    password = "hwrw dgsp txtm tjwa" # I'll use OAuth for workspace next, but testing this first

    message = MIMEMultipart()
    message['Subject'] = subject
    message['From'] = f"Nikola Guteša <{sender_email}>"
    message['To'] = receiver_email
    message.attach(MIMEText(body, 'plain'))

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls(context=context)
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message.as_string())
        print(f"SUCCESS: REAL draft sent for {company_name}")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    send_real_draft("Ajo Leather")
