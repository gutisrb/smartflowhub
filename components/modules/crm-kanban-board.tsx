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
}

export function CRMKanbanBoard({ leads, stages, onStatusUpdate, onOpenDetails }: CRMKanbanBoardProps) {
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

        // Optimistic UI update could go here
        onStatusUpdate(draggableId, destination.droppableId)
    }

    return (
        <div className="flex-1 w-full h-[calc(100vh-200px)] animate-in fade-in duration-700 pb-8">
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex h-full w-full gap-4 overflow-x-auto pb-4 snap-x">
                    {stages.map((stage) => {
                        const stageLeads = groupedLeads[stage] || []
                        const isClosingStage = stage.toLowerCase().includes('closed') || stage.toLowerCase().includes('won') || stage.toLowerCase().includes('zaposlen')
                        const isLossStage = stage.toLowerCase().includes('lost') || stage.toLowerCase().includes('odbijen')
                        const isMiddleStage = !isClosingStage && !isLossStage

                        return (
                            <div key={stage} className="flex flex-col w-[350px] shrink-0 snap-center">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${isClosingStage ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                                            isLossStage ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' :
                                                'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                                            }`} />
                                        <h3 className="font-semibold text-sm text-zinc-800 uppercase tracking-widest">{stage}</h3>
                                    </div>
                                    <Badge variant="outline" className="bg-white/50 border-zinc-200 text-zinc-500 font-mono text-xs shadow-sm">
                                        {stageLeads.length}
                                    </Badge>
                                </div>

                                <Droppable droppableId={stage}>
                                    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`flex-1 rounded-2xl p-2.5 transition-colors border-2 ${snapshot.isDraggingOver ? 'bg-indigo-50/50 border-indigo-200/50 border-dashed' : 'bg-zinc-100/50 border-transparent border-dashed'
                                                }`}
                                        >
                                            <div className="flex flex-col gap-3 min-h-[150px]">
                                                {stageLeads.map((lead: Lead, index: number) => (
                                                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                                        {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                            <Card
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`group relative border-none shadow-sm transition-all duration-300 ${snapshot.isDragging ? 'shadow-xl scale-[1.02] rotate-1 ring-1 ring-indigo-500/20 z-50' : 'hover:shadow-md hover:ring-1 hover:ring-zinc-200 border border-zinc-100/50'
                                                                    }`}
                                                            >

                                                                {/* Background Gradient Accent */}
                                                                <div className={`absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 pointer-events-none bg-gradient-to-br ${isClosingStage ? 'from-emerald-50/50 to-emerald-100/20' :
                                                                    isLossStage ? 'from-rose-50/50 to-rose-100/20' :
                                                                        'from-indigo-50/50 to-purple-50/20'
                                                                    } group-hover:opacity-100`} />

                                                                <CardContent className="p-4 relative z-10">
                                                                    {/* Header: Score & Drag Handle */}
                                                                    <div className="flex justify-between items-start mb-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div
                                                                                {...provided.dragHandleProps}
                                                                                className="text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing p-1 -ml-1.5 rounded"
                                                                            >
                                                                                <GripVertical className="h-4 w-4" />
                                                                            </div>
                                                                            {lead.prioritet_skor && (
                                                                                <Badge variant="secondary" className={`${lead.prioritet_skor >= 80 ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-blue-50 text-blue-700'} font-semibold border-none`}>
                                                                                    {lead.prioritet_skor}% Match
                                                                                </Badge>
                                                                            )}
                                                                        </div>

                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 -mr-1">
                                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end" className="w-[180px]">
                                                                                <DropdownMenuLabel className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">Ažuriraj Status</DropdownMenuLabel>
                                                                                <DropdownMenuSeparator />
                                                                                {stages.map((s: string) => (
                                                                                    <DropdownMenuItem key={s} onClick={() => onStatusUpdate(lead.id, s)} disabled={s === stage} className="text-sm">
                                                                                        {s}
                                                                                    </DropdownMenuItem>
                                                                                ))}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </div>

                                                                    {/* Main Info */}
                                                                    <div className="mb-4">
                                                                        <div className="font-bold text-base text-zinc-800 tracking-tight leading-tight flex justify-between items-center group/title cursor-pointer" onClick={() => onOpenDetails(lead)}>
                                                                            <span className="group-hover/title:text-indigo-600 transition-colors">{lead.ime}</span>
                                                                            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-300 group-hover/title:text-indigo-500 transition-colors opacity-0 group-hover/title:opacity-100" />
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 text-sm text-zinc-500 mt-1 font-medium">
                                                                            <Building2 className="w-3.5 h-3.5" />
                                                                            <span className="truncate">{lead.kompanija || '-'}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Quick Actions / Contact Info */}
                                                                    <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 mt-2">
                                                                        {lead.email && (
                                                                            <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-600 text-zinc-500 transition-colors" asChild>
                                                                                <a href={`mailto:${lead.email}`}><Mail className="h-3 w-3" /></a>
                                                                            </Button>
                                                                        )}
                                                                        {lead.telefon && (
                                                                            <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-600 text-zinc-500 transition-colors" asChild>
                                                                                <a href={`tel:${lead.telefon}`}><Phone className="h-3 w-3" /></a>
                                                                            </Button>
                                                                        )}
                                                                        <div className="flex-1" />

                                                                        {/* Estimated Value (if applicable) */}
                                                                        {lead.estimated_value && (
                                                                            <div className="text-xs font-mono font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                                                                                {lead.estimated_value}
                                                                            </div>
                                                                        )}
                                                                        {!lead.estimated_value && lead.created_at && (
                                                                            <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                                                                                <Clock className="w-3 h-3" />
                                                                                {new Date(lead.created_at).toLocaleDateString()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        )}
                                                    </Draggable>
                                                ))}
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
