"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  CalendarDays, Clock, AlertTriangle, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NicheKey, NICHE_CONFIGS } from "@/lib/niche-config"

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sr-Latn-RS', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

interface Props {
  clientId: string
  nicheKey?: NicheKey
}

export function CalendarModule({ clientId, nicheKey = 'generic' }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const supabase = createClient()

  const config = NICHE_CONFIGS[nicheKey] ?? NICHE_CONFIGS.generic

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    const from = new Date()
    from.setDate(from.getDate() - 7)
    const to = new Date()
    to.setDate(to.getDate() + 30)

    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('client_id', clientId)
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString())
      .order('starts_at', { ascending: true })

    setAppointments((data as Appointment[]) ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  useEffect(() => {
    const channel = supabase
      .channel(`appointments:${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `client_id=eq.${clientId}` }, fetchAppointments)
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [clientId, fetchAppointments])

  // Week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })

  const apptsByDay = (day: Date) => appointments.filter(a => isSameDay(new Date(a.starts_at), day))

  // Metrics
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-outfit font-semibold text-white">{config.calendarLabel}</h2>
          <p className="text-sm text-slate-400 mt-0.5">Pregled zakazanih termina</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('week')}
            className={cn('px-3 py-1.5 rounded-lg text-sm transition-colors', view === 'week' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white')}
          >
            Nedelja
          </button>
          <button
            onClick={() => setView('month')}
            className={cn('px-3 py-1.5 rounded-lg text-sm transition-colors', view === 'month' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white')}
          >
            Mesec
          </button>
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
            <div className="glass-card rounded-2xl overflow-hidden">
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
              <div className="grid grid-cols-7 border-b border-white/5">
                {weekDays.map((day, i) => (
                  <div key={i} className={cn('p-3 text-center', isSameDay(day, new Date()) && 'bg-white/5')}>
                    <p className="text-xs text-slate-500">{DAYS_SR[i]}</p>
                    <p className={cn('text-lg font-semibold', isSameDay(day, new Date()) ? 'text-sky-400' : 'text-white')}>{day.getDate()}</p>
                  </div>
                ))}
              </div>

              {/* Appointment blocks per day */}
              <div className="grid grid-cols-7 divide-x divide-white/[0.04] min-h-[400px]">
                {weekDays.map((day, i) => {
                  const dayAppts = apptsByDay(day)
                  return (
                    <div key={i} className={cn('p-2 space-y-1.5', isSameDay(day, new Date()) && 'bg-white/[0.02]')}>
                      {dayAppts.length === 0 ? null : dayAppts.map(a => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAppt(a)}
                          className={cn(
                            'w-full text-left rounded-lg border px-2 py-1.5 transition-all hover:scale-[1.02]',
                            STATUS_COLORS[a.status]
                          )}
                          style={{ borderLeftColor: a.service_color, borderLeftWidth: 3 }}
                        >
                          <p className="text-xs font-medium text-white truncate">{a.customer_name}</p>
                          <p className="text-[10px] text-slate-400">{formatTime(a.starts_at)}</p>
                          {a.urgency === 'high' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400">
                              <Sparkles className="w-2.5 h-2.5" /> Hitno
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Month view — compact dot grid */
            <MonthView
              appointments={appointments}
              onSelect={setSelectedAppt}
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
              onClick={() => setSelectedAppt(a)}
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedAppt(null)}
        >
          <div
            className="glass-card rounded-2xl p-6 w-full max-w-md space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedAppt.customer_name}</h3>
                <p className="text-sm text-slate-400">{selectedAppt.service_name}</p>
              </div>
              <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', STATUS_COLORS[selectedAppt.status])}>
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

            <button
              onClick={() => setSelectedAppt(null)}
              className="w-full py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/15 transition-colors"
            >
              Zatvori
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

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
