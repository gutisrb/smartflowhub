"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  CalendarDays, Clock, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Sparkles, UserX, Plus, Pencil, Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NicheKey, NICHE_CONFIGS } from "@/lib/niche-config"
import { getDemoShift, shiftRowsDays } from "@/lib/demo/time-shift"
import {
  updateAppointmentStatus,
  insertAppointment,
  updateAppointmentFull,
  deleteAppointment,
  AppointmentInput,
} from "@/lib/supabase/queries"

interface Appointment {
  id: string
  client_id: string
  customer_name: string
  customer_phone: string | null
  service_id: string | null
  service_name: string
  service_color: string
  starts_at: string
  ends_at: string
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  urgency: 'low' | 'medium' | 'high' | null
  urgency_reason: string | null
  source: string | null
  notes: string | null
}

interface CatalogService {
  id: string
  name: string
  color_hex: string
  duration_minutes: number | null
  is_active: boolean
  price_min: number | null
  category: string | null
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Zakazano',
  cancelled: 'Otkazano',
  completed: 'Završeno',
  no_show: 'Nije došao',
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'border-emerald-500/50 bg-emerald-500/10',
  cancelled: 'border-red-500/50 bg-red-500/10 opacity-60',
  completed: 'border-slate-500/50 bg-slate-500/10',
  no_show: 'border-orange-500/50 bg-orange-500/10',
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8:00–20:00
// Tall enough that a 45-minute booking can carry a name, a procedure and a price
// without truncating — this grid is the product's most-screenshotted surface.
const ROW_H = 84

const rsd = (n: number) => `${Math.round(n).toLocaleString('de-DE')} RSD`

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sr-Latn-RS', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Greedy interval scheduling: assign non-overlapping column indices so appointments
// in the same time slot are rendered side-by-side instead of stacked on top of each other.
function computeApptLayout(appts: Appointment[]): Map<string, { col: number; totalCols: number }> {
  const layout = new Map<string, { col: number; totalCols: number }>()
  if (appts.length === 0) return layout

  const sorted = [...appts].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

  // Build overlapping clusters
  const clusters: Appointment[][] = []
  let current: Appointment[] = []
  let clusterEnd = new Date(0)

  for (const appt of sorted) {
    const start = new Date(appt.starts_at)
    const end = new Date(appt.ends_at)
    if (start < clusterEnd) {
      current.push(appt)
      if (end > clusterEnd) clusterEnd = end
    } else {
      if (current.length) clusters.push(current)
      current = [appt]
      clusterEnd = end
    }
  }
  if (current.length) clusters.push(current)

  for (const cluster of clusters) {
    const cols: Appointment[][] = []
    for (const appt of cluster) {
      const start = new Date(appt.starts_at)
      let placed = false
      for (let c = 0; c < cols.length; c++) {
        const last = cols[c][cols[c].length - 1]
        if (new Date(last.ends_at) <= start) {
          cols[c].push(appt)
          layout.set(appt.id, { col: c, totalCols: 0 })
          placed = true
          break
        }
      }
      if (!placed) {
        layout.set(appt.id, { col: cols.length, totalCols: 0 })
        cols.push([appt])
      }
    }
    const total = cols.length
    for (const appt of cluster) {
      const e = layout.get(appt.id)!
      layout.set(appt.id, { col: e.col, totalCols: total })
    }
  }

  return layout
}

interface Props {
  clientId: string
  nicheKey?: NicheKey
  /** During onboarding tour: pulse-highlight the appointment matching this customer name */
  tourHighlightName?: string
  /** Demo tenants: re-anchor seeded appointment dates to "today" so the calendar
   *  is never stale, regardless of how long ago the demo was built. */
  demoMode?: boolean
}

export function CalendarModule({ clientId, nicheKey = 'generic', tourHighlightName, demoMode }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<CatalogService[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'week' | 'month'>('week')
  // A booking calendar is for looking forward. A fixed Mon–Sun week spends most
  // of its columns on days that already happened — on a Friday, four of seven.
  // So the window rolls: yesterday for context, then today and the five days
  // being filled up.
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formAppt, setFormAppt] = useState<Appointment | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const supabase = createClient()

  const config = NICHE_CONFIGS[nicheKey] ?? NICHE_CONFIGS.generic

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('appointments')
      .select('*')
      .eq('client_id', clientId)
      .order('starts_at', { ascending: true })

    // Real accounts: bound the window. Demo tenants: fetch all so we can re-anchor.
    if (!demoMode) {
      const from = new Date(); from.setDate(from.getDate() - 7)
      const to = new Date(); to.setDate(to.getDate() + 30)
      query = query.gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString())
    }

