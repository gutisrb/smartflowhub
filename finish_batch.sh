#!/bin/zsh
# finish_batch.sh — after build_demo_tenant.mjs: real comments → re-seed → claims gate, for every demo in "Demo se pravi".
# node collect_comments_apify.mjs --all-pipeline (skips tenants that already hold >=3 real questions), then seed + verify.
cd "$(dirname "$0")"
node collect_comments_apify.mjs --all-pipeline 2>&1 | grep -v "^skip"
node -e "
const fs=require('fs');for(const l of fs.readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^([^#=]+)=(.*)\$/);if(m&&!process.env[m[1].trim()])process.env[m[1].trim()]=m[2].trim()}
import('@supabase/supabase-js').then(async({createClient})=>{const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const {data}=await sb.from('contacts').select('demo_tenant_email').eq('client_id','69acf7e9-557e-4ca3-85bd-a785ef39e351').eq('pipeline_stage','demo_building').not('demo_tenant_email','is',null);
console.log((data||[]).map(r=>r.demo_tenant_email).join('\n'))})" | while read t; do [ -n "$t" ] && node seed_onboarding_story.mjs --email "$t" >/dev/null 2>&1; done
node verify_demo.mjs --all --save 2>&1 | grep -E "^(PASS|FAIL)|✗|^[0-9]+ pass" | cut -c1-200
