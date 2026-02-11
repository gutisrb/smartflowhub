
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
import { MessageSquare, MoreHorizontal } from "lucide-react"
import { getCandidatesByClientId } from "@/lib/supabase/queries"

interface SocialCandidatesModuleProps {
    clientId: string
}

export function SocialCandidatesModule({ clientId }: SocialCandidatesModuleProps) {
    const [candidates, setCandidates] = useState<any[]>([])

    useEffect(() => {
        if (clientId) {
            loadCandidates()
        }
    }, [clientId])

    const loadCandidates = async () => {
        if (!clientId) return
        const data = await getCandidatesByClientId(clientId)
        setCandidates(data || [])
    }

    if (!clientId) return null

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Pregled Kandidata (Social Media)</h3>
            </div>

            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead>Ime</TableHead>
                            <TableHead>Posao</TableHead>
                            <TableHead>Starost</TableHead>
                            <TableHead>Lokacija</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Izvor</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead className="text-right">Akcije</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {candidates.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                    Nema pronađenih kandidata.
                                </TableCell>
                            </TableRow>
                        )}
                        {candidates.map((candidate) => (
                            <TableRow key={candidate.id} className="hover:bg-gray-50/50 transition-colors">
                                <TableCell className="font-medium">{candidate.ime || "-"}</TableCell>
                                <TableCell>{candidate.posao || "-"}</TableCell>
                                <TableCell>{candidate.starost || "-"}</TableCell>
                                <TableCell>{candidate.lokacija || "-"}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize">
                                        {candidate.status || "Novi"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{candidate.izvor || "-"}</TableCell>
                                <TableCell>{new Date(candidate.created_at).toLocaleDateString("sr-RS")}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon">
                                            <MessageSquare className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
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
