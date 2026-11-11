"use client"

/**
 * SmartflowMark — the brand logomark.
 *
 * The previous version drew a thin curved line with three small circles on it,
 * meant to read as "messages flowing into one node". At the 18px it actually
 * renders inside the rail tile, the curve and the small circles collapsed into an
 * indistinct blob that looked like a key. A logomark gets one job — be recognisable
 * at the smallest size it will ever appear.
 *
 * So: three solid bars stepping in from the left, resolving into one filled
 * chevron. Same idea, but built from shapes heavy enough to survive 18px.
 */
export function SmartflowMark({ size = 24, color = "#05080c" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* the many, stepping in */}
      <rect x="3" y="8"  width="9"  height="3.4" rx="1.7" fill={color} opacity="0.5" />
      <rect x="3" y="14.3" width="13" height="3.4" rx="1.7" fill={color} opacity="0.75" />
      <rect x="3" y="20.6" width="9"  height="3.4" rx="1.7" fill={color} opacity="0.5" />
      {/* the one */}
      <path
        d="M18.6 6.4a1.9 1.9 0 0 1 2.8-.3l7.2 8a1.9 1.9 0 0 1 0 2.5l-7.2 8a1.9 1.9 0 1 1-2.8-2.5l6-6.7-6-6.7a1.9 1.9 0 0 1 0-2.3Z"
        fill={color}
      />
    </svg>
  )
}
