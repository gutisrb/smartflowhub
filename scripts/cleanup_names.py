import json, os, re

base_path = "/Users/johhn/.gemini/antigravity/playground/photonic-lunar/ai-growth-dashboard"
files = [f for f in os.listdir(base_path) if f.startswith("bco_batch_") and f.endswith(".json")]

for file in files:
    file_path = os.path.join(base_path, file)
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for entry in data:
        # Replace "Dobar dan, [Name]," with "Dobar dan,"
        # This regex handles names like "Nikola", "Marko", "Jelena" followed by a comma
        for field in ["email_draft", "email_2_draft"]:
            if field in entry:
                entry[field] = re.sub(r'Dobar dan, [A-Z][a-z]+,', 'Dobar dan,', entry[field])
                
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Očišćeno {len(files)} fajlova od haluciniranih imena.")
