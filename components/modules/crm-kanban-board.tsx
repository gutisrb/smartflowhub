import { useState } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Phone, Mail, Clock, MoreHorizontal, ArrowUpRight, GripVertical, CheckCircle2, UserCircle, Briefcase, Zap, Building2, MapPin, Globe } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropResult, DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot, DragStart } from "@hello-pangea/dnd"
import { motion, AnimatePresence } from "framer-motion"

export interface Lead {
    id: string;
    ime: string;
    kompanija?: string;
    status: string;
    prioritet_skor?: number;
    email?: string;
    telefon?: string;
    estimated_value?: string;
    created_at?: string;
    [key: string]: any;
}

interface CRMKanbanBoardProps {
    leads: Lead[];
    stages: string[];
    onStatusUpdate: (id: string, newStatus: string) => void;
    onOpenDetails: (lead: Lead) => void;
    terminology?: {
        entity: string;
        group: string;
        [key: string]: any;
    };
}

export function CRMKanbanBoard({
    leads,
    stages,
    onStatusUpdate,
    onOpenDetails,
    terminology = { entity: 'Lead', group: 'Company' }
}: CRMKanbanBoardProps) {
    // Group leads by status
    const groupedLeads = stages.reduce((acc: Record<string, Lead[]>, stage: string) => {
        acc[stage] = leads.filter((lead: Lead) => (lead.status || 'Novi Lead') === stage)
        return acc
    }, {} as Record<string, Lead[]>)

    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result

        // Dropped outside the list
        if (!destination) return

        // Dropped in the same place
        if (source.droppableId === destination.droppableId) return

        onStatusUpdate(draggableId, destination.droppableId)
    }

    return (
        <div className="flex-1 w-full h-[calc(100vh-250px)] animate-in fade-in duration-700 pb-8 overflow-hidden">
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex h-full w-full gap-6 overflow-x-auto pb-6 snap-x custom-scrollbar">
                    {stages.map((stage) => {
                        const stageLeads = groupedLeads[stage] || []
                        const isClosingStage = stage.toLowerCase().includes('closed') || stage.toLowerCase().includes('won') || stage.toLowerCase().includes('zaposlen') || stage.toLowerCase().includes('potvrden')
                        const isLossStage = stage.toLowerCase().includes('lost') || stage.toLowerCase().includes('odbijen')
                        const isMiddleStage = !isClosingStage && !isLossStage

                        return (
                            <div key={stage} className="flex flex-col w-[320px] shrink-0 snap-center">
                                {/* Column Header */}
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-2 h-2 rounded-full ${isClosingStage ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]' :
                                            isLossStage ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]' :
                                                'bg-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                                            }`} />
                                        <h3 className="font-bold text-[11px] text-zinc-400 uppercase tracking-[0.2em]">{stage}</h3>
                                    </div>
                                    <Badge variant="outline" className="bg-emerald-500/5 border-emerald-500/10 text-emerald-500/70 font-mono text-[10px] px-1.5 py-0 min-w-[20px] justify-center">
                                        {stageLeads.length}
                                    </Badge>
                                </div>

                                {/* Droppable Area */}
                                <Droppable droppableId={stage}>
                                    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`flex-1 rounded-2xl p-2 transition-all duration-300 border-2 border-transparent ${snapshot.isDraggingOver
                                                ? 'bg-emerald-500/5 border-emerald-500/20 border-dashed scale-[0.99]'
                                                : 'bg-zinc-900/40 border-zinc-800/50'
                                                }`}
                                        >
                                            <div className="flex flex-col gap-3 min-h-[200px]">
                                                <AnimatePresence mode="popLayout">
                                                    {stageLeads.map((lead: Lead, index: number) => (
                                                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                                            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                                <motion.div
                                                                    layout
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                                    transition={{ duration: 0.2 }}
                                                                >
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        className={`group relative rounded-xl transition-all duration-300 border ${snapshot.isDragging
                                                                            ? 'shadow-[0_20px_50px_rgba(0,0,0,0.5)] rotate-1 border-emerald-500/50 bg-zinc-900 z-50'
                                                                            : 'bg-zinc-900/60 border-white/5 hover:border-emerald-500/30 hover:bg-zinc-900/80 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]'
                                                                            }`}
                                                                    >
                                                                        {/* Hover Glow */}
                                                                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                                                        <CardContent className="p-3.5 relative z-10">
                                                                            {/* Header: Score & Actions */}
                                                                            <div className="flex justify-between items-start mb-3">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div
                                                                                        {...provided.dragHandleProps}
                                                                                        className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing p-1 -ml-1.5 transition-colors"
                                                                                    >
                                                                                        <GripVertical className="h-3.5 w-3.5" />
                                                                                    </div>
                                                                                    {lead.prioritet_skor && lead.prioritet_skor >= 80 && (
                                                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                                                            <Zap className="w-2.5 h-2.5 fill-emerald-400" />
                                                                                            HOT
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                <DropdownMenu>
                                                                                    <DropdownMenuTrigger asChild>
                                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-white/5 -mr-1">
                                                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                    </DropdownMenuTrigger>
                                                                                    <DropdownMenuContent align="end" className="w-[180px] bg-zinc-900 border-zinc-800 text-zinc-300">
                                                                                        <DropdownMenuLabel className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest px-2 py-1.5">Prebaci u...</DropdownMenuLabel>
                                                                                        <DropdownMenuSeparator className="bg-zinc-800" />
                                                                                        {stages.map((s: string) => (
                                                                                            <DropdownMenuItem
                                                                                                key={s}
                                                                                                onClick={() => onStatusUpdate(lead.id, s)}
                                                                                                disabled={s === stage}
                                                                                                className="text-xs hover:bg-emerald-500/10 focus:bg-emerald-500/10 focus:text-emerald-400 transition-colors"
                                                                                            >
                                                                                                {s}
                                                                                            </DropdownMenuItem>
                                                                                        ))}
                                                                                    </DropdownMenuContent>
                                                                                </DropdownMenu>
                                                                            </div>

                                                                            {/* Lead Info */}
                                                                            <div className="mb-3 cursor-pointer" onClick={() => onOpenDetails(lead)}>
                                                                                <h4 className="font-bold text-zinc-100 text-[13px] leading-tight group-hover:text-emerald-400 transition-colors mb-1 truncate">
                                                                                    {lead.ime}
                                                                                </h4>
                                                                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                                                                                    <Building2 className="w-3 h-3 text-zinc-600" />
                                                                                    <span className="truncate max-w-[180px]">{lead.kompanija || '-'}</span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Footer / Meta */}
                                                                            <div className="flex items-center justify-between pt-3 border-t border-white/[0.03] mt-1">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    {lead.email && (
                                                                                        <a href={`mailto:${lead.email}`} className="text-zinc-600 hover:text-emerald-400 transition-colors">
                                                                                            <Mail className="h-3.5 w-3.5" />
                                                                                        </a>
                                                                                    )}
                                                                                    {lead.telefon && (
                                                                                        <a href={`tel:${lead.telefon}`} className="text-zinc-600 hover:text-emerald-400 transition-colors">
                                                                                            <Phone className="h-3.5 w-3.5" />
                                                                                        </a>
                                                                                    )}
                                                                                </div>

                                                                                <div className="flex items-center gap-1 text-[10px] text-zinc-600 font-mono">
                                                                                    <Clock className="w-2.5 h-2.5" />
                                                                                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' }) : 'N/A'}
                                                                                </div>
                                                                            </div>
                                                                        </CardContent>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                </AnimatePresence>
                                                {provided.placeholder}
                                            </div>
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        )
                    })}
                </div>
            </DragDropContext>
        </div>
    )
}
