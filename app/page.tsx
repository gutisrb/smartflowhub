"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { LoginForm } from "@/components/auth/login-form"
import { Sidebar } from "@/components/dashboard/sidebar"
import { useUnifiedModules } from "@/lib/modules/hooks"
import { ModuleKey } from "@/lib/modules/types"
import { Button } from "@/components/ui/button"
import { LogOut, Bell, Search, Sparkles, Menu, Activity, X as XIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { isGroupClient, GROUP_CLIENTS, BOOK_STORE_CLIENTS, getBookStoreConfig } from "@/lib/brand-configs"

// Import module components
import { PipelineModule } from "@/components/modules/pipeline-module"
import { GrowthEngineModule } from "@/components/modules/growth-engine-module"
import { EmailOutreachModule } from "@/components/modules/email-outreach-module"
import { SocialChatbotModule } from "@/components/modules/social-chatbot-module"
import { WebsiteChatbotModule } from "@/components/modules/website-chatbot-module"
import { AgentDatabaseModule } from "@/components/modules/agent-database-module"
import { AgentLeadsModule } from "@/components/modules/agent-leads-module"
import { ChatbotAnalyticsModule } from "@/components/modules/chatbot-analytics-module"
import { CalendarModule } from "@/components/modules/calendar-module"
import { SettingsModule } from "@/components/modules/settings-module"
import { inferNicheKey, NICHE_CONFIGS } from "@/lib/niche-config"

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('pipeline')
  const [clientId, setClientId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [clientName, setClientName] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [demoNiche, setDemoNiche] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // For group clients: selected brand IDs (multi-select). Default = first brand only.
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([])
  // Intervencija notifications
  const [intervencijaToasts, setIntervencijaToasts] = useState<{ id: string; brandName: string; color: string }[]>([])
  const [unreadBellCount, setUnreadBellCount] = useState(0)

  // Primary effective clientId — first selected brand (used by AI Agent, module loading, etc.)
  const effectiveClientId = useMemo(() => {
    if (clientId && isGroupClient(clientId)) {
      const ids = selectedBrandIds.length > 0 ? selectedBrandIds : GROUP_CLIENTS[clientId] ?? []
      return ids[0] ?? null
    }
    return clientId
  }, [clientId, selectedBrandIds])

  const supabase = createClient()
  const { modules: availableModules, loading: isLoading } = useUnifiedModules(effectiveClientId)

  const checkSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setIsAuthenticated(true)
      setUserEmail(session.user.email || null)
      if (session.user.email) {
        const { data } = await supabase
          .from('clients')
          .select('id, name, demo_niche')
          .eq('email', session.user.email)
          .single()

        if (data) {
          setClientId(data.id)
          setClientName(data.name)
          setDemoNiche((data as any).demo_niche ?? null)
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

  // ── Intervencija realtime notifications ──────────────────────────────────
  useEffect(() => {
    if (!clientId || !isAuthenticated) return
    const brandIds = isGroupClient(clientId)
      ? (selectedBrandIds.length > 0 ? selectedBrandIds : (GROUP_CLIENTS[clientId] ?? []))
      : [clientId]

    // Request browser notification permission once
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const channels = brandIds.map(brandId => {
      const config = BOOK_STORE_CLIENTS[brandId]
      if (!config) return null
      return supabase
        .channel(`intervencija_${config.crmTable}_${brandId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: config.crmTable, filter: 'status=eq.Intervencija' },
          () => {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(`Intervencija — ${config.brandName}`, {
                body: 'Kupac čeka vaš odgovor. Otvorite AI Agent.',
                icon: '/favicon.ico',
              })
            }
            setIntervencijaToasts(prev => [
              { id: `${brandId}-${Date.now()}`, brandName: config.brandName, color: config.color ?? '#10b981' },
              ...prev.slice(0, 2),
            ])
            setUnreadBellCount(c => c + 1)
          }
        )
        .subscribe()
    })

    return () => {
      channels.forEach(ch => { if (ch) supabase.removeChannel(ch) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, isAuthenticated, selectedBrandIds.join(',')])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setClientId(null)
    setUserEmail(null)
    setActiveModule('pipeline')
  }

  const terminology = useMemo(() => {
    const isRecruitment =
      effectiveClientId === '7ac02189-d0ec-4532-baa6-d7d4dc84b87c' ||
      effectiveClientId === 'OZ Avala' ||
      clientName?.toLowerCase().includes('mjob')

    if (isRecruitment) {
      return {
        title: "Regrutacija",
        highlight: "Engine",
        entity: "Kandidat",
        entities: "Kandidati",
        group: "Pozicija",
        groups: "Pozicije",
        dbTitle: "Baza Regrutacije",
        dbItem: "Oglas",
        searchPlaceholder: "Pretraži kandidate, pozicije...",
        tableHeaders: ["Profil Kandidata", "Prijavljena Pozicija", "Faza Procesa", "Aktivnost"]
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
  }, [effectiveClientId, clientName])

  const isBookStoreClient = getBookStoreConfig(effectiveClientId) !== null

  // Filter modules for recruitment demo
  const filteredModules = useMemo(() => {
    const isRecruitment = clientName?.toLowerCase().includes('mjob')
    if (isRecruitment) {
      return availableModules.filter(m =>
        ['pipeline', 'business-crm', 'agent-database', 'agent-leads', 'social-chatbot', 'chatbot-analytics'].includes(m.key)
      )
    }
    return availableModules
  }, [availableModules, clientName])

  // Get settings for the active module from DB (no config file needed)
  const getActiveModuleSettings = () => {
    const mod = availableModules.find(m => m.key === activeModule)
    return mod?.settings || {}
  }

  const renderModule = () => {
    if (!effectiveClientId) return (
      <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl animate-in zoom-in duration-700">
        <Sparkles className="w-12 h-12 text-emerald mb-4 animate-pulse" />
        <h2 className="text-xl font-outfit text-silver uppercase tracking-widest">Initialising Growth Engine</h2>
        <p className="text-muted-foreground mt-2">Connecting to your obsidian data nodes...</p>
      </div>
    )

    const settings = getActiveModuleSettings()

    switch (activeModule) {
      case 'pipeline':
        return <PipelineModule clientId={effectiveClientId} />
      case 'growth-engine':
        return <GrowthEngineModule
          clientId={effectiveClientId}
          tableName="kontakti"
          statuses={settings.statuses || ['Novi Lead', 'enriched', 'Kontaktiran', 'Meeting Booked', 'Closed', 'Lost', 'Sent']}
        />
      case 'business-crm':
        if (demoNiche) return <AgentLeadsModule clientId={effectiveClientId} demoMode nicheKey={inferNicheKey(demoNiche)} />
        return <GrowthEngineModule
          clientId={effectiveClientId}
          tableName="kontakti"
          statuses={settings.statuses || ['Novi Lead', 'enriched', 'Kontaktiran', 'Meeting Booked', 'Closed', 'Lost', 'Sent']}
        />
      case 'calendar':
        return <CalendarModule clientId={effectiveClientId} nicheKey={inferNicheKey(demoNiche)} />
      case 'email-outreach':
        return <EmailOutreachModule
          clientId={effectiveClientId}
          tableName="kontakti"
        />
      case 'agent-database': {
        const nicheKey = inferNicheKey(demoNiche)
        const nicheCatalogLabel = demoNiche ? (NICHE_CONFIGS[nicheKey]?.catalogLabel ?? 'Usluge') : 'Usluge'
        return <AgentDatabaseModule
          clientId={effectiveClientId}
          terminology={terminology}
          selectedBrandIds={isBookStoreClient && selectedBrandIds.length > 1 ? selectedBrandIds : undefined}
          demoMode={!!demoNiche && !isBookStoreClient}
          demoLabel={nicheCatalogLabel}
          nicheKey={nicheKey}
        />
      }
      case 'agent-leads':
        return <AgentLeadsModule clientId={effectiveClientId} terminology={terminology} selectedBrandIds={isBookStoreClient && selectedBrandIds.length > 1 ? selectedBrandIds : undefined} />
      case 'social-chatbot':
        return <SocialChatbotModule clientId={effectiveClientId} selectedBrandIds={isBookStoreClient && selectedBrandIds.length > 0 ? selectedBrandIds : undefined} clientName={clientName} nicheKey={demoNiche ? inferNicheKey(demoNiche) : undefined} />
      case 'website-chatbot':
        return <WebsiteChatbotModule clientId={effectiveClientId} />
      case 'chatbot-analytics':
        return <ChatbotAnalyticsModule clientId={effectiveClientId} selectedBrandIds={isBookStoreClient && selectedBrandIds.length > 1 ? selectedBrandIds : undefined} demoNiche={demoNiche} />
      case 'settings':
        return <SettingsModule clientId={effectiveClientId} selectedBrandIds={selectedBrandIds.length > 0 ? selectedBrandIds : undefined} />
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

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {isAuthenticated && (
        <Sidebar
          currentView={activeModule}
          onViewChange={(view) => { setActiveModule(view); setSidebarOpen(false) }}
          clientName={clientName}
          clientId={effectiveClientId}
          modules={filteredModules}
          loading={isLoading}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isGroup={clientId ? isGroupClient(clientId) : false}
          groupBrands={clientId && isGroupClient(clientId)
            ? (GROUP_CLIENTS[clientId] ?? []).map(id => ({ id, config: BOOK_STORE_CLIENTS[id] })).filter(b => b.config)
            : undefined}
          selectedBrandIds={selectedBrandIds.length > 0 ? selectedBrandIds : (clientId && isGroupClient(clientId) ? [GROUP_CLIENTS[clientId]?.[0] ?? ''] : undefined)}
          onBrandSelectionChange={(ids) => setSelectedBrandIds(ids)}
          hideCategories={isBookStoreClient}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden relative z-10 p-2 md:p-4 md:pl-0">
        <div className="flex-1 flex flex-col glass-panel rounded-2xl md:rounded-[2rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/5">
          {/* Header */}
          <header className="h-14 md:h-20 flex items-center justify-between px-4 md:px-10 shrink-0 border-b border-white/5 bg-white/[0.02] gap-3">
            <div className="flex items-center gap-3">
              {/* Hamburger — mobile only */}
              <button
                className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-emerald hover:border-emerald/30 transition-all duration-200 shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Active brand indicator — mobile only, group clients */}
              {clientId && isGroupClient(clientId) && effectiveClientId && BOOK_STORE_CLIENTS[effectiveClientId] && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shrink-0 transition-all duration-200 active:scale-95"
                  style={{
                    backgroundColor: `${BOOK_STORE_CLIENTS[effectiveClientId].color}12`,
                    borderColor: `${BOOK_STORE_CLIENTS[effectiveClientId].color}30`,
                  }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: BOOK_STORE_CLIENTS[effectiveClientId].color, boxShadow: `0 0 6px ${BOOK_STORE_CLIENTS[effectiveClientId].color}80` }} />
                  <span className="text-[10px] font-semibold max-w-[76px] truncate"
                    style={{ color: BOOK_STORE_CLIENTS[effectiveClientId].color }}>
                    {selectedBrandIds.length > 1
                      ? `${selectedBrandIds.length} brenda`
                      : BOOK_STORE_CLIENTS[effectiveClientId].brandName}
                  </span>
                </button>
              )}

              <h1 className="text-base md:text-2xl font-outfit font-light text-silver tracking-tight truncate">
                {getModuleLabel()}
              </h1>
            </div>

            <div className="flex items-center gap-2 md:gap-6">
              <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5 focus-within:border-emerald/30 transition-all duration-300">
                <Search className="w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Universal Search..."
                  className="bg-transparent border-none text-sm text-zinc-300 focus:outline-none w-48 placeholder:text-zinc-600 font-light"
                />
              </div>

              <div className="flex items-center gap-2 md:gap-4">
                <button
                  className="p-2 md:p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-emerald hover:border-emerald/30 transition-all duration-300 relative group"
                  onClick={() => setUnreadBellCount(0)}
                >
                  <Bell className="w-4 h-4 md:w-5 md:h-5" />
                  {unreadBellCount > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[9px] font-black flex items-center justify-center text-white px-1 shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                      {unreadBellCount > 9 ? '9+' : unreadBellCount}
                    </span>
                  ) : (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                  )}
                </button>

                <div className="h-8 w-px bg-white/10 hidden sm:block" />

                <div className="flex items-center gap-2 md:gap-4 group cursor-pointer">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-sm font-medium text-silver group-hover:text-emerald transition-colors">{clientName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="rounded-xl hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition-all duration-300 w-8 h-8 md:w-10 md:h-10"
                  >
                    <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 md:p-10 scrollbar-none custom-scrollbar pb-24 md:pb-32">
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
              ) : effectiveClientId ? (
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out fill-mode-forwards">
                  {renderModule()}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center glass-card p-8 rounded-3xl">
                  <p className="text-zinc-500 italic font-light tracking-wide text-sm text-center">Awaiting secure handshake with client node...</p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile bottom nav */}
          {isAuthenticated && filteredModules.length > 0 && (
            <div className="md:hidden shrink-0 border-t border-white/5 bg-obsidian/80 backdrop-blur-xl">
              <div className="flex overflow-x-auto scrollbar-none px-2 py-2 gap-1">
                {filteredModules.map(mod => {
                  const Icon = mod.icon
                  const isActive = activeModule === mod.key
                  return (
                    <button
                      key={mod.key}
                      onClick={() => { setActiveModule(mod.key); setSidebarOpen(false) }}
                      className={cn(
                        "flex flex-col items-center gap-1 px-3 py-2 rounded-xl shrink-0 transition-all duration-200 min-w-[60px]",
                        isActive
                          ? "bg-emerald text-obsidian"
                          : "text-zinc-500 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[9px] font-bold uppercase tracking-wide leading-none whitespace-nowrap">
                        {mod.displayName.split(' ')[0]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Decorative Blur Orbs */}
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-emerald/10 rounded-full blur-[120px] pointer-events-none animate-glow" />
      <div className="fixed -bottom-24 -right-24 w-96 h-96 bg-emerald/5 rounded-full blur-[100px] pointer-events-none" style={{ animationDelay: '1s' }} />

      {/* ── Intervencija toast stack ──────────────────────────────────────── */}
      <div className="fixed bottom-6 right-4 md:right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {intervencijaToasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0e1116]/95 backdrop-blur-xl shadow-2xl px-4 py-3 min-w-[260px] max-w-[320px] cursor-pointer"
              style={{ borderLeft: `3px solid ${toast.color}` }}
              onClick={() => {
                setActiveModule('social-chatbot')
                setIntervencijaToasts(p => p.filter(t => t.id !== toast.id))
              }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${toast.color}15`, border: `1px solid ${toast.color}25` }}>
                <Activity className="w-4 h-4" style={{ color: toast.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: toast.color }}>Intervencija</p>
                <p className="text-sm font-semibold text-white mt-0.5">{toast.brandName}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Kupac čeka vaš odgovor · tapnite da otvorite</p>
              </div>
              <button
                className="text-zinc-600 hover:text-zinc-300 shrink-0 mt-0.5 p-0.5"
                onClick={e => { e.stopPropagation(); setIntervencijaToasts(p => p.filter(t => t.id !== toast.id)) }}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
