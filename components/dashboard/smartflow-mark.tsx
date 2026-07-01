"use client"

/**
 * SmartflowMark — the brand logomark. Echoes the product's core motif:
 * customer messages flowing into one intelligent node. Accepts a brand color
 * so client demos can tint it, defaulting to SmartFlow emerald.
 */
export function SmartflowMark({ size = 24, color = "#05080c" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* connecting flow */}
      <path d="M6 22 C 12 22, 14 10, 22 10" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      {/* trailing message nodes (small → larger) */}
      <circle cx="6" cy="22" r="2" fill={color} opacity="0.45" />
      <circle cx="11.5" cy="20" r="2.4" fill={color} opacity="0.65" />
      {/* the intelligent core */}
      <circle cx="22" cy="10" r="5" fill={color} />
      <circle cx="22" cy="10" r="2" fill="#fff" opacity="0.85" />
    </svg>
  )
}
