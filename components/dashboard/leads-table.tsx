
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
    status: string
    kategorija: string
    posao: string
    starost: string
    status_kategorija: string
    lokacija: string
    komentar: string
    created_at: string
}

interface LeadsTableProps {
    leads: Lead[]
    onOpenChat: (leadId: string) => void
}

export function LeadsTable({ leads, onOpenChat }: LeadsTableProps) {
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
                            <TableHead className="w-[150px]">Ime</TableHead>
                            <TableHead className="w-[150px]">Posao</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Kategorija</TableHead>
                            <TableHead>Starost</TableHead>
                            <TableHead>Status (Kat)</TableHead>
                            <TableHead>Lokacija</TableHead>
                            <TableHead className="max-w-[200px]">Komentar</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead className="text-right">Akcije</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {leads.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center h-24 text-muted-foreground">
                                    Nema leadova.
                                </TableCell>
                            </TableRow>
                        )}
                        {leads.map((lead) => (
                            <TableRow key={lead.id}>
                                <TableCell className="font-medium">{lead.ime || "-"}</TableCell>
                                <TableCell>{lead.posao || "-"}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{lead.status}</Badge>
                                </TableCell>
                                <TableCell>
                                    {lead.kategorija && (
                                        <Badge className={getKategorijaColor(lead.kategorija)}>
                                            {lead.kategorija}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>{lead.starost || "-"}</TableCell>
                                <TableCell>{lead.status_kategorija || "-"}</TableCell>
                                <TableCell>{lead.lokacija || "-"}</TableCell>
                                <TableCell className="max-w-[200px] truncate" title={lead.komentar}>
                                    {lead.komentar || "-"}
                                </TableCell>
                                <TableCell>{new Date(lead.created_at).toLocaleDateString("sr-RS")}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => onOpenChat(lead.id)}>
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
