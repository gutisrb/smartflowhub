"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Plus,
    Database,
    Search,
    RefreshCw,
    Briefcase,
    MapPin,
    Phone,
    Clock,
    CalendarDays,
    Pencil,
    Trash,
    ExternalLink,
    BookOpen,
    Package,
    Tag,
    Check,
    X,
    Power,
    LayoutGrid,
    List,
} from "lucide-react"
import { getJobsByClientId, createJob, updateJob, deleteJob, getKnjigeByClientId, getProizvodiByClientId, getServicesCatalogByClientId, updateServiceAvailability, updateServicePrice } from "@/lib/supabase/queries"
import { getBookStoreConfig, BOOK_STORE_CLIENTS } from "@/lib/brand-configs"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { GlassCard } from "@/components/ui/glass-card"
import { toast } from "sonner"

interface AgentDatabaseModuleProps {
    clientId: string
    selectedBrandIds?: string[]   // Multi-brand: show combined catalog from all selected brands
    demoMode?: boolean            // When true, fetch from services_catalog (generic demo tenants)
    demoLabel?: string            // Tab label override when in demo mode (e.g. "Tretmani", "Meni")
    nicheKey?: string             // Demo niche key — ecommerce niches use proizvodi table instead of services_catalog
    terminology?: {
        title: string
        highlight: string
        entity: string
        entities: string
        group: string
        groups: string
        dbTitle?: string
        dbItem?: string
        [key: string]: any
    }
}

