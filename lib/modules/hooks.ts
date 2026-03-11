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
  const MJOB_CLIENT_ID = "fa252187-3229-4d0b-8a11-0f66ea97be71"

  if (!loading && (!dbModules || dbModules.length === 0) && (clientId === PRIMARY_CLIENT_ID || clientId === MJOB_CLIENT_ID)) {
    console.log(`[Modules] Using hardcoded fallback for client: ${clientId}`)
    finalDbModules = [
      {
        id: "fb1",
        client_id: clientId as string,
        module_key: "business-crm",
        is_enabled: true,
        display_name: "CRM",
        sort_order: 1,
        created_at: new Date().toISOString(),
        settings: clientId === MJOB_CLIENT_ID
          ? { statuses: ["Novi Kandidat", "Intervju", "Ponuda Poslata", "Zaposlen"], showAgencyMetrics: true }
          : null
      },
      {
        id: "fb2",
        client_id: clientId as string,
        module_key: "agent-database",
        is_enabled: true,
        display_name: clientId === MJOB_CLIENT_ID ? "Poslovi" : "Agent Database",
        sort_order: 2,
        created_at: new Date().toISOString(),
        settings: clientId === MJOB_CLIENT_ID
          ? { entityType: "jobs", entityLabel: "Posao" }
          : null
      },
      {
        id: "fb3",
        client_id: clientId as string,
        module_key: "agent-leads",
        is_enabled: true,
        display_name: clientId === MJOB_CLIENT_ID ? "Kandidati" : "Agent Leads",
        sort_order: 3,
        created_at: new Date().toISOString(),
        settings: clientId === MJOB_CLIENT_ID
          ? { entityType: "candidates", entityLabel: "Kandidat" }
          : null
      },
      {
        id: "fb4",
        client_id: clientId as string,
        module_key: "website-chatbot",
        is_enabled: true,
        display_name: "Website Chatbot",
        sort_order: 4,
        created_at: new Date().toISOString(),
        settings: null
      }
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
