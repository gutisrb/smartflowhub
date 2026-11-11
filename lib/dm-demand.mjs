// Does this business actually sell through its Instagram inbox? One account, judged on public evidence,
// cheapest evidence first. Shared by audit_dm_demand.mjs (audits) and find_leads.mjs (sourcing).
//
// Nikola's lead rules (vault wiki/lead-quality.md) this judges:
//   1  median reel views ≥ 30% of followers ("anyone can just buy 30k followers but have 3k views", 2026-10-28)
//   3  buyers ask in the comments (cena, termin, dostava…)
//   6  posted in the last 60 days
// Cost: the profile is 1 credit (retried up to 3× when the API returns it without posts) and decides rules 1
// and 6; comments are 1 credit per sampled post and are fetched only when the profile passes (2026-11-05).

export const INVITE   = /(inbox|\bdm\b|direct|poruk|pi[sš]ite|javite se|\bpp\b|info u|cen[aeu] u|viber|whats ?app)/i
export const OVERLOAD = /(velik\w* broj\w* (pitanja|poruka|upita)|ne stign\w*|ne dobijete odgovor|kasni\w* (sa )?odgovor|strpljen)/i
export const BOOKING  = /(zaka[zž]\w*|rezerv\w*|termin\w*|slobodn\w* (mest|termin|datum))/i
export const BUYER_Q  = /(cen[aeuo]\b|cijen|koliko|ko[sš]ta|ima li|imate li|mo[zž]e li|da li (ima|radite|mo[zž]e)|termin|slobodn|dostav|gde se nalaz|kako (da|mogu)|\binfo\b|poslal[ai] sam|odgovorite|\bpp\b|inbox|\bdm\b)/i

export const VIEWS_PER_FOLLOWER_MIN = 0.30
export const MAX_DAYS_SINCE_POST = 60

const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0 }

export function makeScrapeCreators(key) {
  let credits = null
  const sc = async (path) => {
    const r = await fetch(`https://api.scrapecreators.com${path}`, { headers: { 'x-api-key': key } })
    const j = r.ok ? await r.json() : null
    if (j && typeof j.credits_remaining === 'number') credits = j.credits_remaining
    return j
  }
  sc.credits = () => credits
  return sc
}

