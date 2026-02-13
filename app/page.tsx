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
import { LinkedInAgentModule } from "@/components/modules/linkedin-agent-module"
import { JobPostingsModule } from "@/components/modules/job-postings-module"
import { CandidatesModule } from "@/components/modules/candidates-module"
import { SocialChatbotModule } from "@/components/modules/social-chatbot-module"
import { WebsiteChatbotModule } from "@/components/modules/website-chatbot-module"

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('business-crm') // Default
  const [clientId, setClientId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [clientName, setClientName] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const supabase = createClient()
  const { modules: availableModules, loading: isLoading } = useClientModules(clientId)

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
          setClientId(data.id)
          setClientName(data.name)
        }
      }
    }
  }, [supabase])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Update active module when available modules change (to ensure access)
  useEffect(() => {
    if (!isLoading && availableModules.length > 0) {
      if (!availableModules.some(m => m.key === activeModule)) {
        setActiveModule(availableModules[0].key)
      }
    }
  }, [availableModules, isLoading, activeModule])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setClientId(null)
    setUserEmail(null)
    setActiveModule('business-crm') // Reset to default
  }

  // Render the correct module
  const renderModule = () => {
    if (!clientId) return <div className="p-8 text-center text-gray-500">Loading client data...</div>

    switch (activeModule) {
      case 'business-crm':
        return <BusinessCRMModule clientId={clientId} />
      case 'email-outreach':
        return <EmailOutreachModule clientId={clientId} />
      case 'linkedin-agent':
        return <LinkedInAgentModule clientId={clientId} />
      case 'job-postings':
        return <JobPostingsModule clientId={clientId} />
      case 'candidates':
        return <CandidatesModule clientId={clientId} />
      case 'social-chatbot':
        return <SocialChatbotModule clientId={clientId} />
      case 'website-chatbot':
        return <WebsiteChatbotModule clientId={clientId} />
      default:
        return <div className="p-8 text-center">Module not found</div>
    }
  }

  const getModuleLabel = () => {
    if (!activeModule) return "Dashboard"
    const module = availableModules.find(m => m.key === activeModule)
    return module?.displayName || "Dashboard"
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={checkSession} />
  }

  return (
    <div className="flex h-screen bg-zinc-50">
      {isAuthenticated && (
        <Sidebar
          currentView={activeModule}
          onViewChange={setActiveModule}
          clientName={clientName}
          clientId={clientId}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-zinc-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-zinc-800 uppercase tracking-widest">
              {getModuleLabel()}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500 font-medium">{userEmail}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-colors">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
          <div className="max-w-7xl mx-auto space-y-6">
            {isLoading ? (
              <div className="flex h-full items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-zinc-400 text-sm uppercase tracking-wider">Loading modules...</p>
                </div>
              </div>
            ) : clientId ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {renderModule()}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-zinc-400 italic">Connecting to client...</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
