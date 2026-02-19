"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Users, Briefcase, CheckCircle2, MoreHorizontal, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"

interface MultiTenantCRMModuleProps {
    clientId: string
    tableName: string
    statuses: string[]
    showAgencyMetrics: boolean
}

export function MultiTenantCRMModule({ clientId, tableName, statuses, showAgencyMetrics }: MultiTenantCRMModuleProps) {
    const [leads, setLeads] = useState<any[]>([])
    const [selectedLead, setSelectedLead] = useState<any | null>(null)
    const [isIntelligenceOpen, setIsIntelligenceOpen] = useState(false)
    const [stats, setStats] = useState({
        totalCandidates: 0,
        interviewsScheduled: 0,
        hired: 0,
    })

    const supabase = createClient()

    // MOCK DATA for Pitch
    const MOCK_CRM_DATA = [
        { id: 'm1', ime: 'Ana Popović', kompanija: 'Nordeus', email: 'ana.p@nordeus.com', telefon: '+381601234567', status: 'Intervju Zakazan', prioritet_skor: 85, estimated_value: '€2.5k', created_at: new Date().toISOString() },
        { id: 'm2', ime: 'Marko Ilić', kompanija: 'Seven Bridges', email: 'marko.ilic@sbgenomics.com', telefon: '+381619876543', status: 'Kontaktiran', prioritet_skor: 60, estimated_value: '€1.8k', created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 'm3', ime: 'Jovana Krstić', kompanija: 'Microsoft MDCS', email: 'jovana.k@microsoft.com', telefon: '+38163555666', status: 'Novi Lead', prioritet_skor: 45, estimated_value: '€3.0k', created_at: new Date(Date.now() - 172800000).toISOString() },
        { id: 'm4', ime: 'Petar Petrović', kompanija: 'FishingBooker', email: 'petar@fishingbooker.com', telefon: '+38164111222', status: 'Closed', prioritet_skor: 95, estimated_value: '€4.2k', created_at: new Date(Date.now() - 259200000).toISOString() },
        { id: 'm5', ime: 'Milica Jovanović', kompanija: 'Vega IT', email: 'milica.j@vegait.rs', telefon: '+38165333444', status: 'Meeting Booked', prioritet_skor: 75, estimated_value: '€2.0k', created_at: new Date(Date.now() - 345600000).toISOString() },
    ]

    const calculateStats = useCallback((data: any[]) => {
        const total = data.length
        if (total === 0) {
            setStats({ totalCandidates: 0, interviewsScheduled: 0, hired: 0 })
            return
        }

        const interviews = data.filter(l =>
            l.status?.toLowerCase().includes('intervju') ||
            l.status?.toLowerCase().includes('zakazan') ||
            l.status?.toLowerCase().includes('demo') ||
            l.status?.toLowerCase().includes('scheduled') ||
            l.status?.toLowerCase().includes('booking') ||
            l.status === 'Meeting Booked'
        ).length

        const hired = data.filter(l =>
            l.status?.toLowerCase().includes('zaposlen') ||
            l.status?.toLowerCase().includes('closed') ||
            l.status?.toLowerCase().includes('won')
        ).length

        setStats({
            totalCandidates: total,
            interviewsScheduled: interviews,
            hired,
        })
    }, [])

    const fetchLeads = useCallback(async () => {
        // Use Mock Data if client is OZ Avala and we want to force populate for pitch
        // Or adding a prop would be cleaner, but hardcoding for the specific fix requested:
        if (clientId === '7ac02189-d0ec-4532-baa6-d7d4dc84b87c' && leads.length === 0) {
            // Try fetching real first, but fallback/mix if needed? 
            // Actually, user said "add placeholder data". 
            // For safety, let's just use real data, but if empty, use mock? 
            // Or better, add a prop `useMockData` to the interface.
        }

        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching leads:', error)
            return
        }

        // If data is empty and we are OZ Avala, show Mock Data (as requested for "placeholder data")
        if ((!data || data.length === 0) && clientId === '7ac02189-d0ec-4532-baa6-d7d4dc84b87c') {
            setLeads(MOCK_CRM_DATA)
            calculateStats(MOCK_CRM_DATA)
            return
        }

        setLeads(data || [])
        calculateStats(data || [])
    }, [clientId, tableName, calculateStats, supabase])

    useEffect(() => {
        if (clientId) {
            fetchLeads()

            const channel = supabase
                .channel(`crm-${clientId}`)
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: tableName, filter: `client_id=eq.${clientId}` },
                    () => fetchLeads()
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [clientId, tableName, fetchLeads, supabase])

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        // If mock data lead
        if (id.startsWith('m')) {
            toast.success("Status updated (Mock)")
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
            return
        }

        try {
            const { error } = await supabase
                .from(tableName)
                .update({ status: newStatus })
                .eq('id', id)

            if (error) throw error
            toast.success("Status ažuriran")
            fetchLeads()
        } catch (e) {
            toast.error("Greška pri ažuriranju statusa")
            console.error(e)
        }
    }

    const handleOpenDetails = (lead: any) => {
        setSelectedLead(lead)
        setIsIntelligenceOpen(true)
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Stats Grid - Generalized */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="border-indigo-100 bg-white/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            Active Pipeline
                        </CardTitle>
                        <Users className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{stats.totalCandidates}</div>
                    </CardContent>
                </Card>

                <Card className="border-emerald-100 bg-white/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            Meetings / Interviews
                        </CardTitle>
                        <Briefcase className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{stats.interviewsScheduled}</div>
                    </CardContent>
                </Card>

                <Card className="border-blue-100 bg-white/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            Closed / Hired
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{stats.hired}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900">Pipeline Management</h3>
                        <p className="text-sm text-gray-500">Track and manage your leads effectively.</p>
                    </div>
                </div>

                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow>
                                <TableHead className="w-[200px]">Lead Name</TableHead>
                                <TableHead className="w-[200px]">Contact</TableHead>
                                <TableHead className="w-[150px]">Status</TableHead>
                                {showAgencyMetrics && (
                                    <>
                                        <TableHead className="w-[100px]">Score</TableHead>
                                        <TableHead className="w-[100px]">Value</TableHead>
                                    </>
                                )}
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {leads.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={showAgencyMetrics ? 6 : 4} className="h-24 text-center text-muted-foreground">
                                        No active leads found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                leads.map((lead) => (
                                    <TableRow key={lead.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <TableCell>
                                            <div className="font-semibold text-gray-900">{lead.ime}</div>
                                            <div className="text-xs text-gray-500">{lead.kompanija}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-sm text-gray-600">
                                                <span>{lead.email}</span>
                                                <span>{lead.telefon}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className={cn(
                                                            "h-8 w-full justify-between items-center font-semibold text-[11px] uppercase tracking-wider px-3 border-zinc-200 transition-all hover:border-zinc-300 shadow-sm",
                                                            "bg-white text-zinc-700"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            <div className={cn(
                                                                "w-1.5 h-1.5 rounded-full",
                                                                // Simple logic for dot color based on simple keywords, can be enhanced
                                                                lead.status?.includes('Zaposlen') || lead.status?.includes('Closed') ? "bg-emerald-500" :
                                                                    lead.status?.includes('Odbijen') || lead.status?.includes('Lost') ? "bg-rose-500" :
                                                                        lead.status?.includes('Novi') ? "bg-blue-500" : "bg-indigo-500"
                                                            )} />
                                                            {lead.status || 'New'}
                                                        </div>
                                                        <MoreHorizontal className="w-3 h-3 opacity-50" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[200px]">
                                                    {statuses.map((s) => (
                                                        <DropdownMenuItem key={s} onClick={() => handleStatusUpdate(lead.id, s)}>
                                                            {s}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>

                                        {showAgencyMetrics && (
                                            <>
                                                <TableCell>
                                                    <Badge variant="secondary">{lead.prioritet_skor || '-'}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs">{lead.estimated_value || '-'}</span>
                                                </TableCell>
                                            </>
                                        )}

                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenDetails(lead)}
                                                className="text-zinc-500 hover:text-indigo-600"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <LeadIntelligenceViewer
                lead={selectedLead}
                isOpen={isIntelligenceOpen}
                onClose={() => setIsIntelligenceOpen(false)}
                isClientView={!showAgencyMetrics}
            />
        </div>
    )
}
