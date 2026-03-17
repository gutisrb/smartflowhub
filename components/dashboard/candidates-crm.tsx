
"use client"

import { useState, useEffect } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, MoreHorizontal, User, Calendar, MapPin, Search, Filter } from "lucide-react"
import { getKandidatiByClientId } from "@/lib/supabase/queries"
import { GlassCard } from "@/components/ui/glass-card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface CandidatesCRMProps {
    clientId: string | null
}

export function CandidatesCRM({ clientId }: CandidatesCRMProps) {
    const [candidates, setCandidates] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        if (clientId) {
            loadCandidates()
        }
    }, [clientId])

    const loadCandidates = async () => {
        if (!clientId) return
        setLoading(true)
        try {
            const data = await getKandidatiByClientId(clientId)
            setCandidates(data || [])
        } catch (error) {
            console.error("Failed to load candidates", error)
        }
        setLoading(false)
    }

    const filteredCandidates = candidates.filter(c =>
        (c.ime?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (c.posao?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    )

    if (!clientId) return null

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-2xl font-bold font-outfit text-white flex items-center gap-2">
                        <User className="w-6 h-6 text-emerald" />
                        Pregled Kandidata
                    </h3>
                    <p className="text-zinc-500 text-sm font-outfit">
                        Praćenje prijava u realnom vremenu sa društvenih mreža.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald transition-colors" />
                        <Input
                            placeholder="Pretraži kandidate..."
                            className="pl-10 bg-white/5 border-white/10 text-white rounded-xl w-64 focus:border-emerald/50 transition-all font-outfit"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <GlassCard className="rounded-[2rem] overflow-hidden border-white/5 shadow-2xl p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-white/[0.02] border-b border-white/5">
                            <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="py-6 pl-8 font-outfit uppercase tracking-widest text-[10px] text-zinc-500 font-bold">Kandidat</TableHead>
                                <TableHead className="py-6 font-outfit uppercase tracking-widest text-[10px] text-zinc-500 font-bold">Pozicija</TableHead>
                                <TableHead className="py-6 font-outfit uppercase tracking-widest text-[10px] text-zinc-500 font-bold">Informacije</TableHead>
                                <TableHead className="py-6 font-outfit uppercase tracking-widest text-[10px] text-zinc-500 font-bold">Status</TableHead>
                                <TableHead className="py-6 font-outfit uppercase tracking-widest text-[10px] text-zinc-500 font-bold">Izvor</TableHead>
                                <TableHead className="py-6 font-outfit uppercase tracking-widest text-[10px] text-zinc-500 font-bold">Datum</TableHead>
                                <TableHead className="py-6 pr-8 text-right font-outfit uppercase tracking-widest text-[10px] text-zinc-500 font-bold">Akcije</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center">
                                        <div className="flex justify-center items-center gap-2 text-zinc-500 font-outfit animate-pulse uppercase tracking-[0.2em] text-xs">
                                            Učitavanje kandidata...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredCandidates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center text-zinc-500 font-outfit italic">
                                        Nema pronađenih kandidata za vašu pretragu.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCandidates.map((candidate) => (
                                    <TableRow key={candidate.id} className="group border-white/[0.03] hover:bg-emerald/[0.02] transition-colors">
                                        <TableCell className="py-5 pl-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald/10 border border-emerald/20 flex items-center justify-center text-emerald font-bold font-outfit">
                                                    {candidate.ime?.charAt(0) || "K"}
                                                </div>
                                                <span className="font-bold text-silver font-outfit group-hover:text-emerald transition-colors">{candidate.ime || "Anonimno"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-zinc-300 font-outfit text-sm">{candidate.posao || "Nije navedeno"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-zinc-500 text-xs font-outfit">
                                                    <Calendar className="w-3 h-3" />
                                                    {candidate.starost ? `${candidate.starost} god.` : "-"}
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-500 text-xs font-outfit">
                                                    <MapPin className="w-3 h-3" />
                                                    {candidate.lokacija || "Nema lokacije"}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border-none",
                                                    candidate.status === "Kvalifikovan"
                                                        ? "bg-emerald/10 text-emerald"
                                                        : candidate.status === "Novi"
                                                            ? "bg-blue-500/10 text-blue-400"
                                                            : "bg-zinc-800 text-zinc-500"
                                                )}
                                            >
                                                {candidate.status || "Novi"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-outfit opacity-60">
                                                {candidate.izvor || "Nepoznato"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-zinc-500 text-sm font-outfit font-light">
                                                {new Date(candidate.created_at).toLocaleDateString("sr-RS")}
                                            </span>
                                        </TableCell>
                                        <TableCell className="pr-8 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl bg-white/5 hover:bg-emerald/10 hover:text-emerald">
                                                    <MessageSquare className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </GlassCard>
        </div>
    )
}
