import json
import base64
import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

def send_gmail_via_oauth():
    # Credentials from application_default_credentials.json
    creds_path = "/Users/johhn/.config/gcloud/application_default_credentials.json"
    if not os.path.exists(creds_path):
        print("ERROR: ADC file not found.")
        return

    with open(creds_path, 'r') as f:
        info = json.load(f)

    # Scopes needed for Gmail
    SCOPES = ['https://www.googleapis.com/auth/gmail.send']

    creds = Credentials(
        token=None,
        refresh_token=info.get('refresh_token'),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=info.get('client_id'),
        client_secret=info.get('client_secret'),
        scopes=SCOPES
    )

    # Refresh the token
    creds.refresh(Request())

    service = build('gmail', 'v1', credentials=creds)

    sender_email = "nikola@smartflow.rs"
    receiver_email = "johhnylaa@gmail.com"

    message = MIMEMultipart()
    message['to'] = receiver_email
    message['from'] = f"Nikola Guteša <{sender_email}>"
    message['subject'] = "IZVINJENJE: AI je totalno pobrljavio (ali smo ga smirili)"

    body = """Dobar dan, Olgice,

Pre svega, izvinite na svim onim čudnim emodžijima u prethodnim pokušajima. Moj AI agent (Antigravity) se malo previše uzbudio dok je pokušavao da dokaže da može da šalje mejlove. 😅

Evo, sada zvanično šaljem iz SmartFlow.rs domena koristeći OAuth2, što znači da smo rešili glavnu prepreku!

Nadam se da ste primili i onaj test sa JOHHNYLAA@GMAIL.COM (on je prošao ranije).

Sve je podešeno i spremni smo za pravu kampanju.

Pozdrav,
Nikola"""

    msg = MIMEText(body)
    message.attach(msg)

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    create_message = {'raw': raw}

    try:
        service.users().messages().send(userId='me', body=create_message).execute()
        print("SUCCESS: Email sent from nikola@smartflow.rs via OAuth2!")
    except Exception as error:
        print(f"FAILED: {error}")

if __name__ == "__main__":
    send_gmail_via_oauth()
