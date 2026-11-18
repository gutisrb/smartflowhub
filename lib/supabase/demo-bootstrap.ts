import { DEMO_PREVIEW_KEYS } from "@/lib/supabase/demo-preview"

/**
 * Seeds this tab's storage with a freshly minted demo session and hard-navigates to the dashboard. A full load (not a
 * client-side route change) so the module-level Supabase client is rebuilt and picks up the demo cookie adapter.
 * Used by /api/demo-login (operator preview) and /d/[id]/[sig] (the lead's own link). `operator` marks the tab so its
 * views are not counted as the lead's (lib/demo-track.ts).
 */
export function bootstrapPage(
  tenantName: string,
  tokens: { access_token: string; refresh_token: string },
  opts: { operator: boolean },
) {
  // < so a token can never terminate the script element early
  const payload = JSON.stringify(tokens).replace(/</g, "\\u003c")
  const name = tenantName.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))
  const operatorLine = opts.operator
    ? `sessionStorage.setItem(${JSON.stringify(DEMO_PREVIEW_KEYS.operator)}, "1");`
    : `sessionStorage.removeItem(${JSON.stringify(DEMO_PREVIEW_KEYS.operator)});`
  return `<!doctype html>
<html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${name} — demo</title>
<style>
  html,body{height:100%;margin:0}
  body{display:grid;place-items:center;background:#05080c;color:#8fa3b8;
       font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
</style></head>
<body><p id="s">Otvaram demo — ${name}…</p>
<script>
(function () {
  try {
    var t = ${payload};
    sessionStorage.setItem(${JSON.stringify(DEMO_PREVIEW_KEYS.flag)}, "1");
    ${operatorLine}
    sessionStorage.setItem(${JSON.stringify(DEMO_PREVIEW_KEYS.pending)}, JSON.stringify(t));
    sessionStorage.removeItem(${JSON.stringify(DEMO_PREVIEW_KEYS.store)});
    location.replace("/");
  } catch (e) {
    document.getElementById("s").textContent = "Ne mogu da otvorim demo: " + (e && e.message);
  }
})();
</script></body></html>`
}
