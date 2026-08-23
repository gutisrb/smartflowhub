"use client"

import { cn } from "@/lib/utils"
import { ChevronRight, UserCircle, Database, Zap, BarChart3, Settings, X } from "lucide-react"
import { SmartflowMark } from "@/components/dashboard/smartflow-mark"
import { useState, useMemo } from "react"
import { useUnifiedModules } from "@/lib/modules/hooks"
import { EnabledModule, ModuleCategory, ModuleKey } from "@/lib/modules/types"
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
  hideCategories?: boolean
}

interface CategoryConfig {
  key: ModuleCategory
  label: string
  collapsible: boolean
  icon: any
}

const CATEGORY_CONFIG: CategoryConfig[] = [
  { key: 'acquisition', label: 'Akvizicija', collapsible: false, icon: Zap },
  { key: 'fulfillment', label: 'Fulfillment & Servisi', collapsible: true, icon: Database },
  { key: 'analytics', label: 'Market Intelligence', collapsible: false, icon: BarChart3 },
  { key: 'settings', label: 'Podešavanja', collapsible: false, icon: Settings },
]

// The rail reserves a fixed 64px of layout and expands to a 272px flyout on hover,
// overlaying the content instead of pushing it — so content width never shifts.
const RAIL_W = "w-16"
const FLYOUT_W = "w-16 md:group-hover/rail:w-[272px] md:focus-within:w-[272px]"

// Anything that only makes sense with room to read it. Collapsed, these fade out
// AND give up their height, so the 64px rail is icons and dividers — never a word
// guillotined to its first letter, which is what the old rail actually rendered.
const REVEAL = "opacity-0 md:group-hover/rail:opacity-100 md:focus-within:opacity-100 transition-opacity duration-150"

