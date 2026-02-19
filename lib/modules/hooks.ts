import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { EnabledModule, ClientModule, ModuleKey } from "./types"
import { MODULE_REGISTRY } from "./registry"
import { useMemo } from "react"

export function useClientModules(clientId: string | null) {
  const [modules, setModules] = useState<EnabledModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!clientId) {
      setModules([])
      setLoading(false)
      return
    }

    async function fetchModules() {
      try {
        setLoading(true)
        const supabase = createClient()

        const { data, error: fetchError } = await supabase
          .from('client_modules')
          .select('*')
          .eq('client_id', clientId)
          .eq('is_enabled', true)
          .order('sort_order', { ascending: true, nullsFirst: false })

        if (fetchError) throw fetchError

        // Map database records to EnabledModule objects
        const enabledModules: EnabledModule[] = (data || [])
          .map((cm: ClientModule) => {
            const definition = MODULE_REGISTRY[cm.module_key]
            if (!definition) return null

            return {
              ...definition,
              clientModuleId: cm.id,
              displayName: cm.display_name || definition.label,
              settings: cm.settings,
              sortOrder: cm.sort_order || 0,
            }
          })
          .filter(Boolean) as EnabledModule[]

        setModules(enabledModules)
        setError(null)
      } catch (err) {
        console.error('Error fetching client modules:', err)
        setError(err as Error)
        setModules([])
      } finally {
        setLoading(false)
      }
    }

    fetchModules()
  }, [clientId])

  return { modules, loading, error }
}

export function useUnifiedModules(clientId: string | null) {
  const { modules, loading, error } = useClientModules(clientId)

  const unifiedModules = useMemo(() => {
    if (loading || !modules.length) return []

    // Check if Business CRM exists (it should for standard clients)
    const hasCrm = modules.some(m => m.key === 'business-crm')

    // If no CRM, just return modules as is (or handle as needed)
    if (!hasCrm) return modules

    // Filter out individual CRM/Outreach modules
    const filtered = modules.filter(m => m.key !== 'business-crm' && m.key !== 'email-outreach')

    // Create the unified Growth Engine module
    const growthEngineModule: EnabledModule = {
      ...MODULE_REGISTRY['growth-engine'],
      clientModuleId: 'unified-growth-engine',
      displayName: 'Overview & Pipeline', // This label matches the user's sidebar
      settings: null,
      sortOrder: 0 // Always first
    } as EnabledModule

    // HARDCODE FORCE RESTORE FOR OZ AVALA
    if (clientId === '7ac02189-d0ec-4532-baa6-d7d4dc84b87c') {
      const forcedModules: EnabledModule[] = [
        // SEPARATE MODULES AS REQUESTED
        { ...MODULE_REGISTRY['email-outreach'], clientModuleId: 'force-email', displayName: 'Email Outreach', settings: null, sortOrder: 0 } as EnabledModule,
        { ...MODULE_REGISTRY['business-crm'], clientModuleId: 'force-crm', displayName: 'Business CRM', settings: { tableName: 'kontakti', showAgencyMetrics: false }, sortOrder: 1 }, // status defaults handled in component

        { ...MODULE_REGISTRY['linkedin-agent'], clientModuleId: 'force-linkedin', displayName: 'LinkedIn Agent', settings: null, sortOrder: 2 } as EnabledModule,
        { ...MODULE_REGISTRY['website-chatbot'], clientModuleId: 'force-web-bot', displayName: 'Website Chatbot', settings: null, sortOrder: 3 } as EnabledModule,
        { ...MODULE_REGISTRY['social-chatbot'], clientModuleId: 'force-soc-bot', displayName: 'Social Chatbot', settings: null, sortOrder: 4 } as EnabledModule,
        { ...MODULE_REGISTRY['candidates'], clientModuleId: 'force-omladinci', displayName: 'Omladinci', settings: null, sortOrder: 5 } as EnabledModule,
        { ...MODULE_REGISTRY['job-postings'], clientModuleId: 'force-poslovi', displayName: 'Poslovi', settings: null, sortOrder: 6 } as EnabledModule,
      ]
      return forcedModules
    }

    return [growthEngineModule, ...filtered]
  }, [modules, loading, clientId])

  return { modules: unifiedModules, loading, error }
}

export function useModulesByCategory(clientId: string | null, category: string) {
  const { modules, loading, error } = useClientModules(clientId)

  const filteredModules = modules.filter(m => m.category === category)

  return { modules: filteredModules, loading, error }
}
