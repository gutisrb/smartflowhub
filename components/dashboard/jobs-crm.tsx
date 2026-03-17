
"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
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
import { Plus, MoreHorizontal, Sparkles } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface JobsCRMProps {
    clientId: string | null
}

export function JobsCRM({ clientId }: JobsCRMProps) {
    const [jobs, setJobs] = useState<any[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // New Job Form State
    const [newJob, setNewJob] = useState({
        posao: "",
        firma: "",
        lokacija: "",
        employer_address: "",
        plata: "",
        tip_plate: "Mesečno",
        radno_vreme: "",
        smene: "",
        opis_posla: "",
        kriterijum: "",
        start_datum: "",
        status: "Aktivan",
        tip_posla: "Regularan",
        msg_template: "",
        employer_contact: "",
        show_template: "off"
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

    const resetForm = () => {
        setNewJob({
            posao: "",
            firma: "",
            lokacija: "",
            employer_address: "",
            plata: "",
            tip_plate: "Mesečno",
            radno_vreme: "",
            smene: "",
            opis_posla: "",
            kriterijum: "",
            start_datum: "",
            status: "Aktivan",
            tip_posla: "Regularan",
            msg_template: "",
            employer_contact: "",
            show_template: "off"
        })
    }

    const handleCreateJob = async () => {
        if (!clientId) return

        try {
            const jobData = { ...newJob, client_id: clientId }
            const createdJob = await createJob(jobData)
            if (createdJob) {
                setJobs([createdJob, ...jobs])
                setIsDialogOpen(false)
                resetForm()
                toast.success("Posao je uspešno sačuvan")
            }
        } catch (error) {
            console.error("Failed to create job", error)
            toast.error("Greška prilikom čuvanja")
        }
    }

    if (!clientId) {
        return <div className="p-8 text-center text-muted-foreground font-outfit">Molimo vas da se prijavite kako biste videli poslove.</div>
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Poslovi</h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-emerald text-obsidian hover:bg-emerald/90 h-10 px-6 rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald/20">
                            <Plus className="mr-2 h-4 w-4" /> Dodaj Oglas
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto glass-panel border-white/10 p-0 rounded-[2rem] bg-obsidian/95 backdrop-blur-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
                        <div className="p-8 border-b border-white/10">
                            <DialogHeader>
                                <DialogTitle className="text-3xl font-outfit font-bold italic">
                                    Kreiraj <span className="text-emerald not-italic font-black text-4xl uppercase">Novi Oglas</span>
                                </DialogTitle>
                                <p className="text-silver/40 text-sm font-light mt-2 tracking-wide">
                                    Unesite detalje pozicije za regrutaciju kandidata.
                                </p>
                            </DialogHeader>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Primary Details */}
                            <div className="grid gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Naziv Pozicije</Label>
                                        <Input
                                            placeholder="npr. Konobar / Šanker"
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all text-lg"
                                            value={newJob.posao}
                                            onChange={e => setNewJob({ ...newJob, posao: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Naziv Poslodavca (Firma)</Label>
                                        <Input
                                            placeholder="npr. Cosmofun"
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all text-lg"
                                            value={newJob.firma}
                                            onChange={e => setNewJob({ ...newJob, firma: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Kontakt Poslodavca</Label>
                                        <Input
                                            placeholder="npr. +381 60 123 4567"
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                            value={newJob.employer_contact}
                                            onChange={e => setNewJob({ ...newJob, employer_contact: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Adresa Poslodavca</Label>
                                        <Input
                                            placeholder="npr. TC Ušće, Sprat 2"
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                            value={newJob.employer_address}
                                            onChange={e => setNewJob({ ...newJob, employer_address: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Grad / Lokacija</Label>
                                        <Input
                                            placeholder="npr. Beograd (Zvezdara)"
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                            value={newJob.lokacija}
                                            onChange={e => setNewJob({ ...newJob, lokacija: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Plata (Iznos)</Label>
                                            <Input
                                                placeholder="npr. 80.000"
                                                className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                                value={newJob.plata}
                                                onChange={e => setNewJob({ ...newJob, plata: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Period</Label>
                                            <Select
                                                value={newJob.tip_plate}
                                                onValueChange={(val) => setNewJob({ ...newJob, tip_plate: val })}
                                            >
                                                <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all">
                                                    <SelectValue placeholder="Period" />
                                                </SelectTrigger>
                                                <SelectContent className="glass-panel border-white/10 bg-obsidian text-silver rounded-2xl">
                                                    <SelectItem value="Mesečno">Mesečno</SelectItem>
                                                    <SelectItem value="Satnica">Po satu</SelectItem>
                                                    <SelectItem value="Dnevnica">Dnevnica</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Smene / Radno Vreme</Label>
                                        <Input
                                            placeholder="npr. 10-16h / 16-22h"
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                            value={newJob.smene}
                                            onChange={e => setNewJob({ ...newJob, smene: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Datum Početka</Label>
                                        <Input
                                            placeholder="npr. Odmah / 15. Maj"
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                            value={newJob.start_datum}
                                            onChange={e => setNewJob({ ...newJob, start_datum: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Tip Angažovanja</Label>
                                        <Select
                                            value={newJob.tip_posla}
                                            onValueChange={(val) => setNewJob({ ...newJob, tip_posla: val })}
                                        >
                                            <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all">
                                                <SelectValue placeholder="Tip" />
                                            </SelectTrigger>
                                            <SelectContent className="glass-panel border-white/10 bg-obsidian text-silver rounded-2xl">
                                                <SelectItem value="Regularan">Redovan posao</SelectItem>
                                                <SelectItem value="Studentski">Studentski zadrugar</SelectItem>
                                                <SelectItem value="Privremen">Privremeni poslovi</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Job Description & Criteria */}
                            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-emerald pl-1">Opis Posla</Label>
                                    <Textarea
                                        rows={6}
                                        placeholder="Opišite glavne odgovornosti i zaduženja..."
                                        className="bg-white/5 border-white/10 rounded-2xl py-4 font-outfit focus:border-emerald/40 transition-all resize-none text-sm leading-relaxed"
                                        value={newJob.opis_posla}
                                        onChange={e => setNewJob({ ...newJob, opis_posla: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-emerald pl-1">Kriterijumi (Uslovi)</Label>
                                    <Textarea
                                        rows={6}
                                        placeholder="Unesite potrebne kvalifikacije i uslove..."
                                        className="bg-white/5 border-white/10 rounded-2xl py-4 font-outfit focus:border-emerald/40 transition-all resize-none text-sm leading-relaxed"
                                        value={newJob.kriterijum}
                                        onChange={e => setNewJob({ ...newJob, kriterijum: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* AI & Automation Settings */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Komunikacioni Model</Label>
                                        <p className="text-[10px] text-zinc-500 font-light mt-1">Odaberite kako agent odgovara na prijave.</p>
                                    </div>
                                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                                        <button
                                            onClick={() => setNewJob({ ...newJob, show_template: "off" })}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                                newJob.show_template === "off" ? "bg-emerald text-obsidian shadow-lg" : "text-zinc-500 hover:text-white"
                                            )}
                                        >
                                            Pametni AI
                                        </button>
                                        <button
                                            onClick={() => setNewJob({ ...newJob, show_template: "on" })}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                                newJob.show_template === "on" ? "bg-emerald text-obsidian shadow-lg" : "text-zinc-500 hover:text-white"
                                            )}
                                        >
                                            Šablon Poruke
                                        </button>
                                    </div>
                                </div>

                                <div className="relative group">
                                    <Textarea
                                        className={cn(
                                            "min-h-[140px] bg-obsidian border-white/10 rounded-2xl p-6 font-outfit focus:border-emerald/40 transition-all resize-none text-sm leading-relaxed",
                                            newJob.show_template === "off" && "opacity-30 grayscale pointer-events-none"
                                        )}
                                        placeholder="👋 Poštovani/a, Cosmofun traži radnike..."
                                        value={newJob.msg_template}
                                        onChange={e => setNewJob({ ...newJob, msg_template: e.target.value })}
                                    />
                                    {newJob.show_template === "off" && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="bg-emerald/10 border border-emerald/20 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                                                <Sparkles className="w-3 h-3 text-emerald" />
                                                <span className="text-[10px] font-bold text-emerald uppercase tracking-widest">AI Agent Autonomno Upravlja</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Status Oglasa</Label>
                                        <Select
                                            value={newJob.status}
                                            onValueChange={(val) => setNewJob({ ...newJob, status: val })}
                                        >
                                            <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent className="glass-panel border-white/10 bg-obsidian text-silver rounded-2xl">
                                                <SelectItem value="Aktivan">Aktivan ✅</SelectItem>
                                                <SelectItem value="Pauziran">Pauziran (Privremeno) ⏸️</SelectItem>
                                                <SelectItem value="Završen">Završen (Arhiva) 🏁</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <p className="text-[10px] text-zinc-500 italic leading-tight">
                                            {newJob.status === "Aktivan" ? "Oglas je vidljiv i AI agent je spreman za obradu kandidata." :
                                                newJob.status === "Pauziran" ? "Oglas je trenutno neaktivan, ali sačuvan za kasniju reaktivaciju." :
                                                    "Oglas je završen i prebačen u arhivu."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-black/20 mt-auto border-t border-white/10 flex justify-end gap-4">
                            <Button
                                variant="ghost"
                                onClick={() => setIsDialogOpen(false)}
                                className="h-14 px-8 rounded-2xl font-outfit text-zinc-500 hover:text-white transition-all uppercase tracking-widest text-xs"
                            >
                                Odustani
                            </Button>
                            <Button
                                onClick={handleCreateJob}
                                className="h-14 px-12 rounded-2xl bg-emerald text-obsidian font-outfit font-black hover:bg-emerald/90 transition-all shadow-[0_10px_30px_rgba(16,185,129,0.3)] uppercase tracking-widest text-xs"
                            >
                                Sačuvaj Oglas
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold text-zinc-500">POZICIJA</TableHead>
                            <TableHead className="font-bold text-zinc-500">POSLODAVAC</TableHead>
                            <TableHead className="font-bold text-zinc-500">LOKACIJA</TableHead>
                            <TableHead className="font-bold text-zinc-500">PLATA</TableHead>
                            <TableHead className="font-bold text-zinc-500">STATUS</TableHead>
                            <TableHead className="font-bold text-zinc-500">TIP</TableHead>
                            <TableHead className="text-right font-bold text-zinc-500">AKCIJE</TableHead>
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
                                <TableCell className="font-bold text-white">{job.posao}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{job.firma}</span>
                                        <span className="text-[10px] text-zinc-500">{job.employer_address || job.lokacija}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{job.lokacija}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{job.plata}</span>
                                        <span className="text-xs text-muted-foreground">{job.tip_plate}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={job.status === "Aktivan" ? "default" : "secondary"}
                                        className={cn(
                                            job.status === "Aktivan" ? "bg-emerald/20 text-emerald border-emerald/50" :
                                                job.status === "Pauziran" ? "bg-orange-500/20 text-orange-500 border-orange-500/50" :
                                                    "bg-zinc-500/20 text-zinc-500 border-zinc-500/50"
                                        )}
                                    >
                                        {job.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-zinc-400">{job.tip_posla}</TableCell>
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
