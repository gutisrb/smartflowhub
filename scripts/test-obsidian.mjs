import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

function loadEnv() {
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch (e) {
    console.error('Failed to load .env.local');
  }
}

loadEnv();

const key = process.env.OBSIDIAN_API_KEY;
const port = process.env.OBSIDIAN_PORT || '27124';

async function test() {
  console.log(`🔍 Testing Obsidian Connection on port ${port}...`);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/vault/`, {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Connected successfully!');
      console.log(`📁 Found ${data.files.length} items in vault.`);
      console.log('📄 Sample files:', data.files.slice(0, 5));
    } else {
      console.error(`❌ Connection failed: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log('Error output:', text);
    }
  } catch (e) {
    console.error('❌ Connection failed: Could not reach Obsidian. Is the "Local REST API" plugin running?');
    console.error(e.message);
  }
}

test();