    // Resolve the demo offset alongside the fetch rather than after it — awaiting
    // them in series was a visible stall when the tour lands on this step.
    const [{ data }, shift] = await Promise.all([
      query,
      demoMode ? getDemoShift(supabase, clientId, true) : Promise.resolve({ deltaDays: 0 }),
    ])
    let appts = (data as Appointment[]) ?? []

    // Demo: slide the whole schedule forward so it keeps its shape — a week of
    // already-finished appointments BEHIND today and bookings ahead of it.
    // Whole days, so the hero stays "danas u 15h".
    if (demoMode && appts.length > 0) {
      appts = shiftRowsDays(appts, ['starts_at', 'ends_at'], shift.deltaDays)
    }

    setAppointments(appts)
    setLoading(false)
  }, [clientId, demoMode])

  const fetchServices = useCallback(async () => {
    const { data } = await supabase
      .from('services_catalog')
      .select('id, name, color_hex, duration_minutes, is_active, price_min, category')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    setServices((data as CatalogService[]) ?? [])
  }, [clientId])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])
  useEffect(() => { fetchServices() }, [fetchServices])

  const handleApptStatus = async (id: string, newStatus: Appointment['status']) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    setSelectedAppt(prev => prev?.id === id ? { ...prev, status: newStatus } : prev)
    try {
      await updateAppointmentStatus(id, newStatus)
    } catch {
      fetchAppointments()
    }
  }

  const handleFormSave = async (input: AppointmentInput, id?: string) => {
    if (id) {
      const { client_id: _cid, ...rest } = input
      await updateAppointmentFull(id, rest)
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...rest } : a))
      if (selectedAppt?.id === id) setSelectedAppt(prev => prev ? { ...prev, ...rest } as Appointment : null)
    } else {
      const newAppt = await insertAppointment(input)
      if (newAppt) setAppointments(prev => [...prev, newAppt as Appointment])
    }
    setShowForm(false)
    setFormAppt(null)
  }

  const handleDeleteConfirm = async (id: string) => {
    try {
      await deleteAppointment(id)
      setAppointments(prev => prev.filter(a => a.id !== id))
      setSelectedAppt(null)
    } catch {
      // silently ignore
    }
    setDeleteConfirm(null)
  }

  useEffect(() => {
    const channel = supabase
      .channel(`appointments:${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `client_id=eq.${clientId}` }, fetchAppointments)
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [clientId, fetchAppointments])

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })

  const apptsByDay = (day: Date) => appointments.filter(a => isSameDay(new Date(a.starts_at), day))

  // Appointments seeded from the catalog carry service_id; older/manual ones only
  // have the name, so match on both before giving up on a price.
  const priceFor = (a: Appointment): number | null => {
    const svc = services.find(s => s.id === a.service_id)
      ?? services.find(s => s.name.toLowerCase() === (a.service_name || '').toLowerCase())
    return svc?.price_min ?? null
  }

  const now = new Date()
  const next24h = appointments.filter(a => {
    const s = new Date(a.starts_at)
    return s >= now && s <= new Date(now.getTime() + 24 * 3600 * 1000)
  })
  const thisWeek = appointments.filter(a => {
    const s = new Date(a.starts_at)
    return s >= weekStart && s < new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000)
  })
  const cancelRate = appointments.length > 0
    ? Math.round((appointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length / appointments.length) * 100)
    : 0
  const serviceCount: Record<string, number> = {}
  appointments.forEach(a => { serviceCount[a.service_name] = (serviceCount[a.service_name] ?? 0) + 1 })
  const topService = Object.entries(serviceCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  const DAYS_SR = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']
  const dayLabel = (d: Date) => DAYS_SR[(d.getDay() + 6) % 7]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-outfit font-semibold text-white">{config.calendarLabel}</h2>
          <p className="text-sm text-slate-400 mt-0.5">Pregled zakazanih termina</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setFormAppt(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
          >
            <Plus className="w-4 h-4" /> Dodaj termin
          </button>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setView('week')}
              className={cn('px-3 py-1.5 rounded-md text-sm transition-colors', view === 'week' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white')}
            >
              Nedelja
            </button>
            <button
              onClick={() => setView('month')}
              className={cn('px-3 py-1.5 rounded-md text-sm transition-colors', view === 'month' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white')}
            >
              Mesec
            </button>
          </div>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Sledećih 24h', value: next24h.length, icon: Clock, color: 'text-amber-400' },
          { label: 'Ova nedelja', value: thisWeek.length, icon: CalendarDays, color: 'text-sky-400' },
          { label: 'Stopa otkazivanja', value: `${cancelRate}%`, icon: XCircle, color: 'text-red-400' },
          { label: 'Najpopularnija usluga', value: topService, icon: CheckCircle, color: 'text-emerald-400' },
        ].map(m => (
          <div key={m.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
            <m.icon className={cn('w-5 h-5 shrink-0', m.color)} />
            <div className="min-w-0">
              <p className="text-xs text-slate-400">{m.label}</p>
              <p className="text-sm font-semibold text-white truncate">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main calendar */}
        <div className="lg:col-span-3">
          {view === 'week' ? (
            <div data-tour-focus="calendar-week" className="glass-card rounded-2xl overflow-hidden">
              {/* Week nav */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <button onClick={prevWeek} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
                <span className="text-sm font-medium text-white">
                  {weekDays[0].toLocaleDateString('sr-Latn-RS', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextWeek} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Day headers */}
              <div className="flex border-b border-white/8">
                <div className="w-14 shrink-0" />
                <div className="grid grid-cols-7 flex-1">
                  {weekDays.map((day, i) => {
                    const isToday = isSameDay(day, new Date())
                    return (
                      <div key={i} className={cn('py-3 flex flex-col items-center gap-1.5 border-l border-white/[0.04] transition-colors', isToday && 'bg-emerald-500/[0.06]')}>
                        <p className={cn('text-[11px] font-bold uppercase tracking-wider', isToday ? 'text-emerald-400' : 'text-slate-500')}>{dayLabel(day)}</p>
                        <div className={cn('w-9 h-9 flex items-center justify-center rounded-full text-lg font-bold transition-all',
                          isToday ? 'bg-emerald-500 text-[#05140d] shadow-[0_0_16px_-2px_rgba(16,185,129,0.6)]' : 'text-white')}>
                          {day.getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Time grid */}
              <div className="flex overflow-y-auto max-h-[620px]">
                {/* Hour labels */}
                <div className="w-14 shrink-0">
                  {HOURS.map(h => (
                    <div key={h} style={{ height: ROW_H }} className="flex items-start justify-end pr-2.5 pt-1 border-t border-white/[0.04]">
                      <span className="text-[11px] font-semibold text-slate-500 leading-none tabular-nums">{h}:00</span>
                    </div>
                  ))}
                </div>

                {/* Day columns with time-positioned blocks */}
                <div className="grid grid-cols-7 flex-1 border-l border-white/[0.04]">
                  {weekDays.map((day, i) => {
                    const dayAppts = apptsByDay(day)
                    return (
                      <div key={i} className={cn('relative border-l border-white/[0.04]', isSameDay(day, new Date()) && 'bg-emerald-500/[0.04]')}>
                        {/* Hour grid lines */}
                        {HOURS.map(h => (
                          <div key={h} style={{ height: ROW_H }} className="border-t border-white/[0.04]" />
                        ))}
                        {/* Appointments — positioned by time, side-by-side when overlapping */}
                        {(() => {
                          const layoutMap = computeApptLayout(dayAppts)
                          return dayAppts.map(a => {
                            const start = new Date(a.starts_at)
                            const end = new Date(a.ends_at)
                            const startH = start.getHours() + start.getMinutes() / 60
                            const endH = end.getHours() + end.getMinutes() / 60
                            const top = Math.max(0, (startH - 8) * ROW_H)
                            const height = Math.max(46, (endH - startH) * ROW_H)
                            const { col, totalCols } = layoutMap.get(a.id) ?? { col: 0, totalCols: 1 }
                            const leftPct = (col / totalCols) * 100
                            const widthPct = (1 / totalCols) * 100
                            const isTourHero = !!tourHighlightName && a.customer_name === tourHighlightName
                            const price = priceFor(a)
                            const cancelled = a.status === 'cancelled'
                            const accent = isTourHero ? '#10b981' : (a.service_color || '#10b981')
                            return (
                              <div key={a.id} className="contents">
                              {isTourHero && (
                                <span
                                  className="absolute z-30 pointer-events-none whitespace-nowrap text-[9px] font-black uppercase tracking-[0.12em] px-1.5 py-[3px] rounded-md bg-emerald-400 text-[#04140c] shadow-[0_4px_14px_-2px_rgba(16,185,129,0.8)]"
                                  style={{ top: Math.max(0, top - 17), left: `calc(${leftPct}% + 2px)` }}
                                >
                                  upravo zakazano
                                </span>
                              )}
                              <button
                                data-tour-focus={isTourHero ? 'appt-hero' : undefined}
                                onClick={() => { setSelectedAppt(a); setDeleteConfirm(null) }}
                                className={cn(
                                  'absolute rounded-lg overflow-hidden transition-all hover:z-10 hover:brightness-125 text-left pl-2 pr-1.5 py-1.5',
                                  cancelled && 'opacity-50 line-through',
                                  // the booking the tour just watched get made: raised out of the
                                  // grid rather than shouted at — solid ground, a ring, and it
                                  // sits above its neighbours
                                  isTourHero && 'z-20',
                                )}
                                style={{
                                  top: top + 1,
                                  height: height - 2,
                                  left: `calc(${leftPct}% + 2px)`,
                                  width: `calc(${widthPct}% - 4px)`,
                                  borderLeft: `3px solid ${accent}`,
                                  background: isTourHero
                                    ? 'linear-gradient(135deg, rgba(16,185,129,0.42), rgba(16,185,129,0.26))'
                                    : `linear-gradient(135deg, ${accent}26, ${accent}12)`,
                                  boxShadow: isTourHero
                                    ? '0 0 0 1.5px rgba(52,211,153,0.85), 0 10px 28px -8px rgba(16,185,129,0.75)'
                                    : `inset 1px 0 0 ${accent}`,
                                }}
                              >
                                <p className="text-[13px] font-semibold text-white truncate leading-tight font-outfit">{a.customer_name}</p>
                                {height > 52 && (
                                  <p className="text-[11px] text-zinc-300/90 truncate leading-tight mt-[3px]">{a.service_name}</p>
                                )}
                                {height > 68 && (
                                  <div className="flex items-baseline gap-1.5 mt-[3px]">
                                    <span className="text-[11px] font-bold tabular-nums leading-none" style={{ color: accent }}>
                                      {formatTime(a.starts_at)}
                                    </span>
                                    {price != null && (
                                      <span className="text-[10px] font-medium text-zinc-400 tabular-nums leading-none truncate">
                                        · {rsd(price)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </button>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <MonthView
              appointments={appointments}
              onSelect={a => { setSelectedAppt(a); setDeleteConfirm(null) }}
            />
          )}
        </div>

        {/* Next 24h panel */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Sledećih 24h</h3>
          {loading ? (
            <p className="text-sm text-slate-500">Učitavanje...</p>
          ) : next24h.length === 0 ? (
            <div className="glass-card rounded-xl p-4 text-center">
              <CalendarDays className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nema termina</p>
            </div>
          ) : next24h.map(a => (
            <button
              key={a.id}
              onClick={() => { setSelectedAppt(a); setDeleteConfirm(null) }}
              className={cn(
                'w-full text-left rounded-xl border p-3 transition-all hover:scale-[1.01]',
                a.status === 'cancelled' ? 'border-red-500/30 bg-red-500/5 line-through opacity-60' : 'border-white/10 bg-white/[0.04]'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{a.customer_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.service_name}</p>
                  <p className="text-xs text-slate-500">{formatTime(a.starts_at)}</p>
                </div>
                {a.urgency === 'high' && (
                  <span className="shrink-0 flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3 animate-pulse" /> Hitno
                  </span>
                )}
              </div>
              {a.urgency_reason && (
                <p className="text-[11px] text-amber-400/70 mt-1.5 line-clamp-2">{a.urgency_reason}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Service legend */}
      {appointments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(serviceCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => {
            const color = appointments.find(a => a.service_name === name)?.service_color ?? '#6366f1'
            return (
              <span key={name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-slate-300 bg-white/5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {name}
              </span>
            )
          })}
        </div>
      )}

      {/* Detail drawer */}
      {selectedAppt && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => { setSelectedAppt(null); setDeleteConfirm(null) }}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl shadow-black/90 border border-white/[0.08]"
            onClick={e => e.stopPropagation()}
          >
            {/* Service color accent bar */}
            <div className="h-1" style={{ backgroundColor: selectedAppt.service_color ?? '#10b981' }} />
            <div className="bg-[#0a0f1a] p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="text-lg font-semibold text-white truncate">{selectedAppt.customer_name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedAppt.service_color ?? '#10b981' }} />
                  <p className="text-sm text-slate-400 truncate">{selectedAppt.service_name}</p>
                </div>
              </div>
              <span className={cn('shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border', STATUS_COLORS[selectedAppt.status])}>
                {STATUS_LABELS[selectedAppt.status]}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Vreme</span>
                <span className="text-white">{formatDate(selectedAppt.starts_at)} · {formatTime(selectedAppt.starts_at)} – {formatTime(selectedAppt.ends_at)}</span>
              </div>
              {selectedAppt.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Telefon</span>
                  <span className="text-white">{selectedAppt.customer_phone}</span>
                </div>
              )}
              {selectedAppt.source && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Izvor</span>
                  <span className="text-white">{selectedAppt.source}</span>
                </div>
              )}
              {selectedAppt.urgency === 'high' && selectedAppt.urgency_reason && (
                <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs font-medium text-amber-400 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI oznaka hitnosti
                  </p>
                  <p className="text-xs text-amber-300/80">{selectedAppt.urgency_reason}</p>
                </div>
              )}
              {selectedAppt.notes && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1">Napomena</p>
                  <p className="text-sm text-slate-300">{selectedAppt.notes}</p>
                </div>
              )}
            </div>

            {/* Status action buttons */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-white/[0.06]">
              {selectedAppt.status !== 'confirmed' && (
                <button
                  onClick={() => handleApptStatus(selectedAppt.id, 'confirmed')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/25 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Potvrdi
                </button>
              )}
              {selectedAppt.status === 'confirmed' && (
                <>
                  <button
                    onClick={() => handleApptStatus(selectedAppt.id, 'completed')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/20 text-xs font-medium hover:bg-sky-500/25 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Završeno
                  </button>
                  <button
                    onClick={() => handleApptStatus(selectedAppt.id, 'no_show')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/20 text-xs font-medium hover:bg-orange-500/25 transition-colors"
                  >
                    <UserX className="w-3.5 h-3.5" /> Nije došao
                  </button>
                </>
              )}
              {selectedAppt.status !== 'cancelled' && (
                <button
                  onClick={() => handleApptStatus(selectedAppt.id, 'cancelled')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/25 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" /> Otkaži
                </button>
              )}
            </div>

            {/* Edit / Delete row */}
            <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
              <button
                onClick={() => { setFormAppt(selectedAppt); setShowForm(true); setSelectedAppt(null) }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 border border-white/10 text-xs font-medium hover:bg-white/10 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Uredi
              </button>
              {deleteConfirm === selectedAppt.id ? (
                <div className="flex-1 flex gap-1.5">
                  <button
                    onClick={() => handleDeleteConfirm(selectedAppt.id)}
                    className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition-colors"
                  >
                    Potvrdi brisanje
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs hover:bg-white/10 transition-colors"
                  >
                    Ne
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(selectedAppt.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => { setSelectedAppt(null); setDeleteConfirm(null) }}
              className="w-full py-2 rounded-xl bg-white/[0.07] text-slate-300 text-sm hover:bg-white/[0.12] transition-colors"
            >
              Zatvori
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment form modal */}
      {showForm && (
        <AppointmentFormModal
          clientId={clientId}
          services={services}
          initial={formAppt}
          onClose={() => { setShowForm(false); setFormAppt(null) }}
          onSave={handleFormSave}
        />
      )}
    </div>
  )
}

// ── Appointment Form Modal ──────────────────────────────────────────────────

interface FormValues {
  customer_name: string
  customer_phone: string
  service_id: string
  service_name: string
  service_color: string
  date: string
  time: string
  duration: string
  source: string
  notes: string
}

function AppointmentFormModal({
  clientId,
  services,
  initial,
  onClose,
  onSave,
}: {
  clientId: string
  services: CatalogService[]
  initial?: Appointment | null
  onClose: () => void
  onSave: (input: AppointmentInput, id?: string) => Promise<void>
}) {
  const startsAt = initial ? new Date(initial.starts_at) : null
  const endsAt = initial ? new Date(initial.ends_at) : null
  const durationMins = startsAt && endsAt
    ? Math.round((endsAt.getTime() - startsAt.getTime()) / 60000)
    : 60

  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = new Date().toISOString().slice(0, 10)

  const [values, setValues] = useState<FormValues>({
    customer_name: initial?.customer_name ?? '',
    customer_phone: initial?.customer_phone ?? '',
    service_id: initial?.service_id ?? '',
    service_name: initial?.service_name ?? '',
    service_color: initial?.service_color ?? '#6366f1',
    date: startsAt ? startsAt.toISOString().slice(0, 10) : todayStr,
    time: startsAt ? `${pad(startsAt.getHours())}:${pad(startsAt.getMinutes())}` : '10:00',
    duration: String(durationMins),
    source: initial?.source ?? '',
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof FormValues, v: string) => setValues(prev => ({ ...prev, [k]: v }))

  const handleServiceSelect = (serviceId: string) => {
    if (serviceId === '__custom') {
      setValues(prev => ({ ...prev, service_id: '__custom', service_name: '', service_color: '#6366f1' }))
      return
    }
    const s = services.find(s => s.id === serviceId)
    if (!s) {
      setValues(prev => ({ ...prev, service_id: '' }))
      return
    }
    setValues(prev => ({
      ...prev,
      service_id: s.id,
      service_name: s.name,
      service_color: s.color_hex,
      duration: String(s.duration_minutes ?? prev.duration),
    }))
  }

  const handleSubmit = async () => {
    if (!values.customer_name.trim()) { setError('Ime pacijenta je obavezno'); return }
    const effectiveServiceName = values.service_id === '__custom' ? values.service_name : values.service_name
    if (!effectiveServiceName.trim() && services.length > 0 && !values.service_id) {
      setError('Izaberite uslugu'); return
    }

    setError(null)
    setSaving(true)

    try {
      const [y, m, d] = values.date.split('-').map(Number)
      const [h, min] = values.time.split(':').map(Number)
      const starts = new Date(y, m - 1, d, h, min, 0)
      const ends = new Date(starts.getTime() + (parseInt(values.duration) || 60) * 60000)

      const input: AppointmentInput = {
        client_id: clientId,
        customer_name: values.customer_name.trim(),
        customer_phone: values.customer_phone.trim() || undefined,
        service_id: (values.service_id && values.service_id !== '__custom') ? values.service_id : null,
        service_name: values.service_name.trim() || 'Termin',
        service_color: values.service_color,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        source: values.source || undefined,
        notes: values.notes.trim() || undefined,
      }

      await onSave(input, initial?.id)
    } catch {
      setError('Greška pri čuvanju. Pokušajte ponovo.')
    } finally {
      setSaving(false)
    }
  }

  const SOURCES = ['Poziv', 'WhatsApp', 'Instagram', 'Facebook', 'Aplikacija', 'Lično']
  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500/40 focus:outline-none"

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0f1a] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl shadow-black/90 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header accent */}
        <div className="h-0.5 bg-gradient-to-r from-emerald-500/60 via-emerald-400/40 to-transparent" />
        <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{initial ? 'Uredi termin' : 'Novi termin'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {/* Customer name */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Ime i prezime *</label>
            <input
              type="text"
              value={values.customer_name}
              onChange={e => set('customer_name', e.target.value)}
              placeholder="Ime pacijenta"
              className={inputCls}
              autoFocus
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Telefon</label>
            <input
              type="tel"
              value={values.customer_phone}
              onChange={e => set('customer_phone', e.target.value)}
              placeholder="+381 ..."
              className={inputCls}
            />
          </div>

          {/* Service */}
          {services.length > 0 ? (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Usluga *</label>
              <select
                value={values.service_id}
                onChange={e => handleServiceSelect(e.target.value)}
                className={cn(inputCls, "appearance-none cursor-pointer")}
                style={{ backgroundImage: 'none' }}
              >
                <option value="">Izaberite uslugu...</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="__custom">Drugo (unesi ručno)</option>
              </select>
              {values.service_id === '__custom' && (
                <input
                  type="text"
                  value={values.service_name}
                  onChange={e => set('service_name', e.target.value)}
                  placeholder="Naziv usluge"
                  className={cn(inputCls, "mt-2")}
                />
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Usluga / razlog posete</label>
              <input
                type="text"
                value={values.service_name}
                onChange={e => set('service_name', e.target.value)}
                placeholder="Npr. Pregled, Konsultacija..."
                className={inputCls}
              />
            </div>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Datum *</label>
              <input
                type="date"
                value={values.date}
                onChange={e => set('date', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Vreme *</label>
              <input
                type="time"
                value={values.time}
                onChange={e => set('time', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Trajanje (minuta)</label>
            <input
              type="number"
              value={values.duration}
              onChange={e => set('duration', e.target.value)}
              min="5"
              step="5"
              className={inputCls}
            />
          </div>

          {/* Source */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Izvor zakazivanja</label>
            <select
              value={values.source}
              onChange={e => set('source', e.target.value)}
              className={cn(inputCls, "appearance-none cursor-pointer")}
              style={{ backgroundImage: 'none' }}
            >
              <option value="">—</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Napomena</label>
            <textarea
              value={values.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Opciona napomena..."
              className={cn(inputCls, "resize-none")}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-300 text-sm hover:bg-white/10 transition-colors"
          >
            Otkaži
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {saving ? 'Čuvanje...' : (initial ? 'Sačuvaj izmene' : 'Zakaži termin')}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

// ── Month View ──────────────────────────────────────────────────────────────

function MonthView({ appointments, onSelect }: { appointments: Appointment[]; onSelect: (a: Appointment) => void }) {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d })

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = (() => { const d = new Date(month); const w = d.getDay(); return w === 0 ? 6 : w - 1 })()
  const cells = Array.from({ length: firstDayOfWeek + daysInMonth }, (_, i) => i < firstDayOfWeek ? null : i - firstDayOfWeek + 1)
  const DAYS_SR = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']

  const apptsByDay = (day: number) => appointments.filter(a => {
    const d = new Date(a.starts_at)
    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth() && d.getDate() === day
  })

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <button onClick={() => setMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
        <span className="text-sm font-medium text-white">
          {month.toLocaleDateString('sr-Latn-RS', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-white/5">
        {DAYS_SR.map(d => <div key={d} className="p-2 text-center text-xs text-slate-500">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 divide-x divide-white/[0.04]">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-20 p-1.5" />
          const dayAppts = apptsByDay(day)
          const isToday = isSameDay(new Date(month.getFullYear(), month.getMonth(), day), new Date())
          return (
            <div key={i} className={cn('h-20 p-1.5 border-t border-white/[0.04]', isToday && 'bg-white/[0.03]')}>
              <p className={cn('text-xs font-medium mb-1', isToday ? 'text-sky-400' : 'text-slate-400')}>{day}</p>
              {dayAppts.slice(0, 3).map(a => (
                <button
                  key={a.id}
                  onClick={() => onSelect(a)}
                  className="block w-full text-left"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-0.5"
                    style={{ backgroundColor: a.service_color }}
                  />
                </button>
              ))}
              {dayAppts.length > 3 && <p className="text-[9px] text-slate-500">+{dayAppts.length - 3}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
