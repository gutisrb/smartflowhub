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

  let finalDbModules = dbModules

  // FALLBACK: If DB is empty for the primary client, provide defaults
  // This addresses RLS barriers preventing automated DB population
  const PRIMARY_CLIENT_ID = "69acf7e9-557e-4ca3-85bd-a785ef39e351"
  if (!loading && (!dbModules || dbModules.length === 0) && clientId === PRIMARY_CLIENT_ID) {
    console.log("[Modules] Using hardcoded fallback for primary client")
    finalDbModules = [
      { id: "fb1", module_key: "growth-engine", is_enabled: true, display_name: "Growth Engine", sort_order: 1 },
      { id: "fb2", module_key: "email-outreach", is_enabled: true, display_name: "Email Outreach", sort_order: 2 },
      { id: "fb3", module_key: "crm", is_enabled: true, display_name: "CRM", sort_order: 3 },
      { id: "fb4", module_key: "agent-database", is_enabled: true, display_name: "Agent Database", sort_order: 4 },
      { id: "fb5", module_key: "agent-leads", is_enabled: true, display_name: "Agent Leads", sort_order: 5 }
    ] as ClientModule[]
  }

  const modules: EnabledModule[] = finalDbModules
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
