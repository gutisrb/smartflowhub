"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Briefcase, MapPin, Calendar, ExternalLink } from "lucide-react"

interface JobPostingsModuleProps {
    clientId: string
}

interface Job {
    id: string
    title: string
    description: string
    location: string
    salary_range: string
    status: string
    created_at: string
    platform_url?: string
}

export function JobPostingsModule({ clientId }: JobPostingsModuleProps) {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (clientId) {
            fetchJobs()
        }
    }, [clientId])

    const fetchJobs = async () => {
        setLoading(true)
        const supabase = createClient()

        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching jobs:', error)
        } else {
            setJobs(data || [])
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
        const variants: Record<string, "default" | "secondary" | "outline" | "destructive" | "success"> = {
            'Published': 'success',
            'Draft': 'secondary',
            'Closed': 'destructive',
            'Active': 'success'
        }
        return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Poslovi (Job Postings)</h2>
                    <p className="text-muted-foreground">Manage your active job listings across platforms.</p>
                </div>
                <Button onClick={fetchJobs} variant="outline" size="sm">
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Listings</CardTitle>
                    <CardDescription>Job posts synced from Infostud & LinkedIn</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading jobs...</div>
                    ) : jobs.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <Briefcase className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                            <h3 className="font-medium text-lg">No job postings found</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1">
                                Jobs from your XML feed or manual entries will appear here.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Salary</TableHead>
                                    <TableHead>Posted</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {jobs.map((job) => (
                                    <TableRow key={job.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{job.title}</span>
                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{job.description}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <MapPin className="w-3 h-3 mr-1" />
                                                {job.location}
                                            </div>
                                        </TableCell>
                                        <TableCell>{job.salary_range || '-'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                {formatDate(job.created_at)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                                        <TableCell className="text-right">
                                            {job.platform_url && (
                                                <Button size="icon" variant="ghost" asChild>
                                                    <a href={job.platform_url} target="_blank" rel="noreferrer">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                </Button>
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
