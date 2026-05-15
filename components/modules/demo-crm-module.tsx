"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Users, TrendingUp, AlertTriangle, CheckCircle, Search, Filter, RotateCcw, ShoppingBag, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { NicheKey, NICHE_CONFIGS } from "@/lib/niche-config"

interface DemoCrmRow {
  id: string
  client_id: string
  id_razgovora: string | null
  full_name: string
  email: string | null
  telefon: string | null
  kategorija: string | null
  proizvod: string | null
  status: string
  razlog: string | null
  status_porudzbine: string | null
  izvor: string | null
  komentar: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; pulse?: boolean }> = {
  Novi:         { color: 'text-sky-300',     bg: 'bg-sky-500/20' },
  Zainteresovan:{ color: 'text-amber-300',   bg: 'bg-amber-500/20' },
  Naručio:      { color: 'text-emerald-300', bg: 'bg-emerald-500/20' },
  Isporučeno:   { color: 'text-violet-300',  bg: 'bg-violet-500/20' },
  Zakazano:     { color: 'text-emerald-300', bg: 'bg-emerald-500/20' },
  Završeno:     { color: 'text-slate-300',   bg: 'bg-slate-500/20' },
  Reklamacija:  { color: 'text-orange-300',  bg: 'bg-orange-500/20' },
  Intervencija: { color: 'text-red-300',     bg: 'bg-red-500/20', pulse: true },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { color: 'text-slate-300', bg: 'bg-slate-500/20' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', cfg.color, cfg.bg)}>
      {cfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      {status}
    </span>
  )
}

interface Props {
  clientId: string
  nicheKey?: NicheKey
}

export function DemoCrmModule({ clientId, nicheKey = 'generic' }: Props) {
  const [rows, setRows] = useState<DemoCrmRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterKategorija, setFilterKategorija] = useState<string>('all')
  const supabase = createClient()

  const config = NICHE_CONFIGS[nicheKey] ?? NICHE_CONFIGS.generic
  const term = config.terminology

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('demo_crm')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setRows((data as DemoCrmRow[]) ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchRows() }, [fetchRows])

  useEffect(() => {
    const channel = supabase
      .channel(`demo_crm:${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demo_crm', filter: `client_id=eq.${clientId}` }, fetchRows)
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [clientId, fetchRows])

  // Unique categories from data
  const categories = Array.from(new Set(rows.map(r => r.kategorija).filter(Boolean))).sort() as string[]

  const filtered = rows.filter(r => {
    const matchSearch = !search || r.full_name.toLowerCase().includes(search.toLowerCase()) || r.telefon?.includes(search) || r.proizvod?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    const matchKat = filterKategorija === 'all' || r.kategorija === filterKategorija
    return matchSearch && matchStatus && matchKat
  })

  const statuses = term.statuses

  const isEcommerce = ['ecommerce', 'fashion', 'furniture'].includes(nicheKey)

  const metrics = {
    total: rows.length,
    narucilo: rows.filter(r => ['Naručio', 'Zakazano'].includes(r.status)).length,
    reklamacije: rows.filter(r => r.status === 'Reklamacija').length,
    intervencije: rows.filter(r => r.status === 'Intervencija').length,
    konverzija: rows.length > 0
      ? Math.round((rows.filter(r => ['Naručio', 'Isporučeno', 'Zakazano', 'Završeno'].includes(r.status)).length / rows.length) * 100)
      : 0,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-outfit font-semibold text-white">{config.crmLabel}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{term.plural} iz AI Agent razgovora</p>
        </div>
        <button onClick={fetchRows} className="p-2 rounded-lg glass-card hover:bg-white/10 transition-colors">
          <RotateCcw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: `Ukupno ${term.plural.toLowerCase()}`, value: metrics.total, icon: Users, color: 'text-sky-400' },
          { label: isEcommerce ? 'Naručilo' : 'Zakazano', value: metrics.narucilo, icon: isEcommerce ? ShoppingBag : CheckCircle, color: 'text-emerald-400' },
          { label: 'Reklamacije', value: metrics.reklamacije, icon: AlertTriangle, color: 'text-orange-400' },
          { label: 'Konverzija', value: `${metrics.konverzija}%`, icon: TrendingUp, color: 'text-violet-400' },
        ].map(m => (
          <div key={m.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
            <m.icon className={cn('w-5 h-5 shrink-0', m.color)} />
            <div>
              <p className="text-xs text-slate-400">{m.label}</p>
              <p className="text-lg font-semibold text-white">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={`Pretraži ${term.plural.toLowerCase()} ili proizvod...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl glass-card text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        {categories.length > 0 && (
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <select
              value={filterKategorija}
              onChange={e => setFilterKategorija(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-xl glass-card text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none cursor-pointer"
            >
              <option value="all">Sve kategorije</option>
              {categories.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="pl-9 pr-8 py-2 rounded-xl glass-card text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none cursor-pointer"
          >
            <option value="all">Svi statusi</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Učitavanje...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">{rows.length === 0 ? `Još uvek nema ${term.plural.toLowerCase()}` : 'Nema rezultata za ovaj filter'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">{term.singular}</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3 hidden md:table-cell">Kontakt</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3 hidden lg:table-cell">Proizvod / Kategorija</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3 hidden sm:table-cell">Izvor</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(row => (
                  <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-white font-medium">{row.full_name}</p>
                      {row.razlog && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[160px]">{row.razlog}</p>}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <p className="text-sm text-slate-300">{row.telefon ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <p className="text-sm text-slate-300">{row.proizvod ?? '—'}</p>
                      {row.kategorija && <p className="text-xs text-slate-500 mt-0.5">{row.kategorija}</p>}
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <p className="text-xs text-slate-400">{row.izvor ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
