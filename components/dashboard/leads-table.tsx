
"use client"

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
import { MessageSquare, MoreHorizontal } from "lucide-react"

interface Lead {
    id: string
    ime: string
    email: string
    kompanija: string
    telefon: string
    labor_niche: string
    // volume_needed: number // DEPRECATED
    status: string
    meeting_time: string
    izvor: string
    created_at: string
    kategorija?: string
    prioritet_skor?: number
    obrazlozenje?: string
    sledeca_akcija?: string
}

interface LeadsTableProps {
    leads: Lead[]
    onOpenIntelligence: (lead: Lead) => void
}

export function LeadsTable({ leads, onOpenIntelligence }: LeadsTableProps) {
    const getKategorijaColor = (kategorija: string) => {
        switch (kategorija) {
            case "Vreo": return "bg-red-500 hover:bg-red-600"
            case "Topao": return "bg-orange-500 hover:bg-orange-600"
            case "Hladan": return "bg-blue-500 hover:bg-blue-600"
            default: return "bg-gray-500 hover:bg-gray-600"
        }
    }

    return (
        <div className="rounded-md border bg-card">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Ime</TableHead>
                            <TableHead>Kompanija</TableHead>
                            <TableHead>AI Prioritet</TableHead>
                            <TableHead>Email / Tel</TableHead>
                            <TableHead>Niche</TableHead>
                            {/* <TableHead>Volume</TableHead> */}
                            <TableHead>Status</TableHead>
                            <TableHead>Sastanak</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead className="text-right">Akcije</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {leads.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center h-24 text-muted-foreground italic uppercase tracking-widest text-[10px]">
                                    Nema aktivnih leadova.
                                </TableCell>
                            </TableRow>
                        )}
                        {leads.map((lead) => (
                            <TableRow key={lead.id}>
                                <TableCell className="font-bold text-blue-600">{lead.ime || "-"}</TableCell>
                                <TableCell className="font-semibold">{lead.kompanija || "-"}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${lead.prioritet_skor && lead.prioritet_skor >= 70 ? 'bg-red-500' : lead.prioritet_skor && lead.prioritet_skor >= 40 ? 'bg-orange-500' : 'bg-gray-300'}`} />
                                            <span className="font-mono font-bold text-sm">{lead.prioritet_skor || 0}%</span>
                                            <Badge className={`${getKategorijaColor(lead.kategorija || "")} text-[8px] h-4 px-1 uppercase shrink-0`}>
                                                {lead.kategorija || "Cold"}
                                            </Badge>
                                        </div>
                                        {lead.obrazlozenje && (
                                            <div className="text-[9px] text-gray-400 leading-tight max-w-[150px] line-clamp-2 italic" title={lead.obrazlozenje}>
                                                "{lead.obrazlozenje}"
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-xs text-gray-900">{lead.email}</div>
                                        <div className="text-[10px] text-gray-500 font-mono tracking-tighter">{lead.telefon || "-"}</div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                        {lead.labor_niche || "-"}
                                    </Badge>
                                </TableCell>
                                {/* <TableCell>
                                    <div className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded inline-block">
                                        {lead.volume_needed || 0}
                                    </div>
                                </TableCell> */}
                                <TableCell>
                                    <Badge variant="outline" className="font-bold border-gray-300">
                                        {lead.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                    {lead.meeting_time ? new Date(lead.meeting_time).toLocaleString("sr-RS", {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }) : "-"}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="ghost" className="text-[9px] bg-slate-50 text-slate-500 border-none px-1">
                                        {lead.izvor || "-"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-[10px] font-mono text-gray-400">
                                    {new Date(lead.created_at).toLocaleDateString("sr-RS")}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => onOpenIntelligence(lead)} className="h-7 w-7" title="Lead Intelligence">
                                            <MessageSquare className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                            <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