export function Sidebar({
  currentView, onViewChange, clientName, clientId,
  modules: propModules, loading: propLoading,
  isOpen, onClose,
  isGroup, groupBrands, selectedBrandIds, onBrandSelectionChange,
  hideCategories,
}: SidebarProps) {
  const { modules: hookModules, loading: hookLoading } = useUnifiedModules(propModules ? null : clientId)

  const modules = propModules || hookModules
  const loading = propLoading !== undefined ? propLoading : hookLoading
  const bookStoreConfig = getBookStoreConfig(clientId)

  const [expandedCategories, setExpandedCategories] = useState<Set<ModuleCategory>>(
    new Set(['acquisition', 'fulfillment', 'analytics', 'settings'])
  )

  const modulesByCategory = useMemo(() => {
    const grouped = new Map<ModuleCategory, EnabledModule[]>()
    modules.forEach(module => {
      const existing = grouped.get(module.category) || []
      grouped.set(module.category, [...existing, module])
    })
    return grouped
  }, [modules])

  const toggleCategory = (category: ModuleCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  if (loading) {
    return (
      <div className={cn(RAIL_W, "hidden md:flex md:flex-col shrink-0 h-screen sticky top-0 z-30 surface-rail")}>
        <div className="p-4">
          <div className="w-9 h-9 bg-white/5 rounded-xl animate-pulse" />
        </div>
        <div className="flex-1 px-3 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-9 bg-white/5 rounded-lg animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    )
  }

  const navBody = (
    <>
      {/* ── Header: brand switcher (group) OR Smartflow logo ─────────────── */}
      {isGroup && groupBrands && groupBrands.length > 0 && selectedBrandIds && onBrandSelectionChange ? (
        <div className="relative">
          {onClose && (
            <div className="flex justify-end px-3 pt-4 md:hidden">
              <button onClick={onClose} className="p-2 rounded-lg text-[#9fb0ad] hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          <div className="overflow-hidden whitespace-nowrap px-2">
            <BrandSwitcherSidebar
              brands={groupBrands}
              selectedIds={selectedBrandIds}
              onSelectionChange={onBrandSelectionChange}
            />
          </div>
          <div className="mx-4 mt-2 mb-1 h-px bg-white/[0.06]" />
        </div>
      ) : (
        <div className="pt-5 pb-4 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                style={{ background: "linear-gradient(135deg, #34d39e, #10b981)" }}>
                <span className="relative z-10"><SmartflowMark size={18} /></span>
              </div>
              <div className={cn("flex flex-col gap-0.5 min-w-0 overflow-hidden whitespace-nowrap", REVEAL)}>
                <span className="text-[9px] font-bold text-emerald/80 uppercase tracking-[0.2em] leading-none">
                  SmartFlow
                </span>
                <span className="text-[15px] font-outfit font-semibold text-white tracking-tight leading-none truncate">
                  {bookStoreConfig ? bookStoreConfig.brandName : (clientName || "Dashboard")}
                </span>
              </div>
            </div>
            {onClose && (
              <button onClick={onClose} className="md:hidden p-2 rounded-lg text-[#9fb0ad] hover:text-white hover:bg-white/10 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 scrollbar-none">
        {hideCategories ? (
          <div className="space-y-1">
            {modules.map((module) => (
              <NavItem
                key={module.key}
                icon={module.icon}
                label={module.displayName}
                active={currentView === module.key}
                onClick={() => onViewChange(module.key)}
              />
            ))}
          </div>
        ) : (
          <div className="py-1">
            {CATEGORY_CONFIG.map((categoryConfig, groupIdx) => {
              const categoryModules = modulesByCategory.get(categoryConfig.key) || []
              if (categoryModules.length === 0) return null

              const isExpanded = expandedCategories.has(categoryConfig.key)

              return (
                <div key={categoryConfig.key} className="space-y-1">
                  {/* Collapsed: a hairline is the group boundary. Expanded: the name is. */}
                  {groupIdx > 0 && (
                    <div className="mx-3 my-2 h-px bg-white/[0.07] md:group-hover/rail:opacity-0 md:focus-within:opacity-0 transition-opacity duration-150" />
                  )}

                  <div className={cn(
                    "flex items-center gap-2 px-2.5 overflow-hidden",
                    "h-0 md:group-hover/rail:h-5 md:focus-within:h-5 md:group-hover/rail:mb-1 transition-all duration-150",
                    REVEAL,
                  )}>
                    <categoryConfig.icon className="w-3.5 h-3.5 text-[#7d918e] shrink-0" />
                    {categoryConfig.collapsible ? (
                      <button
                        onClick={() => toggleCategory(categoryConfig.key)}
                        className="flex-1 flex items-center justify-between text-[10px] font-bold text-[#9fb0ad] hover:text-white uppercase tracking-[0.13em] transition-colors whitespace-nowrap"
                      >
                        <span>{categoryConfig.label}</span>
                        <ChevronRight className={cn("w-3 h-3 transition-transform text-[#7d918e] shrink-0", isExpanded && "rotate-90")} />
                      </button>
                    ) : (
                      <div className="text-[10px] font-bold text-[#9fb0ad] uppercase tracking-[0.13em] whitespace-nowrap">
                        {categoryConfig.label}
                      </div>
                    )}
                  </div>

                  <div className={cn(
                    "space-y-0.5 overflow-hidden transition-all duration-300 ease-in-out",
                    // collapsing a category only applies once the rail is open — a
                    // collapsed rail must never hide its icons
                    !isExpanded ? "max-h-[500px] md:group-hover/rail:max-h-0 md:group-hover/rail:opacity-0" : "max-h-[500px] opacity-100"
                  )}>
                    {categoryModules.map((module) => (
                      <NavItem
                        key={module.key}
                        icon={module.icon}
                        label={module.displayName}
                        active={currentView === module.key}
                        onClick={() => onViewChange(module.key)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </nav>

      {/* ── Footer: who you are, and whether the agent is actually running ─── */}
      <div className="px-2 pb-3 pt-2 border-t border-white/[0.06] mt-1">
        <div className="rounded-xl p-2 hover:bg-white/[0.05] transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center text-[#b6c6c3] overflow-hidden">
                <UserCircle className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0b0e14]" />
            </div>
            <div className={cn("flex flex-col min-w-0 overflow-hidden whitespace-nowrap", REVEAL)}>
              <span className="text-[13px] font-medium text-white truncate">{clientName}</span>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Agent aktivan
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop: space-reserving rail (fixed 64px) with a flyout that expands on hover
          and overlays the content area — content width never shifts. */}
      <div className={cn(RAIL_W, "hidden md:block shrink-0 h-screen sticky top-0 z-30 group/rail")}>
        <div className={cn(
          FLYOUT_W,
          "h-full flex flex-col surface-rail overflow-hidden transition-[width] duration-200 ease-out",
          "md:group-hover/rail:shadow-[24px_0_60px_-24px_rgba(0,0,0,0.9)]",
        )}>
          {navBody}
        </div>
      </div>

      {/* Mobile: off-canvas drawer */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 flex flex-col w-72 surface-rail transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navBody}
      </div>
    </>
  )
}

function NavItem({ icon: Icon, label, active, onClick }: {
  icon: any
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-2.5 py-2.5 text-sm font-medium rounded-xl transition-colors duration-150 group/item relative",
        active
          ? "bg-emerald-500/[0.14] text-white"
          : "text-[#a9bab7] hover:text-white hover:bg-white/[0.06]"
      )}
    >
      {/* the active marker has to survive at 64px, where the label is gone */}
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-emerald-400 shadow-[0_0_12px_0_rgba(16,185,129,0.9)]" />
      )}

      <Icon className={cn(
        "w-[18px] h-[18px] shrink-0 transition-colors",
        active ? "text-emerald-300" : "text-[#8b9d9a] group-hover/item:text-white"
      )} />

      <span className={cn("font-outfit tracking-wide whitespace-nowrap overflow-hidden", REVEAL)}>
        {label}
      </span>

      {/* Collapsed rail needs a name on hover; the native title tooltip is too slow
          to be usable when you're scanning nine icons. Hidden once the rail opens. */}
      <span className="pointer-events-none absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 z-50
        whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white
        bg-[#151a22] border border-white/10 shadow-[0_12px_28px_-8px_rgba(0,0,0,0.9)]
        opacity-0 group-hover/item:opacity-100 transition-opacity duration-100
        md:group-hover/rail:hidden md:focus-within:hidden">
        {label}
      </span>
    </button>
  )
}
