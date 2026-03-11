"use client"

import { cn } from "@/lib/utils"
import { ChevronRight, UserCircle, Database, LayoutDashboard, Zap, BarChart3, Settings, ShieldCheck, Sparkles } from "lucide-react"
import { useState, useMemo } from "react"
import { useUnifiedModules } from "@/lib/modules/hooks"
import { EnabledModule, ModuleCategory, ModuleKey } from "@/lib/modules/types"

interface SidebarProps {
  currentView: ModuleKey
  onViewChange: (view: ModuleKey) => void
  clientName: string
  clientId: string | null
}

interface CategoryConfig {
  key: ModuleCategory
  label: string
  collapsible: boolean
  icon: any
}

const CATEGORY_CONFIG: CategoryConfig[] = [
  { key: 'crm', label: 'Growth Engine', collapsible: false, icon: Zap },
  { key: 'social', label: 'Inbound Channels', collapsible: true, icon: Database },
  { key: 'analytics', label: 'Market Intelligence', collapsible: false, icon: BarChart3 },
  { key: 'settings', label: 'System Config', collapsible: false, icon: Settings },
]

export function Sidebar({ currentView, onViewChange, clientName, clientId }: SidebarProps) {
  const { modules, loading } = useUnifiedModules(clientId)
  const [expandedCategories, setExpandedCategories] = useState<Set<ModuleCategory>>(
    new Set(['crm', 'social', 'analytics', 'settings'])
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
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="w-72 m-4 glass-panel rounded-3xl flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
        <div className="p-8 pb-4">
          <div className="w-12 h-12 bg-emerald/10 rounded-2xl animate-pulse" />
        </div>
        <div className="flex-1 px-6 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 m-4 mr-0 glass-panel rounded-3xl flex flex-col h-[calc(100vh-2rem)] relative overflow-hidden group/sidebar animate-in slide-in-from-left-8 duration-700 ease-out z-20">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald/5 to-transparent pointer-events-none opacity-50" />

      <div className="p-8 pb-6 relative z-10">
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-emerald flex items-center justify-center shadow-[0_0_20px_oklch(0.75_0.15_160_/_0.3)] group-hover:scale-110 transition-transform duration-500 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
              <ShieldCheck className="w-6 h-6 text-obsidian relative z-10" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-white/10 blur-md translate-y-full group-hover:translate-y-0 transition-transform duration-700" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald border-2 border-obsidian rounded-full animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-emerald uppercase tracking-[0.2em] leading-none mb-1">Photonic</span>
            <span className="text-xl font-outfit font-medium text-silver tracking-tight leading-none group-hover:text-white transition-colors">OS</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-8 scrollbar-none relative z-10">
        {CATEGORY_CONFIG.map(categoryConfig => {
          const categoryModules = modulesByCategory.get(categoryConfig.key) || []
          if (categoryModules.length === 0) return null

          const isExpanded = expandedCategories.has(categoryConfig.key)

          return (
            <div key={categoryConfig.key} className="space-y-3">
              <div className="flex items-center gap-2 px-4 mb-2">
                <categoryConfig.icon className="w-3.5 h-3.5 text-zinc-600" />
                {categoryConfig.collapsible ? (
                  <button
                    onClick={() => toggleCategory(categoryConfig.key)}
                    className="flex-1 flex items-center justify-between text-[10px] font-bold text-zinc-500 hover:text-emerald uppercase tracking-[0.15em] transition-colors group/cat"
                  >
                    <span>{categoryConfig.label}</span>
                    <ChevronRight className={cn("w-3 h-3 transition-transform text-zinc-600 group-hover/cat:text-emerald", isExpanded && "rotate-90")} />
                  </button>
                ) : (
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">
                    {categoryConfig.label}
                  </div>
                )}
              </div>

              <div className={cn(
                "space-y-1 overflow-hidden transition-all duration-500 ease-in-out",
                !isExpanded ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
              )}>
                {categoryModules.map((module, idx) => (
                  <NavItem
                    key={module.key}
                    icon={module.icon}
                    label={module.displayName}
                    active={currentView === module.key}
                    onClick={() => onViewChange(module.key)}
                    delay={idx * 0.05}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="p-6 relative z-10">
        <div className="glass-card rounded-2xl p-3 border-emerald/5 hover:border-emerald/20 group/profile cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover/profile:text-emerald transition-colors overflow-hidden border border-white/5">
                <UserCircle className="w-6 h-6" />
                <div className="absolute inset-0 bg-emerald/0 group-hover/profile:bg-emerald/5 transition-colors" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald border-2 border-obsidian rounded-full" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-silver truncate group-hover/profile:text-white transition-colors">{clientName}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Admin</span>
                <div className="w-1 h-1 bg-zinc-600 rounded-full" />
                <span className="text-[10px] text-emerald font-bold uppercase tracking-widest">Secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavItem({ icon: Icon, label, active, onClick, delay }: {
  icon: any
  label: string
  active: boolean
  onClick: () => void
  delay: number
}) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}s` }}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group relative overflow-hidden animate-in fade-in slide-in-from-left-4 fill-mode-both",
        active
          ? "bg-emerald text-obsidian shadow-[0_0_20px_oklch(0.75_0.15_160_/_0.2)]"
          : "text-zinc-500 hover:text-white hover:bg-white/5"
      )}
    >
      <Icon className={cn(
        "w-4 h-4 relative z-10 transition-transform duration-500 group-hover:scale-110",
        active ? "text-obsidian" : "text-zinc-600 group-hover:text-emerald"
      )} />
      <span className="relative z-10 font-outfit tracking-wide">{label}</span>

      {active && (
        <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none" />
      )}

      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 bg-emerald transition-transform duration-500",
        active ? "translate-x-0" : "-translate-x-full group-hover:-translate-x-[75%]"
      )} />
    </button>
  )
}
