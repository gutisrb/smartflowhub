
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
import { Plus, MoreHorizontal } from "lucide-react"
import { getJobsByClientId, createJob } from "@/lib/supabase/queries"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SocialJobsModuleProps {
    clientId: string
}

export function SocialJobsModule({ clientId }: SocialJobsModuleProps) {
    const [jobs, setJobs] = useState<any[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // New Job Form State
    const [newJob, setNewJob] = useState({
        job_id: "",
        posao: "",
        firma: "",
        lokacija: "",
        plata: "",
        tip_plate: "",
        radno_vreme: "",
        opis_posla: "",
        kriterijum: "",
        start_datum: "",
        status: "Aktivan",
        tip_posla: "Regularan",
        msg_template: ""
    })

    useEffect(() => {
        if (clientId) {
            loadJobs()
        } else {
            setJobs([])
        }
    }, [clientId])

    const loadJobs = async () => {
        if (!clientId) return
        const data = await getJobsByClientId(clientId)
        setJobs(data || [])
    }

    const handleCreateJob = async () => {
        if (!clientId) return

        try {
            const jobData = { ...newJob, client_id: clientId }
            const createdJob = await createJob(jobData)
            if (createdJob) {
                setJobs([createdJob, ...jobs])
                setIsDialogOpen(false)
                // Reset form
                setNewJob({ ...newJob, job_id: "" })
            }
        } catch (error) {
            console.error("Failed to create job", error)
        }
    }

    if (!clientId) {
        return <div className="p-8 text-center text-muted-foreground">Please log in to view jobs.</div>
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Poslovi</h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Dodaj Posao
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Dodaj Novi Posao</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>ID Posla (npr. J04)</Label>
                                    <Input value={newJob.job_id} onChange={e => setNewJob({ ...newJob, job_id: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Naziv Posla</Label>
                                    <Input value={newJob.posao} onChange={e => setNewJob({ ...newJob, posao: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Firma</Label>
                                    <Input value={newJob.firma} onChange={e => setNewJob({ ...newJob, firma: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Lokacija</Label>
                                    <Input value={newJob.lokacija} onChange={e => setNewJob({ ...newJob, lokacija: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Plata</Label>
                                    <Input value={newJob.plata} onChange={e => setNewJob({ ...newJob, plata: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Tip Plate</Label>
                                    <Input value={newJob.tip_plate} onChange={e => setNewJob({ ...newJob, tip_plate: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Radno Vreme</Label>
                                    <Input value={newJob.radno_vreme} onChange={e => setNewJob({ ...newJob, radno_vreme: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Start Datum</Label>
                                    <Input value={newJob.start_datum} onChange={e => setNewJob({ ...newJob, start_datum: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Status</Label>
                                    <Select
                                        value={newJob.status}
                                        onValueChange={(val) => setNewJob({ ...newJob, status: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Aktivan">Aktivan</SelectItem>
                                            <SelectItem value="Zatvoren">Zatvoren</SelectItem>
                                            <SelectItem value="Na cekanju">Na cekanju</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Tip Posla</Label>
                                    <Input value={newJob.tip_posla} onChange={e => setNewJob({ ...newJob, tip_posla: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Opis Posla</Label>
                                <Input value={newJob.opis_posla} onChange={e => setNewJob({ ...newJob, opis_posla: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Kriterijum</Label>
                                <Input value={newJob.kriterijum} onChange={e => setNewJob({ ...newJob, kriterijum: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Message Template</Label>
                                <Input className="h-20" value={newJob.msg_template} onChange={e => setNewJob({ ...newJob, msg_template: e.target.value })} />
                            </div>
                        </div>
                        <Button onClick={handleCreateJob}>Sacuvaj Posao</Button>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Posao</TableHead>
                            <TableHead>Firma</TableHead>
                            <TableHead>Lokacija</TableHead>
                            <TableHead>Plata</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Tip</TableHead>
                            <TableHead className="text-right">Akcije</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {jobs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                    Nema poslova. Dodajte novi posao.
                                </TableCell>
                            </TableRow>
                        )}
                        {jobs.map((job) => (
                            <TableRow key={job.id}>
                                <TableCell className="font-medium">{job.job_id}</TableCell>
                                <TableCell>{job.posao}</TableCell>
                                <TableCell>{job.firma}</TableCell>
                                <TableCell>{job.lokacija}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{job.plata}</span>
                                        <span className="text-xs text-muted-foreground">{job.tip_plate}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={job.status === "Aktivan" ? "default" : "secondary"}>
                                        {job.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>{job.tip_posla}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
