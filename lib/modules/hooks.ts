import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { MODULE_REGISTRY } from "./registry"
import { EnabledModule, ClientModule, ModuleKey } from "./types"

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
              displayName: cm.display_name || definition.defaultLabel,
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

export function useModulesByCategory(clientId: string | null, category: string) {
  const { modules, loading, error } = useClientModules(clientId)

  const filteredModules = modules.filter(m => m.category === category)

  return { modules: filteredModules, loading, error }
}
