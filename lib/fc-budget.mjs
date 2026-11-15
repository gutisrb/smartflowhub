// Process-wide Firecrawl spend guard (2026-11-14, Nikola: "make sure not to waste credits recklessly!!").
// The first 1000-credit plan of the week was spent in one day: an Instagram page read costs about 2 credits (the API's own `creditsUsed` says 0 for it and the
// balance endpoint lags), and the old website / email searches asked Firecrawl to scrape every result page (1 credit per page). Costs below are ASSUMED and
// deliberately on the high side; a plain search is 2 (the response reports it correctly). When the cap is reached the paid step is SKIPPED and says so, once,
// loudly: free layers keep working. Default cap is 100 credits per process; set FIRECRAWL_MAX_CREDITS to change it. The `firecrawl` CLI that some scripts
// shell out to is not counted here.
const COST = { search: 2, scrape: 1, instagram: 3 }
let spent = 0
let warned = false

export const fcSpent = () => spent
export const fcCap = () => Number(process.env.FIRECRAWL_MAX_CREDITS || 100)

/** @param {'search'|'scrape'|'instagram'} kind @returns {boolean} true = go ahead (and the credits are booked), false = budget reached, do not call */
export function fcCharge(kind) {
  const cost = COST[kind] ?? 1
  if (spent + cost > fcCap()) {
    if (!warned) { warned = true; console.log(`  ⛔ Firecrawl budget reached (${spent} of ${fcCap()} credits assumed spent in this run): paid steps are skipped. Raise FIRECRAWL_MAX_CREDITS to continue.`) }
    return false
  }
  spent += cost
  return true
}
