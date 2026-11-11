import type { ReactNode } from "react"

/**
 * One header for every module: title and a one-line summary on the left, controls on the
 * right, ~48px tall. Modules used to each invent their own (a 36px gradient title in the CRM,
 * 20px in the calendar, a three-line block in analytics), which read as five different apps.
 */
export function ModuleHeader({ title, subtitle, live, children }: {
  title: ReactNode
  subtitle?: ReactNode
  live?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
      <div className="flex items-baseline gap-3 min-w-0">
        <h2 className="text-[22px] font-outfit font-semibold tracking-tight text-white whitespace-nowrap">{title}</h2>
        {subtitle && <p className="text-[13px] text-zinc-500 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {live && (
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Uživo</span>
          </span>
        )}
        {children}
      </div>
    </div>
  )
}
