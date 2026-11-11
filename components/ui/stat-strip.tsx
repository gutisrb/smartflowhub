import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface Stat {
  key: string
  label: string
  value: ReactNode
  /** dot + label colour */
  color?: string
  /** small text under the value */
  hint?: string
  active?: boolean
  /** urgent tiles get a tinted border when they hold something */
  urgent?: boolean
  onClick?: () => void
  /** data-tour-focus name, when the tour points at this tile */
  focus?: string
}

/**
 * Compact KPI tiles (~60px): an 11px label with a status dot and a 22px tabular value.
 * Clickable tiles act as filters. Replaces the 76–110px glass stat cards each module had.
 */
export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div className={cn("grid gap-2 shrink-0", className ?? "grid-cols-2 sm:grid-cols-4")}>
      {stats.map((s) => {
        const Tag = s.onClick ? "button" : "div"
        const color = s.color ?? "#a1a1aa"
        return (
          <Tag key={s.key} onClick={s.onClick} data-tour-focus={s.focus}
            className={cn("rounded-xl surface-1 px-3 py-2 text-left border transition-colors",
              s.active ? "border-white/25 bg-white/[0.06]" : "border-transparent",
              s.onClick && !s.active && "hover:border-white/10")}
            style={s.urgent && !s.active ? { borderColor: `${color}55`, background: `${color}10` } : undefined}>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide truncate" style={{ color }}>
              {s.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
              {s.label}
            </span>
            <span className="block text-[22px] font-bold text-white font-outfit leading-tight tabular-nums">{s.value}</span>
            {s.hint && <span className="block text-[11px] text-zinc-500 leading-tight truncate">{s.hint}</span>}
          </Tag>
        )
      })}
    </div>
  )
}
