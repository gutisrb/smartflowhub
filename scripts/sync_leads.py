import json
import requests
import os
import time

# Configuration from .env.local
SUPABASE_URL = "https://ndazbdkytcksmhoabtgs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTc0ODEsImV4cCI6MjA4NjA3MzQ4MX0.ZvJKvdaVIGPJMVxmVCALJzWuHsOfkQzNpWpC8W8tiR8"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def load_drafts():
    all_drafts = []
    base_path = "/Users/johhn/.gemini/antigravity/playground/photonic-lunar/ai-growth-dashboard"
    for i in range(1, 8):
        file_path = f"{base_path}/bco_batch_{i}.json"
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                all_drafts.extend(json.load(f))
    return all_drafts

def get_supabase_leads():
    url = f"{SUPABASE_URL}/rest/v1/kontakti?select=id,company_name&status=eq.Kontaktiran"
    response = requests.get(url, headers=HEADERS)
    response.raise_for_status()
    return response.json()

def sync():
    drafts = load_drafts()
    db_leads = get_supabase_leads()
    
    import re
    def clean_name(name):
        # Remove common suffixes and parentheticals
        n = name.lower()
        n = re.sub(r'\(.*?\)', '', n) # Remove (enriched) etc.
        n = re.sub(r'\b(d\.o\.o\.|doo|ltd|corp|inc|rs|srbija)\b', '', n)
        n = re.sub(r'[^\w\s]', '', n) # Remove punctuation
        return n.strip()

    clean_db_leads = {clean_name(lead['company_name']): lead['id'] for lead in db_leads}
    
    success_count = 0
    fail_count = 0
    
    for draft in drafts:
        name = clean_name(draft['company_name'])
        lead_id = clean_db_leads.get(name)
        
        if not lead_id:
            # Try a partial match if unique
            matches = [id for cn, id in clean_db_leads.items() if name in cn or cn in name]
            if len(matches) == 1:
                lead_id = matches[0]
        
        if lead_id:
            update_data = {
                "email_draft": draft['email_draft'],
                "email_2_draft": draft['email_2_draft'],
                "email_type": "email_2",
                "next_email_at": None # Set to null so they dont send yet
            }
            
            patch_url = f"{SUPABASE_URL}/rest/v1/kontakti?id=eq.{lead_id}"
            try:
                res = requests.patch(patch_url, headers=HEADERS, json=update_data)
                res.raise_for_status()
                success_count += 1
                print(f"Uspesno azuriran: {draft['company_name']}")
            except Exception as e:
                print(f"Greska pri azuriranju {draft['company_name']}: {e}")
                fail_count += 1
        else:
            print(f"Nije pronadjen lead u DB: {draft['company_name']}")
            fail_count += 1
            
    print(f"\nFinalni rezultat: {success_count} uspesnih, {fail_count} neuspelih.")

if __name__ == "__main__":
    sync()
