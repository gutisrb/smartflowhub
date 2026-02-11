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
    <div className="w-64 border-r bg-white flex flex-col h-screen">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2 font-bold text-xl text-primary">
          <Database className="w-6 h-6" />
          <span>SmartFlow</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {CATEGORY_CONFIG.map(categoryConfig => {
          const categoryModules = modulesByCategory.get(categoryConfig.key) || []

          if (categoryModules.length === 0) return null

          const isExpanded = expandedCategories.has(categoryConfig.key)

          return (
            <div key={categoryConfig.key} className="space-y-1">
              {categoryConfig.collapsible ? (
                <button
                  onClick={() => toggleCategory(categoryConfig.key)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-gray-500 hover:text-gray-900 uppercase tracking-wide"
                >
                  <span>{categoryConfig.label}</span>
                  <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
                </button>
              ) : (
                <div className="px-3 py-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  {categoryConfig.label}
                </div>
              )}

              {(!categoryConfig.collapsible || isExpanded) && (
                <div className={cn("space-y-1", categoryConfig.collapsible && "ml-2")}>
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
              )}
            </div>
          )
        })}
      </nav>

      <div className="p-4 border-t bg-gray-50/50">
        <div className="flex items-center gap-3 px-3 py-2">
          <UserCircle className="w-8 h-8 text-gray-400" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">{clientName}</span>
            <span className="text-xs text-gray-500 truncate">Administrator</span>
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
        "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}
