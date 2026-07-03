# SmartFlow background jobs

These run the machine while you sleep. **They are NOT active yet** — turn each on
when you're ready. `sync-inbox` is already active (installed earlier).

| Job | What it does | Sends email? |
|---|---|---|
| `rs.smartflow.source` | 06:00 daily — finds new ≥30K-follower leads → cockpit "Novi leadovi" | No (spends Apify $) |
| `rs.smartflow.build-approved` | every 10 min — for leads you approved: builds demo + writes email → "Email spreman" | No (spends OpenAI/Firecrawl $) |
| `rs.smartflow.send-approved` | 10:00 daily — sends leads you approved in the cockpit | **YES — real emails** |

## Turn one on

```bash
cp launchd/rs.smartflow.source.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/rs.smartflow.source.plist
```

## Turn one off

```bash
launchctl unload ~/Library/LaunchAgents/rs.smartflow.source.plist
```

## Check what's running

```bash
launchctl list | grep smartflow
```

**Recommendation:** turn on `source` and `build-approved` first (they cost a little
money but never send). Leave `send-approved` off and send with one command
(`node send_outreach.mjs --mode approved`) until you trust the flow — then turn it on.
