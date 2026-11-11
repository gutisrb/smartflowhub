"use client"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useMemo } from "react"
import { useUnifiedModules } from "@/lib/modules/hooks"
import { EnabledModule, ModuleKey } from "@/lib/modules/types"
import { BookStoreConfig, getBookStoreConfig } from "@/lib/brand-configs"
import { BrandSwitcherSidebar } from "@/components/dashboard/brand-switcher"

interface BrandEntry {
  id: string
  config: BookStoreConfig
}

interface SidebarProps {
  currentView: ModuleKey
  onViewChange: (view: ModuleKey) => void
  clientName: string
  clientId: string | null
  modules?: EnabledModule[]
  loading?: boolean
  isOpen?: boolean
  onClose?: () => void
  // Group / bookstore brand switcher
  isGroup?: boolean
  groupBrands?: BrandEntry[]
  selectedBrandIds?: string[]
  onBrandSelectionChange?: (ids: string[]) => void
  /** the business's own logo (onboarding_copy.brand_logo); a monogram when absent */
  logoUrl?: string | null
  /** the onboarding tour owns the screen: nothing in the sidebar is reachable */
  locked?: boolean
}

// ONE PANEL, ONE TREE.
//
// The rail used to be two copies of the nav (an always-visible icon rail and a hover panel
// that faded in over it), with the panel revealed by `group-hover` AND `focus-within`.
// Crossing the edge swapped one tree for the other (a visible flicker), and clicking an item
// left focus inside the panel so it stayed open after the mouse had gone.
//
// Now there is a single absolutely-positioned panel whose WIDTH changes 64 → 248px on hover.
// It is out of the page flow, so the page never reflows, and every item keeps the same
// 48px icon cell at the same x, so nothing moves while the labels reveal. Keyboard users get
// the same expansion through :focus-visible, which a mouse click does not trigger.
const RAIL = 64
const OPEN = 248

/** Initials for the monogram: "Stomatološka ordinacija Cvejanović" → "SC". */
export function monogram(name: string): string {
  const words = (name || "").replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1)
  if (words.length === 0) return "•"
  const pick = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]]
  return pick.map((w) => w[0]).join("").toUpperCase()
}

