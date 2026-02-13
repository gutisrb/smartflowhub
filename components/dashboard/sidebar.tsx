"use client"

import { cn } from "@/lib/utils"
import { ChevronRight, UserCircle, Database } from "lucide-react"
import { useState, useMemo } from "react"
import { useClientModules } from "@/lib/modules/hooks"
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
}

const CATEGORY_CONFIG: CategoryConfig[] = [
  { key: 'crm', label: 'CRM', collapsible: false },
  { key: 'outreach', label: 'Outreach', collapsible: true },
  { key: 'social', label: 'Social Media', collapsible: true },
  { key: 'analytics', label: 'Analytics', collapsible: false },
  { key: 'settings', label: 'Settings', collapsible: false },
]

export function Sidebar({ currentView, onViewChange, clientName, clientId }: SidebarProps) {
  const { modules, loading } = useClientModules(clientId)
  const [expandedCategories, setExpandedCategories] = useState<Set<ModuleCategory>>(
    new Set(['crm', 'outreach', 'social', 'analytics', 'settings'])
  )

  // Group modules by category
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
      <div className="w-64 border-r bg-white flex flex-col h-screen">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            <Database className="w-6 h-6" />
            <span>SmartFlow</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 bg-zinc-950 flex flex-col h-screen text-zinc-400 border-r border-zinc-800 shadow-xl z-50">
      <div className="p-6 border-b border-zinc-800/50">
        <div className="flex items-center gap-3 font-bold text-xl text-white tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Database className="w-4 h-4 text-white" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            SmartFlow
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-none">
        {CATEGORY_CONFIG.map(categoryConfig => {
          const categoryModules = modulesByCategory.get(categoryConfig.key) || []

          if (categoryModules.length === 0) return null

          const isExpanded = expandedCategories.has(categoryConfig.key)

          return (
            <div key={categoryConfig.key} className="space-y-2">
              {categoryConfig.collapsible ? (
                <button
                  onClick={() => toggleCategory(categoryConfig.key)}
                  className="w-full flex items-center justify-between px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors mb-2 group"
                >
                  <span className="group-hover:translate-x-0.5 transition-transform">{categoryConfig.label}</span>
                  <ChevronRight className={cn("w-3 h-3 transition-transform opacity-50 group-hover:opacity-100", isExpanded && "rotate-90")} />
                </button>
              ) : (
                <div className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  {categoryConfig.label}
                </div>
              )}

              <div className={cn(
                "space-y-1 transition-all duration-300 ease-in-out origin-top",
                !isExpanded && "h-0 opacity-0 overflow-hidden",
                isExpanded && "h-auto opacity-100"
              )}>
                {categoryModules.map(module => (
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
      </nav>

      <div className="p-4 border-t border-zinc-800/50 bg-zinc-950/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-900/50 transition-colors cursor-pointer group">
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-zinc-700 transition-colors">
            <UserCircle className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{clientName}</span>
            <span className="text-xs text-zinc-500 group-hover:text-zinc-400">Administrator</span>
          </div>
        </div>
      </div>
    </div>
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
        "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group relative overflow-hidden",
        active
          ? "bg-white/10 text-white shadow-sm"
          : "text-zinc-400 hover:text-white hover:bg-white/5"
      )}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 bg-indigo-500 rounded-r-full" />
      )}
      <Icon className={cn(
        "w-4 h-4 transition-colors",
        active ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"
      )} />
      <span className="relative z-10">{label}</span>
    </button>
  )
}
