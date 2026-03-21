import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTc0ODEsImV4cCI6MjA4NjA3MzQ4MX0.ZvJKvdaVIGPJMVxmVCALJzWuHsOfkQzNpWpC8W8tiR8';
const SMARTFLOW_CLIENT_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function extractDomain(website) {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0];
  }
}

async function scrapeWebsite(domain) {
  try {
    console.log(`Scraping ${domain}...`);
    // Timeout applied to execSync (e.g., 20 seconds)
    const result = execSync(`firecrawl scrape "https://${domain}" --format markdown --only-main-content`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'], // ignore stderr to keep logs clean
      timeout: 20000,
    });
    return result.trim().substring(0, 3000); // Take first 3000 chars to avoid huge payloads
  } catch (error) {
    console.log(`  Failed to scrape ${domain}: ${error.message}`);
    return null;
  }
}

async function main() {
  const { data: leads, error } = await supabase
    .from('contacts')
    .select('id, company_name, website, intake_data')
    .eq('client_id', SMARTFLOW_CLIENT_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching leads:', error);
    return;
  }

  console.log(`Found ${leads.length} top leads to update.\n`);

  for (const lead of leads) {
    const domain = extractDomain(lead.website);
    if (!domain) {
      console.log(`Skipping ${lead.company_name} (no valid website).`);
      continue;
    }

    const scrapedContent = await scrapeWebsite(domain);
    
    if (scrapedContent) {
      const intakeData = lead.intake_data || {};
      intakeData.enrichment = intakeData.enrichment || {};
      intakeData.enrichment.website_content = scrapedContent;

      const { error: updateError } = await supabase
        .from('contacts')
        .update({ intake_data: intakeData })
        .eq('id', lead.id);

      if (updateError) {
        console.error(`  Error updating ${lead.company_name} in DB:`, updateError);
      } else {
        console.log(`  ✓ Updated ${lead.company_name} with website content.`);
      }
    } else {
       console.log(`  - No content scraped for ${lead.company_name}.`);
    }
  }
}

main();