export function Sidebar({
  currentView, onViewChange, clientName, clientId,
  modules: propModules, loading: propLoading,
  isOpen, onClose,
  isGroup, groupBrands, selectedBrandIds, onBrandSelectionChange,
  logoUrl, locked,
}: SidebarProps) {
  const { modules: hookModules, loading: hookLoading } = useUnifiedModules(propModules ? null : clientId)

  const modules = propModules || hookModules
  const loading = propLoading !== undefined ? propLoading : hookLoading
  const bookStoreConfig = getBookStoreConfig(clientId)
  const brandName = bookStoreConfig ? bookStoreConfig.brandName : (clientName || "Dashboard")

  // One flat list in the order the business works in. The only divider separates the
  // account pages (Ponuda, Podešavanja) from the working pages above them.
  const items = useMemo(() => {
    const work = modules.filter((m) => m.category !== "settings")
    const account = modules.filter((m) => m.category === "settings")
    return { work, account }
  }, [modules])

  if (loading) {
    return (
      <div className="hidden md:flex md:flex-col shrink-0 h-screen sticky top-0 z-30 surface-rail" style={{ width: RAIL }}>
        <div className="p-3.5"><div className="w-9 h-9 bg-white/5 rounded-lg animate-pulse" /></div>
        <div className="flex-1 px-2 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    )
  }

  const logo = (
    <span className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.08] ring-1 ring-inset ring-white/10 text-[13px] font-bold tracking-wide text-white">
      {logoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logoUrl} alt="" className="w-full h-full object-contain bg-white" />
        : monogram(brandName)}
    </span>
  )

  /** `open` is the CSS-driven expanded state; labels are always in the DOM so nothing re-lays-out. */
  const nav = (
    <>
      <div className="h-[72px] shrink-0 flex items-center px-3.5 gap-3">
        {logo}
        <span className="label min-w-0 flex flex-col">
          <span className="text-[15px] font-outfit font-semibold text-white tracking-tight leading-tight truncate">{brandName}</span>
          <span className="text-[11px] text-zinc-500 leading-tight">AI prodajni sistem</span>
        </span>
        {onClose && (
          <button onClick={onClose} className="md:hidden ml-auto p-2 rounded-lg text-[#9fb0ad] hover:text-white hover:bg-white/10 transition-colors shrink-0" aria-label="Zatvori meni">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {isGroup && groupBrands && groupBrands.length > 0 && selectedBrandIds && onBrandSelectionChange && (
        <div className="label px-2 pb-2 shrink-0">
          <BrandSwitcherSidebar brands={groupBrands} selectedIds={selectedBrandIds} onSelectionChange={onBrandSelectionChange} />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 scrollbar-none" aria-label="Glavna navigacija">
        <ul className="space-y-0.5">
          {items.work.map((m) => (
            <NavItem key={m.key} module={m} active={currentView === m.key} onSelect={onViewChange} />
          ))}
        </ul>
        {items.account.length > 0 && (
          <>
            <div className="mx-2 my-3 h-px bg-white/[0.08]" />
            <ul className="space-y-0.5">
              {items.account.map((m) => (
                <NavItem key={m.key} module={m} active={currentView === m.key} onSelect={onViewChange} />
              ))}
            </ul>
          </>
        )}
      </nav>

      <div className="h-12 shrink-0 border-t border-white/[0.07] flex items-center gap-3 px-7">
        <span className="relative flex w-2 h-2 shrink-0">
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
        </span>
        <span className="label text-[12px] font-medium text-zinc-400 whitespace-nowrap">Agent aktivan</span>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop: a 64px slot in the page; the panel inside it widens over the content. */}
      <div className="hidden md:block shrink-0 h-screen sticky top-0 z-30" style={{ width: RAIL }}>
        <aside
          // `inert` removes the whole panel from pointer, focus and assistive tech while the tour runs
          inert={locked || undefined}
          className={cn(
            "sidebar-panel w-16 absolute inset-y-0 left-0 flex flex-col surface-rail overflow-hidden",
            "border-r border-white/[0.06]",
            "transition-[width,box-shadow] duration-200 ease-out",
            !locked && "hover:shadow-[16px_0_40px_-20px_rgba(0,0,0,0.85)] has-[:focus-visible]:shadow-[16px_0_40px_-20px_rgba(0,0,0,0.85)]",
          )}
          style={{ ["--rail-open" as string]: `${OPEN}px` }}
        >
          {nav}
        </aside>
      </div>

      {/* Mobile: off-canvas drawer, always expanded */}
      <aside
        inert={locked || undefined}
        className={cn(
          "sidebar-panel is-open md:hidden fixed inset-y-0 left-0 z-50 flex flex-col w-72 surface-rail overflow-hidden transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {nav}
      </aside>
    </>
  )
}

function NavItem({ module, active, onSelect }: { module: EnabledModule; active: boolean; onSelect: (k: ModuleKey) => void }) {
  const Icon = module.icon
  return (
    <li>
      <button
        onClick={() => onSelect(module.key)}
        aria-current={active ? "page" : undefined}
        title={module.displayName}
        className={cn(
          "relative w-full h-10 flex items-center rounded-lg transition-colors duration-150 outline-none",
          "focus-visible:ring-2 focus-visible:ring-emerald-400/60",
          active ? "bg-emerald-500/[0.14] text-white" : "text-[#a9bab7] hover:text-white hover:bg-white/[0.06]",
        )}
      >
        {active && <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r-full bg-emerald-400" />}
        <span className="w-12 shrink-0 flex items-center justify-center">
          <Icon className={cn("w-[18px] h-[18px]", active ? "text-emerald-300" : "text-[#8b9d9a]")} strokeWidth={1.75} />
        </span>
        <span className="label text-[14px] font-medium font-outfit whitespace-nowrap">{module.displayName}</span>
      </button>
    </li>
  )
}