/** Returns a row; row.tier is A/B/C ('?' when the profile could not be read). row.pass = tier A or B. */
export async function checkDemand(sc, { handle, followers = null, name = null }, { posts: POSTS = 3, comments: WITH_COMMENTS = true } = {}) {
  const row = { name: name || '@' + handle, handle, followers }
  if (!handle) return { ...row, tier: '?', why: 'no IG handle on file', pass: false }

  let u = null
  for (let i = 0; i < 3; i++) {
    u = (await sc(`/v1/instagram/profile?handle=${encodeURIComponent(handle)}`))?.data?.user
    if (u?.edge_owner_to_timeline_media?.edges?.length || u?.is_private) break
    await new Promise(r => setTimeout(r, 1500))
  }
  if (!u) return { ...row, tier: '?', why: 'profile fetch failed', pass: false }
  if (!u.edge_owner_to_timeline_media?.edges?.length) return { ...row, tier: '?', why: u.is_private ? 'private account' : 'API returned no posts', pass: false }

  // Live follower count beats a stored one (stale, or absent for a sourcing candidate).
  if (u.edge_followed_by?.count) row.followers = u.edge_followed_by.count
  row.fullName = u.full_name || null
  row.website = u.external_url || null
  row.category = u.category_name || u.business_category_name || null
  row.bio = (u.biography || '').slice(0, 200)
  row.bioEmail = u.business_email || (u.biography || '').match(/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || null
  row.isBusiness = !!(u.is_business_account || u.is_professional_account)

  const now = Date.now() / 1000
  const nodes = u.edge_owner_to_timeline_media.edges.map(e => e.node)
  const caps = nodes.map(n => n.edge_media_to_caption?.edges?.[0]?.node?.text || '')
  const ts = nodes.map(n => n.taken_at_timestamp).sort((a, b) => b - a)
  row.daysSincePost = ts.length ? Math.round((now - ts[0]) / 86400) : null
  row.posts60d = ts.filter(t => now - t < 60 * 86400).length
  const reels = nodes.filter(n => n.is_video)
  row.reels12 = reels.length
  row.medViews = med(reels.map(n => n.video_view_count || 0))
  row.viewsPerFollower = row.followers ? +(row.medViews / row.followers).toFixed(3) : null
  row.medComments = med(nodes.map(n => n.comment_count ?? n.edge_media_to_comment?.count ?? 0))
  row.avgComments = nodes.length ? +(nodes.reduce((s, n) => s + (n.edge_media_to_comment?.count || 0), 0) / nodes.length).toFixed(1) : 0
  row.inviteBio = INVITE.test(u.biography || '')
  row.inviteCaps = caps.filter(c => INVITE.test(c)).length
  row.bookingCaps = caps.filter(c => BOOKING.test(c)).length
  row.overload = caps.filter(c => OVERLOAD.test(c)).map(c => c.slice(0, 160).replace(/\s+/g, ' '))

  // Rules 1 and 6 from the profile alone; a lead that fails them is not worth the comment credits.
  const dead = row.daysSincePost === null || row.daysSincePost > MAX_DAYS_SINCE_POST
  const hollow = (row.reels12 >= 2 && row.viewsPerFollower !== null && row.viewsPerFollower < VIEWS_PER_FOLLOWER_MIN) || (row.medComments === 0 && row.medViews < 500)
  row.hollow = hollow
  if (dead || hollow) {
    return { ...row, buyerQs: null, unansweredQs: null, sampleQs: [], tier: 'C', pass: false,
      why: dead ? `no post in ${row.daysSincePost ?? '?'} days` : `views ${row.viewsPerFollower}/follower` }
  }

  // 2026-11-11: comments no longer decide a lead (reels do, lib/lead-fit.mjs), so sourcing can skip their ~3 credits per lead.
  if (!WITH_COMMENTS) {
    const invitingNow = row.inviteBio || row.inviteCaps >= 2
    return { ...row, buyerQs: null, unansweredQs: null, sampleQs: [], tier: invitingNow ? 'B' : 'C', pass: true, why: 'profile only (comments skipped)' }
  }

  // Comments from the most-discussed recent posts: that is where buyers ask out loud.
  const sample = [...nodes].sort((a, b) => (b.edge_media_to_comment?.count || 0) - (a.edge_media_to_comment?.count || 0))
    .filter(n => (n.edge_media_to_comment?.count || 0) > 0).slice(0, POSTS)
  const qs = []
  for (const n of sample) {
    const c = await sc(`/v2/instagram/post/comments?url=${encodeURIComponent(`https://www.instagram.com/p/${n.shortcode}/`)}`)
    for (const cm of c?.comments || []) {
      if (cm.user?.username === handle) continue
      if (BUYER_Q.test(cm.text || '')) qs.push({ text: cm.text.slice(0, 90).replace(/\s+/g, ' '), replied: !!cm.child_comment_count })
    }
  }
  row.buyerQs = qs.length
  row.unansweredQs = qs.filter(q => !q.replied).length
  row.sampleQs = qs.slice(0, 4).map(q => q.text)

  const inviting = row.inviteBio || row.inviteCaps >= 2
  row.tier = row.overload.length || row.buyerQs >= 5 || (inviting && row.buyerQs >= 2) ? 'A'
    : inviting || row.bookingCaps >= 2 || row.buyerQs >= 1 ? 'B' : 'C'
  row.pass = row.tier !== 'C'
  return row
}

export function formatRow(row) {
  if (row.tier === '?') return `?  ${String(row.name).padEnd(38)} — ${row.why}`
  const base = `${row.tier}  ${String(row.name).padEnd(38)} ${String(row.followers).padStart(6)}  reels ${row.reels12} medViews ${row.medViews} (${row.viewsPerFollower}/fol) medCom ${row.medComments}  last post ${row.daysSincePost}d`
  if (row.buyerQs === null) return `${base}  — ${row.why} (comments not fetched)`
  return `${base}  avgCom ${row.avgComments}  invite bio:${row.inviteBio} caps:${row.inviteCaps}  booking:${row.bookingCaps}  buyerQs ${row.buyerQs} (unanswered ${row.unansweredQs})${row.overload.length ? '  ⚠ OVERLOAD' : ''}`
}