export function AgentDatabaseModule({
    clientId,
    selectedBrandIds,
    demoMode = false,
    demoLabel = 'Usluge',
    nicheKey,
    terminology = {
        title: "Growth",
        highlight: "Engine",
        entity: "Lead",
        entities: "Leads",
        group: "Company",
        groups: "Companies",
        dbTitle: "Agent Database",
        dbItem: "Context Node"
    }
}: AgentDatabaseModuleProps) {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [editId, setEditId] = useState<string | null>(null)
    const [bookTab, setBookTab] = useState<'all' | 'dostupno' | 'nedostupno'>('all')

    const [formData, setFormData] = useState({
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

    const bookStoreConfig = getBookStoreConfig(clientId)
    const isHarmonija = bookStoreConfig !== null
    const isCatalogProducts = bookStoreConfig?.tableType === 'proizvodi'
    const bsColor = bookStoreConfig?.color || '#10b981'

    // Mock product catalog for Maguna Dizajn — furniture e-commerce
    const MOCK_MAGUNA_PRODUCTS = [
        { id: 'mg1',  naziv: 'Sklopivi sto kutija BELI',               brend: 'Maguna', kategorija: 'Sklopivi stolovi',     cena: 8990,  url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg2',  naziv: 'Sklopivi radni sto BELI',                brend: 'Maguna', kategorija: 'Sklopivi stolovi',     cena: 6490,  url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg3',  naziv: 'Sklopivi klub sto 2u1',                  brend: 'Maguna', kategorija: 'Sklopivi klub stolovi',cena: 5990,  url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg4',  naziv: 'Sklopivi četvrtasti sto BELI',           brend: 'Maguna', kategorija: 'Sklopivi stolovi',     cena: 4990,  url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg5',  naziv: 'Sklopivi sto zaobljeni ćoškovi A427',   brend: 'Maguna', kategorija: 'Sklopivi stolovi',     cena: 7490,  url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg6',  naziv: 'Sklopivi sto sa policom BELI',           brend: 'Maguna', kategorija: 'Sklopivi stolovi',     cena: 10990, url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg7',  naziv: 'Sklopivi sto CRNI mat',                  brend: 'Maguna', kategorija: 'Sklopivi stolovi',     cena: 7990,  url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg8',  naziv: 'Sklopivi klub sto SIVI',                 brend: 'Maguna', kategorija: 'Sklopivi klub stolovi',cena: 5490,  url: 'https://maguna.rs', status: 'Nedostupno' },
        { id: 'mg9',  naziv: 'Stočić za šminkanje STILSKI',            brend: 'Maguna', kategorija: 'Šminkanje / dekor',   cena: 12990, url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg10', naziv: 'Stočić za šminkanje sa ogledalom LED',   brend: 'Maguna', kategorija: 'Šminkanje / dekor',   cena: 18990, url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg11', naziv: 'Dečiji radni sto sa fiokama BELI',       brend: 'Maguna', kategorija: 'Dečiji nameštaj',     cena: 9490,  url: 'https://maguna.rs', status: 'Aktivan' },
        { id: 'mg12', naziv: 'Dečija polica za knjige BELA',           brend: 'Maguna', kategorija: 'Dečiji nameštaj',     cena: 4290,  url: 'https://maguna.rs', status: 'Aktivan' },
    ]

    // Mock product catalog for Aleksandar MN — shown when DB is empty (pre-seeding)
    const MOCK_AMN_PRODUCTS = [
        { id: 'amn1',  naziv: 'Cognitiva Super nutrijent za mozak', brend: 'Cognitiva',      kategorija: 'Zdravlje – mozak',    cena: 2850, url: 'https://aleksandarmn.com/cognitiva-super-nutrijent-za-mozak-uskoro.html',                            status: 'Aktivan' },
        { id: 'amn2',  naziv: 'Joint MD Extra Strength, 50 tableta', brend: 'Joint MD',       kategorija: 'Zdravlje – zglobovi', cena: 3192, url: 'https://aleksandarmn.com/joint-md-extra-strength-hondroprotektor-50-tableta.html',                    status: 'Aktivan' },
        { id: 'amn3',  naziv: 'Joint MD Revolution, 30 tableta',     brend: 'Joint MD',       kategorija: 'Zdravlje – zglobovi', cena: 3199, url: 'https://aleksandarmn.com/joint-md-revolution-30-tableta-pomoc-za-zglobove-i-artritis.html',           status: 'Aktivan' },
        { id: 'amn4',  naziv: 'Super Collagen + C, 60 tableta',      brend: 'Super Collagen', kategorija: 'Suplementi – kolagen',cena: 1800, url: 'https://aleksandarmn.com/kolagen-tablete-super-collagen-c-60-tableta.html',                           status: 'Aktivan' },
        { id: 'amn5',  naziv: 'Super Collagen Beauty, 60 tableta',   brend: 'Super Collagen', kategorija: 'Suplementi – kolagen',cena: 1998, url: 'https://aleksandarmn.com/super-collagen-beauty-tablete-60-tableta.html',                              status: 'Aktivan' },
        { id: 'amn6',  naziv: 'Marnys Liposomalni VIT-C 1000',       brend: 'Marnys',         kategorija: 'Zdravlje – imunitet', cena: 1322, url: 'https://aleksandarmn.com/liposomalni-vit-c-1000-10x10ml.html',                                        status: 'Aktivan' },
        { id: 'amn7',  naziv: 'Marnys Liposomalni Magnezijum 375mg', brend: 'Marnys',         kategorija: 'Zdravlje – nervi',    cena: 1449, url: 'https://aleksandarmn.com/liposomalni-magnezijum-375.html',                                             status: 'Aktivan' },
        { id: 'amn8',  naziv: 'Serrap MD Forte 120000 SPU',          brend: 'Serrap MD',      kategorija: 'Zdravlje – upala',    cena: 1351, url: 'https://aleksandarmn.com/serrap-md-120000-spu-forte-10-kapsula-protiv-upala-i-otoka-pojacivac-10004754.html', status: 'Aktivan' },
        { id: 'amn9',  naziv: 'iMMUNITA + D3 vitamin 2000',          brend: 'AMN',            kategorija: 'Zdravlje – imunitet', cena: 1500, url: 'https://aleksandarmn.com/immunita-d3-vitamin-2000.html',                                               status: 'Aktivan' },
        { id: 'amn10', naziv: 'Bone Up + D3 vitamin 2000',           brend: 'AMN',            kategorija: 'Zdravlje – kosti',    cena: 1600, url: 'https://aleksandarmn.com/bone-up-d3-vitamin-2000.html',                                                status: 'Aktivan' },
        { id: 'amn11', naziv: 'Cimsulin + D3 vitamin',               brend: 'AMN',            kategorija: 'Zdravlje – šećer',    cena: 1500, url: 'https://aleksandarmn.com/cimsulin-d3-vitamin.html',                                                    status: 'Aktivan' },
        { id: 'amn12', naziv: 'Cognitiva + 5HTP + L-Theanine',       brend: 'Cognitiva',      kategorija: 'Zdravlje – mozak',    cena: 2326, url: 'https://aleksandarmn.com/cognitiva-5htp-l-theanine-suplement.html',                                    status: 'Aktivan' },
        { id: 'amn13', naziv: 'Liposomalni Melatonin + Cognitiva',   brend: 'Cognitiva',      kategorija: 'Zdravlje – spavanje', cena: 1851, url: 'https://aleksandarmn.com/liposomalni-melatonin-cogniva-10-kapsula.html',                               status: 'Aktivan' },
        { id: 'amn14', naziv: 'Chewy Vites Adults Sleep Support',    brend: 'Chewy Vites',    kategorija: 'Zdravlje – spavanje', cena: 2249, url: 'https://aleksandarmn.com/chewy-vites-adults-sleep-liposomalni-melatonin.html',                          status: 'Aktivan' },
        { id: 'amn15', naziv: 'Orgain Whey Protein 828g',            brend: 'Orgain',         kategorija: 'Fitness – proteini',  cena: 7072, url: 'https://aleksandarmn.com/orgain-whey-protein-u-prahu-kremasta-cokolada-828g-gratis-magnezijum-relax-gel-150ml.html', status: 'Aktivan' },
        { id: 'amn16', naziv: 'MVS Set za ravna stopala',            brend: 'MVS',            kategorija: 'Fitness – podrška',   cena: 3315, url: 'https://aleksandarmn.com/mvs-set-za-ravna-stopala-set-lako-i-jednostavno.html',                          status: 'Aktivan' },
        { id: 'amn17', naziv: 'CERAMIDE Restorative Serum 30ml',     brend: 'Pharmaline',     kategorija: 'Kozmetika',           cena: 1150, url: 'https://aleksandarmn.com/ceramide-20restorative-serum-ceramidni-regenerativni-serum-30ml.html',         status: 'Aktivan' },
        { id: 'amn18', naziv: 'Super Collagen Keratin + Gel',        brend: 'Super Collagen', kategorija: 'Suplementi – kolagen',cena: 2599, url: 'https://aleksandarmn.com/super-collagen-keratin-pharmaline-gel.html',                                   status: 'Aktivan' },
        { id: 'amn19', naziv: 'Marnys Organsko Ulje Origana 30ml',   brend: 'Marnys',         kategorija: 'Zdravlje – imunitet', cena: 1799, url: 'https://aleksandarmn.com/marnys-ulje-origana-30-ml-veliko-pakovanje-mala-cena.html',                    status: 'Aktivan' },
        { id: 'amn20', naziv: 'CimSulin + Kraljevski napitak',       brend: 'AMN',            kategorija: 'Zdravlje – šećer',    cena: 1599, url: 'https://aleksandarmn.com/cimsulin-kraljevski-napitak.html',                                             status: 'Aktivan' },
    ]

    const loadData = useCallback(async () => {
        if (!clientId) return
        setLoading(true)
        try {
            if (demoMode) {
                // All auto-generated demo tenants seed into services_catalog regardless of niche
                const data = await getServicesCatalogByClientId(clientId)
                setItems(data)
                setLoading(false)
                return
            }
            if (isHarmonija && selectedBrandIds && selectedBrandIds.length > 1) {
                // Multi-brand: fetch katalog for each selected brand and merge
                const results = await Promise.all(
                    selectedBrandIds.map(async (bid) => {
                        const bConfig = getBookStoreConfig(bid)
                        const rows = bConfig?.tableType === 'proizvodi'
                            ? await getProizvodiByClientId(bid)
                            : await getKnjigeByClientId(bid)
                        return (rows || []).map((r: any) => ({ ...r, brandId: bid }))
                    })
                )
                setItems(results.flat())
            } else {
                let data: any[] = []
                if (isCatalogProducts) {
                    data = await getProizvodiByClientId(clientId) || []
                    if (data.length === 0) {
                        data = clientId === '0c25e7c2-360c-418a-816a-34444d304698'
                            ? MOCK_MAGUNA_PRODUCTS
                            : MOCK_AMN_PRODUCTS
                    }
                } else if (isHarmonija) {
                    data = await getKnjigeByClientId(clientId) || []
                } else {
                    data = await getJobsByClientId(clientId) || []
                }
                setItems(data)
            }
        } catch (error) {
            console.error("Failed to load data", error)
            toast.error("Greška u konekciji sa bazom")
        }
        setLoading(false)
    }, [clientId, isHarmonija, selectedBrandIds])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleRefresh = async () => {
        setRefreshing(true)
        await loadData()
        setTimeout(() => setRefreshing(false), 800)
    }

    const handleSaveEntry = async () => {
        if (!clientId) return
        try {
            const { show_template, smene, ...jobFields } = formData
            const entryData = { ...jobFields, client_id: clientId }
            if (editId) {
                const updated = await updateJob(editId, entryData)
                if (updated) {
                    setItems(items.map(i => i.id === editId ? updated : i))
                    toast.success("Podaci su uspešno ažurirani")
                }
            } else {
                const created = await createJob(entryData)
                if (created) {
                    setItems([created, ...items])
                    toast.success("Novi oglas je uspešno kreiran")
                    // Auto-trigger Instagram posting workflow
                    try {
                        await fetch("http://localhost:5678/webhook/oz-avala-job-post-live", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ record: created, msg_template: created.msg_template ?? "" })
                        })
                        toast.success("Posting na Instagram je pokrenut")
                    } catch {
                        toast.warning("Oglas je sačuvan, ali Instagram posting nije uspeo")
                    }
                }
            }
            setIsDialogOpen(false)
            resetForm()
        } catch (error) {
            console.error("Failed to save entry", error)
            toast.error("Greška prilikom čuvanja")
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Da li ste sigurni da želite da obrišete ovaj oglas?")) {
            try {
                await deleteJob(id)
                setItems(items.filter(i => i.id !== id))
                toast.success("Oglas je obrisan")
            } catch (error) {
                console.error("Failed to delete entry", error)
                toast.error("Greška pri brisanju")
            }
        }
    }

    const resetForm = () => {
        setEditId(null)
        setFormData({
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

    const openEditDialog = (item: any) => {
        setEditId(item.id)
        setFormData({
            posao: item.posao || "",
            firma: item.firma || "",
            lokacija: item.lokacija || "",
            employer_address: item.employer_address || "",
            plata: item.plata || "",
            tip_plate: item.tip_plate || "Mesečno",
            radno_vreme: item.radno_vreme || "",
            smene: item.smene || "",
            opis_posla: item.opis_posla || "",
            kriterijum: item.kriterijum || "",
            start_datum: item.start_datum || "",
            status: item.status || "Aktivan",
            tip_posla: item.tip_posla || "Regularan",
            msg_template: item.msg_template || "",
            employer_contact: item.employer_contact || "",
            show_template: item.show_template || "off"
        })
        setIsDialogOpen(true)
    }

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            let matchesSearch: boolean
            if (isCatalogProducts) {
                matchesSearch = item.naziv?.toLowerCase().includes(searchQuery.toLowerCase()) || item.brend?.toLowerCase().includes(searchQuery.toLowerCase()) || item.kategorija?.toLowerCase().includes(searchQuery.toLowerCase())
            } else if (isHarmonija) {
                matchesSearch = item.naslov?.toLowerCase().includes(searchQuery.toLowerCase()) || item.autor?.toLowerCase().includes(searchQuery.toLowerCase())
            } else {
                matchesSearch = item.posao?.toLowerCase().includes(searchQuery.toLowerCase()) || item.firma?.toLowerCase().includes(searchQuery.toLowerCase())
            }
            if (!matchesSearch) return false
            if (isHarmonija) {
                if (bookTab === 'dostupno') return item.status === 'Aktivan'
                if (bookTab === 'nedostupno') return item.status !== 'Aktivan'
            }
            return true
        })
    }, [items, searchQuery, isHarmonija, isCatalogProducts, bookTab])

    const config = useMemo(() => {
        return {
            label: terminology.title === "Regrutacija" || terminology.title === "Recruitment" ? "Baza Pozicija" : (terminology.dbTitle || "Baza Agenta"),
            item: terminology.title === "Regrutacija" || terminology.title === "Recruitment" ? "Pozicija" : (terminology.dbItem || terminology.entity || "Čvor"),
            color: "text-emerald",
            icon: terminology.title === "Recruitment" || terminology.entity === "Candidate" ? Briefcase : Database
        }
    }, [terminology])

    if (demoMode) {
        return <ServicesCatalogView items={items} loading={loading} label={demoLabel} onRefresh={handleRefresh} />
    }

    return (
        <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald/10 border border-emerald/20 flex items-center justify-center">
                            <config.icon className={cn("w-6 h-6", config.color)} />
                        </div>
                        <h2 className="text-4xl font-outfit font-bold text-silver tracking-tight">
                            {isCatalogProducts ? "Katalog" : isHarmonija ? "Katalog" : terminology.title === "Recruitment" ? "Baza" : "Databaza"}{" "}
                            <span className={config.color}>{isCatalogProducts ? bookStoreConfig!.catalogItemLabel + "a" : isHarmonija ? "Knjiga" : terminology.title === "Recruitment" ? "Pozicija" : "Agenta"}</span>
                        </h2>
                        <Badge className="bg-white/5 text-silver/40 border-white/10 font-outfit text-[10px] uppercase tracking-widest">
                            {isHarmonija ? `${items.length} ${bookStoreConfig!.catalogItemsLabel}` : config.label}
                        </Badge>
                    </div>
                    <p className="text-silver/60 font-outfit text-lg max-w-xl">
                        {isCatalogProducts
                            ? `${bookStoreConfig!.catalogItemLabel}i koje agent preporučuje kupcima. Sinhronizovano sa ${bookStoreConfig!.websiteUrl}.`
                            : isHarmonija
                                ? "Naslovi koje agent preporučuje kupcima. Zaliha i cene biće sinhronizovane sa brainit.rs."
                                : terminology.title === "Regrutacija" || terminology.title === "Recruitment"
                                    ? "Upravljanje oglasima i kriterijumima za AI selekciju kandidata."
                                    : `Autonomno upravljanje znanjem za ${config.item} čvorove.`}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={handleRefresh}
                        className={cn(
                            "h-12 px-6 rounded-2xl bg-white/5 border border-white/5 text-silver font-outfit transition-all hover:border-emerald/30",
                            refreshing && "opacity-50"
                        )}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2 text-emerald", refreshing && "animate-spin")} />
                        Osveži Bazu
                    </Button>

                    {!isHarmonija && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={resetForm} className="h-12 px-8 bg-emerald hover:bg-emerald-600 text-obsidian font-bold rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.2)] border-none transition-all hover:scale-[1.02]">
                                <Plus className="mr-2 h-5 w-5" /> {editId ? "Izmeni" : "Nova"} {config.item}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl bg-obsidian/95 border-white/10 text-silver rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-3xl font-outfit font-bold tracking-tight">
                                    {editId ? `Izmena: ${formData.posao}` : `Kreiranje Nove Pozicije`}
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 font-outfit text-base italic">
                                    Definišite detalje i kriterijume koje će AI koristiti za evaluaciju kandidata.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-6 font-outfit">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Naziv Pozicije</Label>
                                        <Input
                                            placeholder="npr. Konobar / Šanker"
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.posao}
                                            onChange={e => setFormData({ ...formData, posao: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Poslodavac (Firma)</Label>
                                        <Input
                                            placeholder="npr. Cosmofun"
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.firma}
                                            onChange={e => setFormData({ ...formData, firma: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Kontakt Poslodavca</Label>
                                        <Input
                                            placeholder="npr. +381 60 123 4567"
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all font-bold text-silver"
                                            value={formData.employer_contact}
                                            onChange={e => setFormData({ ...formData, employer_contact: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Adresa Poslodavca</Label>
                                        <Input
                                            placeholder="npr. TC Ušće, Sprat 2"
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all font-bold text-silver"
                                            value={formData.employer_address}
                                            onChange={e => setFormData({ ...formData, employer_address: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Lokacija / Grad</Label>
                                        <Input
                                            placeholder="npr. Beograd"
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.lokacija}
                                            onChange={e => setFormData({ ...formData, lokacija: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Iznos Plate</Label>
                                        <Input
                                            placeholder="npr. 80.000"
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.plata}
                                            onChange={e => setFormData({ ...formData, plata: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Period Plaćanja</Label>
                                        <Select value={formData.tip_plate} onValueChange={v => setFormData({ ...formData, tip_plate: v })}>
                                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-obsidian border-white/10 text-silver rounded-xl backdrop-blur-3xl">
                                                <SelectItem value="Mesečno">Mesečno</SelectItem>
                                                <SelectItem value="Po satu">Po satu</SelectItem>
                                                <SelectItem value="Dnevnica">Dnevnica</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Status Oglasa</Label>
                                        <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-obsidian border-white/10 text-silver rounded-xl backdrop-blur-3xl">
                                                <SelectItem value="Aktivan">Aktivan ✅</SelectItem>
                                                <SelectItem value="Pauziran">Pauziran (Privremeno) ⏸️</SelectItem>
                                                <SelectItem value="Završen">Završen (Arhiva) 🏁</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Radno Vreme</Label>
                                        <Input
                                            placeholder="npr. 08 - 16h"
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.radno_vreme}
                                            onChange={e => setFormData({ ...formData, radno_vreme: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Smene</Label>
                                        <Input
                                            placeholder="npr. 2 smene"
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.smene}
                                            onChange={e => setFormData({ ...formData, smene: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Datum Početka</Label>
                                        <Input
                                            placeholder="npr. Odmah"
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.start_datum}
                                            onChange={e => setFormData({ ...formData, start_datum: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Opis Posla</Label>
                                        <textarea
                                            className="w-full h-32 bg-white/5 border-white/10 rounded-xl p-4 focus:border-emerald/40 transition-all font-outfit resize-none outline-none text-sm leading-relaxed"
                                            placeholder="Glavne odgovornosti i zadaci..."
                                            value={formData.opis_posla}
                                            onChange={e => setFormData({ ...formData, opis_posla: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Kriterijumi Selekcije</Label>
                                        <textarea
                                            className="w-full h-32 bg-white/5 border-white/10 rounded-xl p-4 focus:border-emerald/40 transition-all font-outfit resize-none outline-none text-sm leading-relaxed"
                                            placeholder="Šta AI treba da traži kod kandidata..."
                                            value={formData.kriterijum}
                                            onChange={e => setFormData({ ...formData, kriterijum: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 border-t border-white/5 pt-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Automatski Odgovor</Label>
                                            <span className="text-[10px] text-zinc-600 pl-1">Koristi šablon ili prepusti AI-u</span>
                                        </div>
                                        <Select value={formData.show_template} onValueChange={v => setFormData({ ...formData, show_template: v })}>
                                            <SelectTrigger className="w-[180px] h-8 bg-white/5 border-white/10 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-obsidian border-white/10 text-silver rounded-xl backdrop-blur-3xl">
                                                <SelectItem value="on">Koristi Šablon</SelectItem>
                                                <SelectItem value="off">AI Konverzacija</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <textarea
                                        className={cn(
                                            "w-full h-24 bg-white/5 border-white/10 rounded-xl p-4 focus:border-emerald/40 transition-all font-outfit resize-none outline-none text-sm leading-relaxed",
                                            formData.show_template === "off" && "opacity-40 grayscale"
                                        )}
                                        disabled={formData.show_template === "off"}
                                        placeholder="👋 Poštovani/a, Cosmofun traži radnike..."
                                        value={formData.msg_template}
                                        onChange={e => setFormData({ ...formData, msg_template: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 px-6 text-zinc-500 font-outfit hover:text-white">Otkaži</Button>
                                <Button onClick={handleSaveEntry} className="h-12 px-10 bg-emerald text-obsidian font-bold rounded-xl hover:bg-emerald-600 transition-all">{editId ? "Sačuvaj izmene" : "Kreiraj Poziciju"}</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    )}
                </div>
            </div>

            {/* View Controls */}
            <div className="flex flex-col sm:flex-row gap-6 justify-between items-center py-2 px-2">
                <div className="relative w-full sm:w-80 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald transition-colors" />
                    <Input
                        placeholder={isCatalogProducts ? `Pretraži ${bookStoreConfig!.catalogItemsLabel}, brendove...` : isHarmonija ? "Pretraži katalog knjiga..." : "Pretraži bazu pozicija..."}
                        className="pl-11 h-12 bg-white/5 border-white/5 rounded-2xl font-outfit focus:border-emerald/30 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {isHarmonija ? (
                    <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/5 rounded-2xl">
                        {([['all', isCatalogProducts ? 'Svi proizvodi' : 'Sve knjige'], ['dostupno', 'Dostupno'], ['nedostupno', 'Nema na stanju']] as [string, string][]).map(([key, label]) => (
                            <Button key={key} variant="ghost" size="sm"
                                onClick={() => setBookTab(key as 'all' | 'dostupno' | 'nedostupno')}
                                style={bookTab === key ? { color: bsColor, backgroundColor: `${bsColor}18` } : {}}
                                className={cn(
                                    "h-9 px-5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                                    bookTab === key ? "" : "text-zinc-500 hover:text-silver"
                                )}>
                                {label}
                            </Button>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/5 rounded-2xl">
                        <Button variant="ghost" size="sm" className="h-9 px-5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-emerald bg-emerald/10 shadow-lg shadow-emerald/5">Sve Pozicije</Button>
                        <Button variant="ghost" size="sm" className="h-9 px-5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-silver">Aktivne</Button>
                        <Button variant="ghost" size="sm" className="h-9 px-5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-silver">Arhivirane</Button>
                    </div>
                )}
            </div>

            {/* Main Data Table */}
            <GlassCard className="rounded-[2.5rem] overflow-hidden p-0 border-white/5 shadow-2xl">
                <Table>
                    <TableHeader className="bg-white/[0.02] border-b border-white/5">
                        <TableRow className="border-none hover:bg-transparent">
                            {isCatalogProducts ? (<>
                                <TableHead className="w-20 py-8 pl-8" />
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">Proizvod</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit text-right pr-8">Cena</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit text-center">Status</TableHead>
                                <TableHead className="w-16 py-8 pr-8" />
                            </>) : isHarmonija ? (<>
                                <TableHead className="w-16 py-8 pl-8" />
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">Naslov</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">Kategorije</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit text-center">
                                    <span title="Biće sinhronizovano sa brainit.rs">Zaliha / Cena</span>
                                </TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit text-center">Dostupnost</TableHead>
                                <TableHead className="text-right pr-8 py-8 font-outfit">Link</TableHead>
                            </>) : (<>
                                <TableHead className="w-[100px] text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 pl-8 font-outfit">Kod</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">Pozicija</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">Poslodavac</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">Smene & Vreme</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">Plata</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">Početak</TableHead>
                                <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit text-center">Status</TableHead>
                                <TableHead className="text-right pr-8 py-8 font-outfit">Akcije</TableHead>
                            </>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <AnimatePresence mode="popLayout">
                            {loading ? (
                                <TableRow className="border-none">
                                    <TableCell colSpan={8} className="h-80 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <RefreshCw className="w-10 h-10 text-emerald animate-spin opacity-20" />
                                            <span className="text-sm text-zinc-500 font-outfit font-light uppercase tracking-widest">Sinhronizacija sa Bazom...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredItems.length === 0 ? (
                                <TableRow className="border-none">
                                    <TableCell colSpan={8} className="h-80 text-center">
                                        <p className="text-sm font-outfit text-zinc-500 italic opacity-30 tracking-widest uppercase">{isCatalogProducts ? "Nema proizvoda u katalogu" : isHarmonija ? "Nema knjiga u katalogu" : "Nema pronađenih pozicija u bazi"}</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item, idx) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03, duration: 0.4 }}
                                        className="group border-white/[0.03] transition-all duration-300"
                                        style={isHarmonija ? {} : undefined}
                                        onMouseEnter={isHarmonija ? e => (e.currentTarget.style.backgroundColor = `${bsColor}08`) : undefined}
                                        onMouseLeave={isHarmonija ? e => (e.currentTarget.style.backgroundColor = '') : undefined}
                                    >
                                        {isCatalogProducts ? (
                                            <>
                                                {/* Product thumbnail swatch */}
                                                <TableCell className="py-4 pl-8 w-20">
                                                    <div className="w-12 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 relative overflow-hidden"
                                                        style={{
                                                            background: `linear-gradient(145deg, ${bsColor}22, ${bsColor}08)`,
                                                            border: `1px solid ${bsColor}30`,
                                                            boxShadow: `0 4px 16px -4px ${bsColor}30`,
                                                        }}>
                                                        <span className="text-xl font-black leading-none"
                                                            style={{ color: `${bsColor}cc` }}>
                                                            {(item.naziv || '?').charAt(0)}
                                                        </span>
                                                        <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-2xl"
                                                            style={{ background: `linear-gradient(90deg, ${bsColor}80, ${bsColor}20)` }} />
                                                    </div>
                                                </TableCell>
                                                {/* Naziv + Brend + Kategorija */}
                                                <TableCell className="py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-white font-semibold font-outfit text-[15px] group-hover:text-white leading-snug block transition-colors">{item.naziv}</span>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {item.kategorija && (
                                                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                                    style={{ background: `${bsColor}15`, border: `1px solid ${bsColor}30`, color: `${bsColor}cc` }}>
                                                                    {item.kategorija}
                                                                </span>
                                                            )}
                                                            {item.brend && (
                                                                <span className="text-[10px] text-zinc-500 font-outfit">{item.brend}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                {/* Cena — right-aligned, prominent */}
                                                <TableCell className="text-right pr-8">
                                                    {item.cena ? (
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className="text-lg font-black font-mono leading-none"
                                                                style={{ color: bsColor, textShadow: `0 0 20px ${bsColor}40` }}>
                                                                {item.cena.toLocaleString('sr-RS')}
                                                            </span>
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">RSD</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-600 text-xs">—</span>
                                                    )}
                                                </TableCell>
                                                {/* Dostupnost */}
                                                <TableCell className="text-center">
                                                    {item.status === 'Aktivan' ? (
                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                                                            style={{ background: `${bsColor}12`, border: `1px solid ${bsColor}25`, color: bsColor }}>
                                                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: bsColor }} />
                                                            Dostupno
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                                                            Nema na stanju
                                                        </div>
                                                    )}
                                                </TableCell>
                                                {/* Link */}
                                                <TableCell className="text-right pr-8 w-16">
                                                    {item.url && (
                                                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                                                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-600 transition-all opacity-0 group-hover:opacity-100"
                                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${bsColor}18`; e.currentTarget.style.color = bsColor; e.currentTarget.style.borderColor = `${bsColor}30` }}
                                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = '' }}
                                                            title={item.url}>
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}
                                                </TableCell>
                                            </>
                                        ) : isHarmonija ? (
                                            <>
                                                {/* Book cover swatch */}
                                                <TableCell className="py-5 pl-8 w-16">
                                                    <div className="relative w-9">
                                                        <div
                                                            className="w-9 h-12 rounded-sm flex items-center justify-center shrink-0 shadow-md"
                                                            style={{
                                                                background: `linear-gradient(145deg, ${item.brandId ? (BOOK_STORE_CLIENTS[item.brandId]?.color || bsColor) : bsColor}28, ${item.brandId ? (BOOK_STORE_CLIENTS[item.brandId]?.color || bsColor) : bsColor}0a)`,
                                                                borderLeft: `3px solid ${item.brandId ? (BOOK_STORE_CLIENTS[item.brandId]?.color || bsColor) : bsColor}55`,
                                                            }}
                                                        >
                                                            <span className="text-sm font-black font-outfit" style={{ color: `${item.brandId ? (BOOK_STORE_CLIENTS[item.brandId]?.color || bsColor) : bsColor}aa` }}>
                                                                {(item.naslov || '?').charAt(0)}
                                                            </span>
                                                        </div>
                                                        {/* Brand dot in multi-brand mode */}
                                                        {item.brandId && BOOK_STORE_CLIENTS[item.brandId] && (
                                                            <span
                                                                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black"
                                                                style={{ backgroundColor: BOOK_STORE_CLIENTS[item.brandId].color }}
                                                                title={BOOK_STORE_CLIENTS[item.brandId].brandName}
                                                            />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                {/* Naslov + Autor */}
                                                <TableCell className="py-5">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-silver font-bold font-outfit text-sm group-hover:text-white transition-colors leading-snug">{item.naslov}</span>
                                                            {['Atomske navike', 'Moć sadašnjeg trenutka', 'Mit o normalnom'].includes(item.naslov) && (
                                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                                    style={{ background: `${bsColor}18`, color: bsColor, border: `1px solid ${bsColor}30` }}>
                                                                    ★ Preporučeno
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-zinc-500 text-xs font-outfit mt-0.5 block italic">{item.autor || '—'}</span>
                                                    </div>
                                                </TableCell>
                                                {/* Kategorije */}
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(item.kategorije || []).slice(0, 2).map((k: string) => (
                                                            <span key={k} className="text-[10px] px-2.5 py-0.5 rounded-full font-outfit"
                                                                style={{
                                                                    background: `${bsColor}12`,
                                                                    border: `1px solid ${bsColor}25`,
                                                                    color: `${bsColor}cc`,
                                                                }}>
                                                                {k}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                {/* Zaliha / Cena — synced from brainit.rs once connected */}
                                                <TableCell className="text-center">
                                                    {(item.zaliha != null || item.cena != null) ? (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className="text-white font-bold font-mono text-sm">{item.zaliha ?? '—'} <span className="text-zinc-600 text-[10px] font-normal">kom</span></span>
                                                            <span className="text-zinc-500 text-[10px]">{item.cena ?? '—'}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1.5" title="Biće sinhronizovano sa brainit.rs">
                                                            <div className="flex gap-1">
                                                                {[0,1,2].map(i => (
                                                                    <span key={i} className="inline-block w-1 h-1 rounded-full bg-zinc-700 animate-pulse"
                                                                        style={{ animationDelay: `${i * 150}ms` }} />
                                                                ))}
                                                            </div>
                                                            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-700">brainit.rs</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                {/* Dostupnost */}
                                                <TableCell className="text-center">
                                                    {(() => {
                                                        if (item.zaliha === 0) return <Badge className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/15">Nema na stanju</Badge>
                                                        if (item.status === "Aktivan") return <Badge className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border" style={{ background: `${bsColor}12`, color: bsColor, borderColor: `${bsColor}25` }}>Dostupno</Badge>
                                                        if (item.status === "Pauziran") return <Badge className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/15">Privremeno</Badge>
                                                        return <Badge className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 text-zinc-500 border border-white/5">Arhiviran</Badge>
                                                    })()}
                                                </TableCell>
                                                {/* Link */}
                                                <TableCell className="text-right pr-8">
                                                    {item.url && (
                                                        <a
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors font-outfit opacity-0 group-hover:opacity-100"
                                                            style={{ ['--tw-text-opacity' as string]: '1' }}
                                                            onMouseEnter={e => (e.currentTarget.style.color = bsColor)}
                                                            onMouseLeave={e => (e.currentTarget.style.color = '')}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            Otvori
                                                        </a>
                                                    )}
                                                </TableCell>
                                            </>
                                        ) : (
                                            <>
                                                <TableCell className="py-7 pl-8 font-mono text-[10px] text-zinc-500 font-bold">
                                                    <div className="bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg w-fit group-hover:border-emerald/30 group-hover:text-emerald transition-all">
                                                        {item.job_id || 'O-991'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-silver font-bold font-outfit text-base group-hover:text-emerald transition-colors leading-tight">{item.posao}</span>
                                                        <span className="text-[10px] text-zinc-500 mt-1.5 uppercase tracking-widest font-medium opacity-60">{item.tip_posla}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-zinc-300 text-sm font-outfit font-bold">{item.firma}</span>
                                                        {item.employer_address && (
                                                            <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-outfit">
                                                                <MapPin className="w-3 h-3 opacity-50 text-emerald shrink-0" />
                                                                {item.employer_address}
                                                            </div>
                                                        )}
                                                        {!item.employer_address && item.lokacija && (
                                                            <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-outfit">
                                                                <MapPin className="w-3 h-3 opacity-50 text-emerald shrink-0" />
                                                                {item.lokacija}
                                                            </div>
                                                        )}
                                                        {item.employer_contact && (
                                                            <a href={`tel:${item.employer_contact}`} className="flex items-center gap-1.5 text-cyan-400/70 text-xs font-outfit hover:text-cyan-400 transition-colors">
                                                                <Phone className="w-3 h-3 shrink-0" />
                                                                {item.employer_contact}
                                                            </a>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        {item.smene ? (
                                                            <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-outfit font-medium">
                                                                <Clock className="w-3 h-3 text-emerald opacity-70 shrink-0" />
                                                                {item.smene}
                                                            </div>
                                                        ) : null}
                                                        {item.radno_vreme ? (
                                                            <div className="text-zinc-500 text-xs font-outfit">{item.radno_vreme}</div>
                                                        ) : (
                                                            !item.smene && <span className="text-zinc-600 text-xs italic">—</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 text-emerald font-bold font-outfit text-base tracking-tight">
                                                            {item.plata}
                                                        </div>
                                                        <span className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-widest opacity-60 font-medium">{item.tip_plate}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {item.start_datum ? (
                                                        <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-outfit">
                                                            <CalendarDays className="w-3 h-3 text-emerald opacity-70 shrink-0" />
                                                            {item.start_datum}
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-600 text-xs italic">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge
                                                        className={cn(
                                                            "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border-none transition-all",
                                                            item.status === "Aktivan"
                                                                ? "bg-emerald/10 text-emerald shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                                                : item.status === "Pauziran"
                                                                    ? "bg-orange-500/10 text-orange-400"
                                                                    : "bg-zinc-800 text-zinc-500"
                                                        )}
                                                    >
                                                        {item.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <div className="flex items-center justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald/10 hover:text-emerald transition-all">
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-all">
                                                            <Trash className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </>
                                        )}
                                    </motion.tr>
                                ))
                            )}
                        </AnimatePresence>
                    </TableBody>
                </Table>
            </GlassCard>

        </div>
    )
}

// ── Services Catalog view for generic demo tenants ──────────────────────────

interface ServiceItem {
    id: string
    name: string
    category: string | null
    description: string | null
    price_min: number | null
    price_max: number | null
    duration_minutes: number | null
    image_url: string | null
    color_hex: string
    is_featured: boolean
    is_active: boolean
    sort_order: number
}

function getStockStatus(item: ServiceItem): { label: string; color: string } | null {
    if (!item.is_active) return null
    const hash = (item.id + item.name).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return hash % 5 === 0
        ? { label: 'Malo na stanju', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' }
        : { label: 'Na stanju', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' }
}

function ServicesCatalogView({ items, loading, label, onRefresh }: { items: ServiceItem[]; loading: boolean; label: string; onRefresh: () => void }) {
    const [search, setSearch] = useState("")
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [selected, setSelected] = useState<ServiceItem | null>(null)
    const [localItems, setLocalItems] = useState<ServiceItem[]>(items)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [editingPrice, setEditingPrice] = useState<{ id: string; value: string } | null>(null)
    const isProductNiche = label === 'Proizvodi' || label === 'Kolekcija' || label === 'Vozila' || label === 'Nekretnine' || label === 'Meni' || label === 'Paketi'
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(isProductNiche ? 'grid' : 'list')

    useEffect(() => { setLocalItems(items) }, [items])

    const categories = Array.from(new Set(localItems.map(i => i.category).filter(Boolean))) as string[]
    const hasImages = localItems.some(i => i.image_url)

    const filtered = localItems.filter(i => {
        const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.category?.toLowerCase().includes(search.toLowerCase())
        const matchCat = selectedCategory === "all" || i.category === selectedCategory
        return matchSearch && matchCat
    })
    const featured = filtered.filter(i => i.is_featured)
    const rest = filtered.filter(i => !i.is_featured)

    function formatPrice(min: number | null, max: number | null) {
        const price = min ?? max
        if (!price) return null
        return `${price.toLocaleString('sr')} RSD`
    }

    const patchLocal = (id: string, patch: Partial<ServiceItem>) => {
        setLocalItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
        setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev)
    }

    const handleToggleAvailability = async (id: string, current: boolean) => {
        const next = !current
        setSavingId(id)
        patchLocal(id, { is_active: next })
        try {
            await updateServiceAvailability(id, next)
        } catch {
            patchLocal(id, { is_active: current })
        }
        setSavingId(null)
    }

    const handleSavePrice = async (id: string, valueStr: string) => {
        const price = parseFloat(valueStr) || 0
        patchLocal(id, { price_min: price, price_max: price })
        setEditingPrice(null)
        setSavingId(id)
        try {
            await updateServicePrice(id, price, price)
        } catch {
            // next refresh will restore from DB
        }
        setSavingId(null)
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-outfit font-semibold text-white">{label}</h2>
                    <p className="text-sm text-slate-400 mt-0.5">{localItems.length} stavki · {localItems.filter(i => i.is_active).length} dostupno</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-xl glass-card overflow-hidden">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn("p-2 transition-colors", viewMode === 'grid' ? "bg-white/15 text-white" : "text-slate-500 hover:text-slate-300")}
                            title="Grid prikaz"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn("p-2 transition-colors", viewMode === 'list' ? "bg-white/15 text-white" : "text-slate-500 hover:text-slate-300")}
                            title="Lista"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                    <button onClick={onRefresh} className="p-2 rounded-lg glass-card hover:bg-white/10 transition-colors">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Pretraži katalog..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl glass-card text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                </div>
                {categories.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setSelectedCategory("all")}
                            className={cn("px-3 py-1.5 rounded-lg text-sm transition-colors", selectedCategory === "all" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white")}
                        >
                            Sve
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={cn("px-3 py-1.5 rounded-lg text-sm transition-colors", selectedCategory === cat ? "bg-white/15 text-white" : "text-slate-400 hover:text-white")}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center">
                    <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">{localItems.length === 0 ? "Katalog je prazan" : "Nema rezultata"}</p>
                </div>
            ) : viewMode === 'grid' ? (
                /* Grid view — visual ecommerce style */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...featured, ...rest].map(item => {
                        const stock = getStockStatus(item)
                        return (
                            <button
                                key={item.id}
                                onClick={() => setSelected(item)}
                                className={cn(
                                    "glass-card rounded-2xl overflow-hidden text-left group transition-all hover:ring-1 hover:ring-white/15",
                                    !item.is_active && "opacity-50"
                                )}
                            >
                                <div className="relative">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-full h-44 object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                                    ) : (
                                        <div className="w-full h-44 flex items-center justify-center" style={{ backgroundColor: `${item.color_hex}18` }}>
                                            <Package className="w-10 h-10 opacity-30" style={{ color: item.color_hex }} />
                                        </div>
                                    )}
                                    {item.is_featured && (
                                        <span className="absolute top-2 left-2 text-[10px] font-bold text-amber-300 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            ★ Istaknuto
                                        </span>
                                    )}
                                    {!item.is_active && (
                                        <span className="absolute top-2 right-2 text-[10px] font-bold text-red-400 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            Nedostupno
                                        </span>
                                    )}
                                </div>
                                <div className="p-3.5">
                                    {item.category && <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{item.category}</p>}
                                    <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">{item.name}</p>
                                    {isProductNiche && item.description && (
                                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1 leading-relaxed">{item.description}</p>
                                    )}
                                    <div className="flex items-center justify-between mt-2.5">
                                        {formatPrice(item.price_min, item.price_max) ? (
                                            <p className={cn("text-sm font-bold", !item.is_active && "line-through text-slate-500")} style={item.is_active ? { color: item.color_hex } : {}}>{formatPrice(item.price_min, item.price_max)}</p>
                                        ) : <span />}
                                        {isProductNiche ? (
                                            stock && (
                                                <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", stock.color)}>
                                                    {stock.label}
                                                </span>
                                            )
                                        ) : (
                                            item.duration_minutes && (
                                                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {item.duration_minutes} min
                                                </p>
                                            )
                                        )}
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            ) : (
                /* List layout */
                <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
                    {[...featured, ...rest].map(item => {
                        const stock = getStockStatus(item)
                        return (
                            <button
                                key={item.id}
                                onClick={() => setSelected(item)}
                                className={cn("w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors", !item.is_active && "opacity-50")}
                            >
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color_hex}20` }}>
                                        <Tag className="w-5 h-5" style={{ color: item.is_active ? item.color_hex : '#64748b' }} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className={cn("text-sm font-semibold", item.is_active ? "text-white" : "text-slate-500 line-through")}>{item.name}</p>
                                        {item.is_featured && <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">★ Istaknuto</span>}
                                        {!item.is_active && <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">Nedostupno</span>}
                                    </div>
                                    {item.category && <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{item.category}</p>}
                                    {item.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>}
                                </div>
                                <div className="text-right shrink-0 space-y-1.5 min-w-[90px]">
                                    {formatPrice(item.price_min, item.price_max) && (
                                        <p className={cn("text-sm font-bold", !item.is_active && "line-through text-slate-500")} style={item.is_active ? { color: item.color_hex } : {}}>{formatPrice(item.price_min, item.price_max)}</p>
                                    )}
                                    {isProductNiche ? (
                                        stock && (
                                            <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border block text-center", stock.color)}>
                                                {stock.label}
                                            </span>
                                        )
                                    ) : (
                                        item.duration_minutes && (
                                            <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                                                <Clock className="w-3 h-3" /> {item.duration_minutes} min
                                            </p>
                                        )
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Detail panel */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={() => setSelected(null)}
                >
                    <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl shadow-black/90 border border-white/[0.08]" onClick={e => e.stopPropagation()}>
                        {/* Service color accent bar */}
                        <div className="h-1" style={{ backgroundColor: selected.color_hex ?? '#10b981' }} />
                        <div className="bg-[#0a0f1a] p-6 space-y-4">
                        {selected.image_url && <img src={selected.image_url} alt={selected.name} className="w-full h-48 object-cover rounded-xl" />}
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">{selected.category}</p>
                            <h3 className="text-lg font-semibold text-white mt-1">{selected.name}</h3>
                        </div>
                        {selected.description && <p className="text-sm text-slate-300">{selected.description}</p>}

                        {/* Price + duration */}
                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <p className="text-xs text-slate-500 mb-1">Cena</p>
                                {editingPrice?.id === selected.id ? (
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            value={editingPrice.value}
                                            onChange={e => setEditingPrice(p => p ? { ...p, value: e.target.value } : null)}
                                            placeholder="Cena"
                                            className="w-28 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                                        />
                                        <span className="text-xs text-slate-500">RSD</span>
                                        <button onClick={() => handleSavePrice(selected.id, editingPrice.value)} className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => setEditingPrice(null)} className="p-1 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-bold" style={{ color: selected.color_hex }}>
                                            {formatPrice(selected.price_min, selected.price_max) ?? '—'}
                                        </p>
                                        <button
                                            onClick={() => setEditingPrice({ id: selected.id, value: String(selected.price_min ?? selected.price_max ?? '') })}
                                            className="p-1 rounded-lg bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {selected.duration_minutes && (
                                <div>
                                    <p className="text-xs text-slate-500">Trajanje</p>
                                    <p className="text-base font-bold text-white">{selected.duration_minutes} min</p>
                                </div>
                            )}
                        </div>

                        {/* Availability toggle */}
                        <div className="flex items-center justify-between py-3 border-t border-white/[0.06]">
                            <div>
                                <p className="text-sm font-medium text-white flex items-center gap-2">
                                    <Power className="w-4 h-4 text-slate-400" />
                                    Dostupnost usluge
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">AI agent koristi ovo za znanje o ponudi</p>
                            </div>
                            <button
                                onClick={() => handleToggleAvailability(selected.id, selected.is_active)}
                                disabled={savingId === selected.id}
                                className={cn(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none",
                                    selected.is_active ? "bg-emerald-500/80" : "bg-white/10",
                                    savingId === selected.id && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <span className={cn(
                                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                                    selected.is_active ? "translate-x-6" : "translate-x-1"
                                )} />
                            </button>
                        </div>

                        <button onClick={() => setSelected(null)} className="w-full py-2 rounded-xl bg-white/[0.07] text-slate-300 text-sm hover:bg-white/[0.12] transition-colors">
                            Zatvori
                        </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

