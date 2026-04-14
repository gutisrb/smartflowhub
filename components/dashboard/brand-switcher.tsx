"use client"

import { motion } from "framer-motion"
import { BookOpen, Sparkles, Users, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { BookStoreConfig } from "@/lib/bookstore-clients"
import { useState, useRef, useEffect } from "react"

interface BrandEntry {
    id: string
    config: BookStoreConfig
}

interface BrandSwitcherProps {
    brands: BrandEntry[]
    activeId: string
    onChange: (id: string) => void
}

interface BrandSwitcherMultiProps {
    brands: BrandEntry[]
    selectedIds: string[]
    onSelectionChange: (ids: string[]) => void
}

const BRAND_META: Record<string, { icon: typeof BookOpen; followers: string }> = {
    "255db627-c62b-44ce-a9dc-3a7e90dd1b67": { icon: Sparkles, followers: "49k" },
    "bd12eb98-e62a-4a87-b620-a9881081449b": { icon: BookOpen, followers: "68k" },
    "d7337d00-db70-46c3-828b-e9ac82e21717": { icon: Users,    followers: "18.5k" },
}

// ── Sidebar variant — always-expanded multi-select panel ─────────────────────
export function BrandSwitcherSidebar({ brands, selectedIds, onSelectionChange }: BrandSwitcherMultiProps) {
    const totalFollowers = "135k"
    const allSelected = brands.every(b => selectedIds.includes(b.id))

    const toggleBrand = (id: string) => {
        let next: string[]
        if (selectedIds.includes(id)) {
            if (selectedIds.length === 1) return
            next = selectedIds.filter(i => i !== id)
        } else {
            next = [...selectedIds, id]
        }
        // Always keep the order matching the GROUP_CLIENTS / brands-prop order
        // so effectiveClientId (selectedIds[0]) is always the highest-priority selected brand
        const order = brands.map(b => b.id)
        onSelectionChange(next.sort((a, b) => order.indexOf(a) - order.indexOf(b)))
    }

    const toggleAll = () => {
        if (allSelected) {
            // Collapse to first brand only
            onSelectionChange([brands[0].id])
        } else {
            onSelectionChange(brands.map(b => b.id))
        }
    }

    return (
        <div className="px-4 pt-6 pb-4 relative z-10">
            {/* Group header */}
            <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Harmonija Group</span>
                <span className="text-[9px] font-mono text-zinc-700">{totalFollowers} pratilaca</span>
            </div>

            {/* "Sve" all-brands toggle */}
            <button
                onClick={toggleAll}
                className={cn(
                    "w-full flex items-center justify-between px-3 py-3 rounded-xl mb-2 text-left transition-all duration-200 border min-h-[44px]",
                    allSelected
                        ? "bg-white/[0.05] border-white/10"
                        : "border-transparent hover:bg-white/[0.02] hover:border-white/5"
                )}
            >
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                        {brands.slice(0, 3).map(b => (
                            <span key={b.id} className="w-2 h-2 rounded-full border border-black/20" style={{ backgroundColor: b.config.color }} />
                        ))}
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-400">Svi brendovi</span>
                </div>
                <div className={cn(
                    "w-4 h-4 rounded flex items-center justify-center border transition-all duration-150",
                    allSelected ? "bg-white/10 border-white/20" : "border-zinc-700"
                )}>
                    {allSelected && <Check className="w-2.5 h-2.5 text-zinc-300" />}
                </div>
            </button>

            {/* Brand tiles */}
            <div className="space-y-1">
                {brands.map(({ id, config }) => {
                    const meta = BRAND_META[id]
                    const Icon = meta?.icon ?? BookOpen
                    const isSelected = selectedIds.includes(id)

                    return (
                        <button
                            key={id}
                            onClick={() => toggleBrand(id)}
                            className={cn(
                                "w-full flex items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-all duration-200 relative overflow-hidden group min-h-[52px]",
                                isSelected
                                    ? "bg-white/[0.06] border border-white/10"
                                    : "hover:bg-white/[0.03] border border-transparent hover:border-white/5"
                            )}
                        >
                            {/* Left color accent bar */}
                            <div
                                className="absolute left-0 inset-y-2 w-[3px] rounded-full transition-opacity duration-200"
                                style={{
                                    backgroundColor: config.color,
                                    opacity: isSelected ? 1 : 0,
                                    boxShadow: isSelected ? `0 0 8px ${config.color}60` : "none",
                                }}
                            />

                            {/* Icon */}
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                                style={{
                                    backgroundColor: isSelected ? `${config.color}20` : "rgba(255,255,255,0.04)",
                                }}
                            >
                                <Icon
                                    className="w-4 h-4 transition-colors duration-200"
                                    style={{ color: isSelected ? config.color : "#71717a" }}
                                />
                            </div>

                            {/* Brand info */}
                            <div className="flex-1 min-w-0">
                                <p
                                    className="text-sm font-semibold leading-none truncate transition-colors duration-200"
                                    style={{ color: isSelected ? config.color : "#e4e4e7" }}
                                >
                                    {config.brandName}
                                </p>
                                <p className="text-[10px] text-zinc-600 mt-0.5 font-mono truncate">
                                    {config.instagramHandle}
                                </p>
                            </div>

                            {/* Followers + checkbox */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                {meta && (
                                    <span
                                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md transition-all duration-200"
                                        style={{
                                            color: isSelected ? config.color : "#52525b",
                                            backgroundColor: isSelected ? `${config.color}15` : "transparent",
                                        }}
                                    >
                                        {meta.followers}
                                    </span>
                                )}
                                <div
                                    className={cn(
                                        "w-4 h-4 rounded flex items-center justify-center border transition-all duration-150",
                                        isSelected ? "border-current" : "border-zinc-700"
                                    )}
                                    style={{ borderColor: isSelected ? `${config.color}80` : undefined, backgroundColor: isSelected ? `${config.color}15` : undefined }}
                                >
                                    {isSelected && <Check className="w-2.5 h-2.5" style={{ color: config.color }} />}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// Compact header variant — sits inside the top bar
export function BrandSwitcherHeader({ brands, activeId, onChange }: BrandSwitcherProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const active = brands.find(b => b.id === activeId)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    if (!active) return null

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/8 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/15 transition-all duration-200 group"
                style={{ borderColor: `${active.config.color}25` }}
            >
                <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: active.config.color, boxShadow: `0 0 8px ${active.config.color}80` }}
                />
                <span className="text-xs font-semibold tracking-wide text-zinc-200 whitespace-nowrap">
                    {active.config.brandName}
                </span>
                <ChevronDown className={cn("w-3 h-3 text-zinc-500 transition-transform duration-200", open && "rotate-180")} />
            </button>

            {/* Dropdown */}
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 z-50 min-w-[200px] rounded-2xl border border-white/10 bg-[#0f1214]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                >
                    <div className="p-1.5 flex flex-col gap-0.5">
                        {brands.map(({ id, config }) => {
                            const meta = BRAND_META[id]
                            const Icon = meta?.icon ?? BookOpen
                            const isActive = activeId === id
                            return (
                                <button
                                    key={id}
                                    onClick={() => { onChange(id); setOpen(false) }}
                                    className={cn(
                                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-150",
                                        isActive
                                            ? "bg-white/[0.07]"
                                            : "hover:bg-white/[0.04]"
                                    )}
                                >
                                    <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${config.color}18` }}
                                    >
                                        <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span
                                            className="text-xs font-semibold leading-none"
                                            style={{ color: isActive ? config.color : "#e4e4e7" }}
                                        >
                                            {config.brandName}
                                        </span>
                                        {meta && (
                                            <span className="text-[10px] text-zinc-500 mt-1">
                                                {meta.followers} pratilaca
                                            </span>
                                        )}
                                    </div>
                                    {isActive && (
                                        <span
                                            className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                                            style={{ backgroundColor: config.color }}
                                        />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Footer hint */}
                    <div className="px-4 py-2 border-t border-white/5">
                        <p className="text-[10px] text-zinc-600 tracking-wide">
                            Harmonija Group · 3 brenda · 135k pratilaca
                        </p>
                    </div>
                </motion.div>
            )}
        </div>
    )
}
