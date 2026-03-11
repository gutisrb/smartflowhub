"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { LoginForm } from "@/components/auth/login-form"
import { Sidebar } from "@/components/dashboard/sidebar"
import { useUnifiedModules } from "@/lib/modules/hooks"
import { ModuleKey } from "@/lib/modules/types"
import { Button } from "@/components/ui/button"
import { LogOut, Bell, Search, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

// Import module components
import { GrowthEngineModule } from "@/components/modules/growth-engine-module"
import { EmailOutreachModule } from "@/components/modules/email-outreach-module"
import { LinkedInAgentModule } from "@/components/modules/linkedin-agent-module"
import { SocialChatbotModule } from "@/components/modules/social-chatbot-module"
import { WebsiteChatbotModule } from "@/components/modules/website-chatbot-module"
import { AgentDatabaseModule } from "@/components/modules/agent-database-module"
import { AgentLeadsModule } from "@/components/modules/agent-leads-module"

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('business-crm')
  const [clientId, setClientId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [clientName, setClientName] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const supabase = createClient()
  const { modules: availableModules, loading: isLoading } = useUnifiedModules(clientId)

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

  // Ensure active module is in available set
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
    setActiveModule('business-crm')
  }

  // Niche-aware terminology centralized for all modules
  const terminology = useMemo(() => {
    const isAvala = clientId === '7ac02189-d0ec-4532-baa6-d7d4dc84b87c' || clientId === 'OZ Avala'

    if (isAvala) {
      return {
        title: "Recruitment",
        highlight: "Engine",
        entity: "Candidate",
        entities: "Candidates",
        group: "Position",
        groups: "Positions",
        dbTitle: "Recruitment Database",
        dbItem: "Opportunity",
        searchPlaceholder: "Search candidates, roles...",
        tableHeaders: ["Candidate Profile", "Applied Position", "Lifecycle Phase", "Activity"]
      }
    }

    return {
      title: "Growth",
      highlight: "Engine",
      entity: "Lead",
      entities: "Leads",
      group: "Company",
      groups: "Companies",
      dbTitle: "Agent Knowledge",
      dbItem: "Context Node",
      searchPlaceholder: "Search trajectories, names...",
      tableHeaders: ["Identity Profile", "Comms Node", "Vector Status", "Activity"]
    }
  }, [clientId])

  // Get settings for the active module from DB (no config file needed)
  const getActiveModuleSettings = () => {
    const mod = availableModules.find(m => m.key === activeModule)
    return mod?.settings || {}
  }

  const renderModule = () => {
    if (!clientId) return (
      <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl animate-in zoom-in duration-700">
        <Sparkles className="w-12 h-12 text-emerald mb-4 animate-pulse" />
        <h2 className="text-xl font-outfit text-silver uppercase tracking-widest">Initialising Growth Engine</h2>
        <p className="text-muted-foreground mt-2">Connecting to your obsidian data nodes...</p>
      </div>
    )

    const settings = getActiveModuleSettings()

    switch (activeModule) {
      case 'growth-engine':
      case 'business-crm':
        return <GrowthEngineModule
          clientId={clientId}
          tableName="kontakti"
          statuses={settings.statuses || ['Novi Lead', 'Kontaktiran', 'Meeting Booked', 'Closed', 'Lost']}
        />
      case 'email-outreach':
        return <EmailOutreachModule
          clientId={clientId}
          tableName="kontakti"
        />
      case 'linkedin-agent':
        return <LinkedInAgentModule clientId={clientId} />
      case 'agent-database':
        return <AgentDatabaseModule clientId={clientId} terminology={terminology} />
      case 'agent-leads':
        return <AgentLeadsModule clientId={clientId} terminology={terminology} />
      case 'social-chatbot':
        return <SocialChatbotModule clientId={clientId} />
      case 'website-chatbot':
        return <WebsiteChatbotModule clientId={clientId} />
      default:
        return <div className="p-8 text-center glass-card rounded-2xl">Module node offline or restricted</div>
    }
  }

  const getModuleLabel = () => {
    if (!activeModule) return "Command Center"
    const module = availableModules.find(m => m.key === activeModule)
    return module?.displayName || "Command Center"
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={checkSession} />
  }

  return (
    <div className="flex h-screen bg-mesh overflow-hidden font-sans">
      <div className="absolute inset-0 bg-obsidian/40 backdrop-blur-[2px] pointer-events-none" />

      {isAuthenticated && (
        <Sidebar
          currentView={activeModule}
          onViewChange={setActiveModule}
          clientName={clientName}
          clientId={clientId}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden relative z-10 p-4 pl-0">
        <div className="flex-1 flex flex-col glass-panel rounded-[2rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/5">
          <header className="h-20 flex items-center justify-between px-10 shrink-0 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-emerald uppercase tracking-[0.3em] mb-1">Lead Acq System</span>
                <h1 className="text-2xl font-outfit font-light text-silver tracking-tight">
                  {getModuleLabel()}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5 focus-within:border-emerald/30 transition-all duration-300">
                <Search className="w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Universal Search..."
                  className="bg-transparent border-none text-sm text-zinc-300 focus:outline-none w-48 placeholder:text-zinc-600 font-light"
                />
              </div>

              <div className="flex items-center gap-4">
                <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-emerald hover:border-emerald/30 transition-all duration-300 relative group">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-emerald rounded-full shadow-[0_0_10px_oklch(0.75_0.15_160)]" />
                </button>

                <div className="h-8 w-px bg-white/10 hidden sm:block" />

                <div className="flex items-center gap-4 group cursor-pointer">
                  <div className="flex flex-col items-end hidden sm:flex">
                    <span className="text-sm font-medium text-silver group-hover:text-emerald transition-colors">{clientName}</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Node Primary</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="rounded-xl hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition-all duration-300"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-10 scrollbar-none custom-scrollbar pb-32">
            <div className="max-w-[1600px] mx-auto">
              {isLoading ? (
                <div className="flex h-[60vh] items-center justify-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <div className="w-16 h-16 border-2 border-emerald/20 rounded-full" />
                      <div className="w-16 h-16 border-t-2 border-emerald rounded-full animate-spin absolute top-0 left-0" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-emerald rounded-full animate-ping" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <p className="text-silver font-outfit text-lg tracking-widest uppercase animate-pulse">Synchronizing</p>
                      <p className="text-zinc-500 text-xs mt-1">Accessing encrypted lead nodes...</p>
                    </div>
                  </div>
                </div>
              ) : clientId ? (
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out fill-mode-forwards">
                  {renderModule()}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center glass-card p-12 rounded-3xl">
                  <p className="text-zinc-500 italic font-light tracking-wide">Awaiting secure handshake with client node...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Decorative Blur Orbs */}
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-emerald/10 rounded-full blur-[120px] pointer-events-none animate-glow" />
      <div className="fixed -bottom-24 -right-24 w-96 h-96 bg-emerald/5 rounded-full blur-[100px] pointer-events-none" style={{ animationDelay: '1s' }} />
    </div>
  )
}
