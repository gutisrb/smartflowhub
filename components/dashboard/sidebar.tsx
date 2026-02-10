
"use client"

import { cn } from "@/lib/utils"
import {
    Users,
    Briefcase,
    Database,
    LayoutDashboard,
    ChevronRight,
    UserCircle
} from "lucide-react"
import { useState } from "react"

export type ViewType = "jobs" | "candidates" | "business-leads" | "analytics"

interface SidebarProps {
    currentView: ViewType
    onViewChange: (view: ViewType) => void
    clientName: string
}

export function Sidebar({ currentView, onViewChange, clientName }: SidebarProps) {
    const [isSocialExpanded, setIsSocialExpanded] = useState(true)

    return (
        <div className="w-64 border-r bg-white flex flex-col h-screen">
            <div className="p-6 border-b">
                <div className="flex items-center gap-2 font-bold text-xl text-primary">
                    <Database className="w-6 h-6" />
                    <span>SmartFlow</span>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="space-y-1">
                    <button
                        onClick={() => setIsSocialExpanded(!isSocialExpanded)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-gray-500 hover:text-gray-900"
                    >
                        <span>DRUŠTVENE MREŽE</span>
                        <ChevronRight className={cn("w-4 h-4 transition-transform", isSocialExpanded && "rotate-90")} />
                    </button>

                    {isSocialExpanded && (
                        <div className="space-y-1 ml-2">
                            <NavItem
                                icon={Briefcase}
                                label="Poslovi"
                                active={currentView === "jobs"}
                                onClick={() => onViewChange("jobs")}
                            />
                            <NavItem
                                icon={Users}
                                label="Kandidati"
                                active={currentView === "candidates"}
                                onClick={() => onViewChange("candidates")}
                            />
                        </div>
                    )}
                </div>

                <div className="pt-4 space-y-1">
                    <div className="px-3 py-2 text-sm font-semibold text-gray-500 uppercase">AI Growth</div>
                    <NavItem
                        icon={Database}
                        label="Business CRM"
                        active={currentView === "business-leads"}
                        onClick={() => onViewChange("business-leads")}
                    />
                    <NavItem
                        icon={LayoutDashboard}
                        label="Analitika"
                        active={currentView === "analytics"}
                        onClick={() => onViewChange("analytics")}
                    />
                </div>
            </nav>

            <div className="p-4 border-t bg-gray-50/50">
                <div className="flex items-center gap-3 px-3 py-2">
                    <UserCircle className="w-8 h-8 text-gray-400" />
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{clientName}</span>
                        <span className="text-xs text-gray-500 truncate">Administrator</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function NavItem({ icon: Icon, label, active, onClick }: {
    icon: any,
    label: string,
    active: boolean,
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                active
                    ? "bg-primary/10 text-primary"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    )
}
