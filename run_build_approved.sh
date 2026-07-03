#!/bin/bash
# Cockpit build-approved chain: for every lead you approved in the cockpit
# (pipeline_stage='demo_building'), build its demo → write its email → move it
# to "Email spreman" (email_ready). Safe to run repeatedly; does nothing if
# there are no approved leads waiting. Does NOT send anything.
set -e
cd "$(dirname "$0")"
NODE=/Users/johhn/.nvm/versions/node/v25.1.0/bin/node

echo "[$(date '+%Y-%m-%d %H:%M')] build-approved: start"
"$NODE" build_demo_tenant.mjs --approved
"$NODE" generate_drafts.mjs --mode initial --approved
"$NODE" promote_email_ready.mjs
echo "[$(date '+%Y-%m-%d %H:%M')] build-approved: done"
