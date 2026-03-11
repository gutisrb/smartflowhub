"use client"

import { useState, useEffect } from "react"
import { getClientModules } from "@/lib/supabase/queries"
import { MODULE_REGISTRY } from "./registry"
import { ClientModule, EnabledModule, ModuleKey } from "./types"

// Fetch enabled modules from DB for a specific client
export function useClientModules(clientId: string | null) {
  const [modules, setModules] = useState<ClientModule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) {
      setModules([])
      setLoading(false)
      return
    }

    const fetchModules = async () => {
      setLoading(true)
      const data = await getClientModules(clientId)
      setModules(data as ClientModule[])
      setLoading(false)
    }

    fetchModules()
  }, [clientId])

  return { modules, loading }
}

// Convert DB records to UI-ready EnabledModules with registry metadata
export function useUnifiedModules(clientId: string | null) {
  const { modules: dbModules, loading } = useClientModules(clientId)

  const modules: EnabledModule[] = dbModules
    .filter(m => m.is_enabled)
    .map(dbModule => {
      const registryDef = MODULE_REGISTRY[dbModule.module_key as ModuleKey]
      if (!registryDef) return null

      return {
        ...registryDef,
        clientModuleId: dbModule.id,
        displayName: dbModule.display_name || registryDef.label,
        settings: dbModule.settings,
        sortOrder: dbModule.sort_order ?? 99,
      } as EnabledModule
    })
    .filter(Boolean) as EnabledModule[]

  // Sort by sort_order
  modules.sort((a, b) => a.sortOrder - b.sortOrder)

  return { modules, loading }
}
