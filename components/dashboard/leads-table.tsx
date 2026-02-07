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
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Ime</TableHead>
                        <TableHead>Kompanija</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Kategorija</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {leads.map((lead) => (
                        <TableRow key={lead.id}>
                            <TableCell className="font-medium">{lead.ime}</TableCell>
                            <TableCell>{lead.kompanija || "-"}</TableCell>
                            <TableCell>
                                <Badge variant="outline">{lead.status}</Badge>
                            </TableCell>
                            <TableCell>
                                <Badge className={getKategorijaColor(lead.kategorija)}>
                                    {lead.kategorija}
                                </Badge>
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
    )
}
