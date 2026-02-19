"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, Phone, Mail, FileText, Calendar } from "lucide-react"

interface CandidatesModuleProps {
    clientId: string
}

interface Candidate {
    id: string
    name: string
    email: string
    phone: string
    status: string
    resume_url?: string
    created_at: string
    applied_for?: string
}

export function CandidatesModule({ clientId }: CandidatesModuleProps) {
    const [candidates, setCandidates] = useState<Candidate[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (clientId) {
            fetchCandidates()
        }
    }, [clientId])

    const fetchCandidates = async () => {
        setLoading(true)
        const supabase = createClient()

        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching candidates:', error)
        } else {
            setCandidates(data || [])
        }
        setLoading(false)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('sr-RS', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    const getStatusBadge = (status: string) => {
        // Map status to colors
        const variants: Record<string, "default" | "secondary" | "outline" | "destructive" | "success"> = {
            'Novi': 'default',
            'Kontaktiran': 'secondary',
            'Intervju': 'success',
            'Odbijen': 'destructive',
            'Zaposlen': 'success'
        }
        return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Omladinci (Candidates)</h2>
                    <p className="text-muted-foreground">Student pool and active applicants.</p>
                </div>
                <Button onClick={fetchCandidates} variant="outline" size="sm">
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Applicants</CardTitle>
                    <CardDescription>Candidates from website forms and job boards</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading candidates...</div>
                    ) : candidates.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                            <h3 className="font-medium text-lg">No candidates found</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1">
                                New applicants will appear here automatically when they apply.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Applied For</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Applied</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Resume</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {candidates.map((candidate) => (
                                    <TableRow key={candidate.id}>
                                        <TableCell className="font-medium">{candidate.name}</TableCell>
                                        <TableCell>{candidate.applied_for || 'General Application'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-sm text-muted-foreground">
                                                <div className="flex items-center">
                                                    <Mail className="w-3 h-3 mr-1" />
                                                    {candidate.email}
                                                </div>
                                                {candidate.phone && (
                                                    <div className="flex items-center mt-1">
                                                        <Phone className="w-3 h-3 mr-1" />
                                                        {candidate.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                {formatDate(candidate.created_at)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(candidate.status)}</TableCell>
                                        <TableCell className="text-right">
                                            {candidate.resume_url ? (
                                                <Button size="icon" variant="ghost" asChild>
                                                    <a href={candidate.resume_url} target="_blank" rel="noreferrer">
                                                        <FileText className="w-4 h-4 text-blue-500" />
                                                    </a>
                                                </Button>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
