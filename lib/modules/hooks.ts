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
  const OZ_AVALA_FB_ID = "7ac02189-d0ec-4532-baa6-d7d4dc84b87c"

  if (!loading && (!dbModules || dbModules.length === 0) && (clientId === PRIMARY_CLIENT_ID || clientId === MJOB_CLIENT_ID || clientId === OZ_AVALA_FB_ID)) {
    const isMjobRecruitment = clientId === MJOB_CLIENT_ID || clientId === OZ_AVALA_FB_ID
    finalDbModules = [
      ...(isMjobRecruitment ? [
        {
          id: "fb1",
          client_id: clientId as string,
          module_key: "business-crm",
          is_enabled: true,
          display_name: "Selekcija",
          sort_order: 1,
          created_at: new Date().toISOString(),
          settings: { statuses: ["Novi", "Prijavljen", "Intervju", "Zaposlen", "Intervencija"], showAgencyMetrics: true }
        }
      ] : [
        {
          id: "fb1",
          client_id: clientId as string,
          module_key: "pipeline",
          is_enabled: true,
          display_name: "Pipeline",
          sort_order: 1,
          created_at: new Date().toISOString(),
          settings: null
        }
      ]),
      {
        id: "fb2",
        client_id: clientId as string,
        module_key: "agent-database",
        is_enabled: true,
        display_name: isMjobRecruitment ? "Oglasi / Pozicije" : "Agent Database",
        sort_order: isMjobRecruitment ? 2 : 99,
        created_at: new Date().toISOString(),
        settings: isMjobRecruitment
          ? { entityType: "jobs", entityLabel: "Pozicija" }
          : null
      },
      {
        id: "fb3",
        client_id: clientId as string,
        module_key: "agent-leads",
        is_enabled: true,
        display_name: isMjobRecruitment ? "Kandidati" : "Agent Leads",
        sort_order: isMjobRecruitment ? 3 : 99,
        created_at: new Date().toISOString(),
        settings: isMjobRecruitment
          ? { entityType: "candidates", entityLabel: "Kandidat" }
          : null
      },
      {
        id: "fb4",
        client_id: clientId as string,
        module_key: "social-chatbot",
        is_enabled: true,
        display_name: "AI Agent",
        sort_order: isMjobRecruitment ? 4 : 4,
        created_at: new Date().toISOString(),
        settings: null
      },
      ...(!isMjobRecruitment ? [
        {
          id: "fb5",
          client_id: clientId as string,
          module_key: "email-outreach",
          is_enabled: true,
          display_name: "Email Outreach",
          sort_order: 3,
          created_at: new Date().toISOString(),
          settings: null
        },
        {
          id: "fb6",
          client_id: clientId as string,
          module_key: "website-chatbot",
          is_enabled: true,
          display_name: "Website Chatbot",
          sort_order: 5,
          created_at: new Date().toISOString(),
          settings: null
        }
      ] : [])
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

  // For mjob: inject chatbot-analytics after social-chatbot if present and not already there
  if (clientId === MJOB_CLIENT_ID || clientId === OZ_AVALA_FB_ID) {
    const hasChatbot = modules.some(m => m.key === "social-chatbot")
    const hasAnalytics = modules.some(m => m.key === "chatbot-analytics")
    if (hasChatbot && !hasAnalytics) {
      const chatbotIndex = modules.findIndex(m => m.key === "social-chatbot")
      const analyticsDef = MODULE_REGISTRY["chatbot-analytics"]
      if (analyticsDef) {
        modules.splice(chatbotIndex + 1, 0, {
          ...analyticsDef,
          clientModuleId: "injected-chatbot-analytics",
          displayName: "Analitika",
          settings: null,
          sortOrder: modules[chatbotIndex].sortOrder + 1,
        } as EnabledModule)
      }
    }
  }

  return { modules, loading }
}
