"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { LoginForm } from "@/components/auth/login-form"
import { Sidebar } from "@/components/dashboard/sidebar"
import { useClientModules } from "@/lib/modules/hooks"
import { ModuleKey } from "@/lib/modules/types"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

// Import all module components
import { BusinessCRMModule } from "@/components/modules/business-crm-module"
import { EmailOutreachModule } from "@/components/modules/email-outreach-module"
import { AnalyticsModule } from "@/components/modules/analytics-module"
import { SettingsModule } from "@/components/modules/settings-module"
import { SocialJobsModule } from "@/components/modules/social-jobs-module"
import { SocialCandidatesModule } from "@/components/modules/social-candidates-module"
import { LinkedInAgentModule } from "@/components/modules/linkedin-agent-module"
import { WebsiteChatbotModule } from "@/components/modules/website-chatbot-module"

export default function DashboardPage() {
  const [currentView, setCurrentView] = useState<ModuleKey | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [clientName, setClientName] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const supabase = createClient()
  const { modules, loading: modulesLoading } = useClientModules(selectedClientId)

  const checkSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setIsAuthenticated(true)
      setUserEmail(session.user.email || null)
      if (session.user.email) {
        const { data } = await supabase
          .from('clients')
          .select('id, name')
          .eq('email', session.user.email)
          .single()

        if (data) {
          setSelectedClientId(data.id)
          setClientName(data.name)
        }
      }
    }
  }, [supabase])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Set default view to first available module
  useEffect(() => {
    if (modules.length > 0 && !currentView) {
      // Prefer business-crm as default, otherwise use first module
      const defaultModule = modules.find(m => m.key === 'business-crm') || modules[0]
      setCurrentView(defaultModule.key)
    }
  }, [modules, currentView])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setSelectedClientId(null)
    setUserEmail(null)
    setCurrentView(null)
  }

  const renderModule = () => {
    if (!selectedClientId) return null
    if (!currentView) return null

    // Module routing
    switch (currentView) {
      case 'business-crm':
        return <BusinessCRMModule clientId={selectedClientId} />
      case 'email-outreach':
        return <EmailOutreachModule clientId={selectedClientId} />
      case 'analytics':
        return <AnalyticsModule clientId={selectedClientId} />
      case 'settings':
        return <SettingsModule clientId={selectedClientId} />
      case 'social-jobs':
        return <SocialJobsModule clientId={selectedClientId} />
      case 'social-candidates':
        return <SocialCandidatesModule clientId={selectedClientId} />
      case 'linkedin-agent':
        return <LinkedInAgentModule clientId={selectedClientId} />
      case 'website-chatbot':
        return <WebsiteChatbotModule clientId={selectedClientId} />
      default:
        return (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Module not found</p>
          </div>
        )
    }
  }

  const getModuleLabel = () => {
    if (!currentView) return "Dashboard"
    const module = modules.find(m => m.key === currentView)
    return module?.displayName || "Dashboard"
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={checkSession} />
  }

  return (
    <div className="flex h-screen bg-gray-50/50">
      {currentView && (
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          clientName={clientName}
          clientId={selectedClientId}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900 uppercase tracking-wider">
              {getModuleLabel()}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{userEmail}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-red-600">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {modulesLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">Loading modules...</p>
              </div>
            ) : selectedClientId ? (
              renderModule()
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground italic">Connecting to client...</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
