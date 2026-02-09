
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { StatsGrid } from "@/components/dashboard/stats-grid"
import { LeadsTable } from "@/components/dashboard/leads-table"
import { ChatLogViewer } from "@/components/dashboard/chat-log-viewer"
import { LoginForm } from "@/components/auth/login-form"
import { JobsCRM } from "@/components/dashboard/jobs-crm"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getLeadsByClientId } from "@/lib/supabase/queries"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export default function DashboardPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [clientName, setClientName] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [stats, setStats] = useState({
    totalLeads: 0,
    poslatePrijave: 0,
    zaposleni: 0,
    prosekPrijava: 0,
  })

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Use the singleton client
  const supabase = createClient()

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setIsAuthenticated(true)
      setUserEmail(session.user.email || null)
      if (session.user.email) {
        fetchClientByEmail(session.user.email)
      }
    }
  }

  const fetchClientByEmail = async (email: string) => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('email', email)
      .single()

    if (data) {
      setSelectedClientId(data.id)
      setClientName(data.name)
    } else {
      console.warn("No client profile found for this email.")
    }
  }

  useEffect(() => {
    if (selectedClientId) {
      fetchLeads(selectedClientId)
      const unsubscribe = subscribeToLeads(selectedClientId)
      return () => {
        unsubscribe()
      }
    }
  }, [selectedClientId])

  const fetchLeads = async (clientId: string) => {
    const data = await getLeadsByClientId(clientId)
    setLeads(data || [])
    calculateStats(data || [])
  }

  const subscribeToLeads = (clientId: string) => {
    const channel = supabase
      .channel("kontakti-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kontakti", filter: `client_id=eq.${clientId}` },
        (payload: any) => {
          fetchLeads(clientId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const calculateStats = (data: any[]) => {
    const total = data.length
    const poslate = data.filter((l) => l.status === "Prijavljen").length
    const zaposleni = data.filter((l) => l.status === "Zaposlen").length
    const prosek = total - poslate

    setStats({
      totalLeads: total,
      poslatePrijave: poslate,
      zaposleni: zaposleni,
      prosekPrijava: prosek,
    })
  }

  const handleOpenChat = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (lead?.id_razgovora) {
      setSelectedChatId(lead.id_razgovora)
      setIsChatOpen(true)
    } else {
      alert("Ovaj lead nema ID razgovora.")
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setSelectedClientId(null)
    setLeads([])
    setUserEmail(null)
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={checkSession} />
  }

  return (
    <div className="flex-1 min-h-screen bg-gray-50/50">
      <div className="p-8 pt-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
            <p className="text-muted-foreground">Dobrodošli nazad, {clientName || "Klijent"}.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>

        {selectedClientId ? (
          <>
            <StatsGrid stats={stats} />

            <Tabs defaultValue="poslovi" className="space-y-6">
              <TabsList className="bg-white p-1 shadow-sm border">
                <TabsTrigger value="poslovi" className="data-[state=active]:bg-gray-100">Poslovi</TabsTrigger>
                <TabsTrigger value="all" className="data-[state=active]:bg-gray-100">Svi Leadovi</TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-gray-100">Analitika</TabsTrigger>
              </TabsList>

              <TabsContent value="poslovi" className="space-y-4">
                <JobsCRM clientId={selectedClientId} />
              </TabsContent>

              <TabsContent value="all" className="space-y-4">
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold">Pregled Leadova</h3>
                  </div>
                  <div className="p-0">
                    <LeadsTable leads={leads} onOpenChat={handleOpenChat} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <div className="h-[400px] flex items-center justify-center rounded-xl border bg-white shadow-sm">
                  <p className="text-muted-foreground">Analitika uskoro.</p>
                </div>
              </TabsContent>
            </Tabs>

            <ChatLogViewer
              idRazgovora={selectedChatId}
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
            />
          </>
        ) : (
          <div className="flex h-[400px] items-center justify-center rounded-xl border-2 border-dashed bg-white">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold mb-2">Profil nije povezan</h3>
              <p className="text-sm text-muted-foreground">
                Vaš nalog nije povezan sa klijentskim profilom. Kontaktirajte administratora da poveže vaš email ({userEmail || "loading..."}) sa klijentom.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
