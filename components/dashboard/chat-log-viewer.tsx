"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Instagram, Facebook, MessageCircle } from "lucide-react"

interface Message {
    id: string
    role: "user" | "assistant" | "system"
    message: string
    created_at: string
    platform: string
}

interface ChatLogViewerProps {
    idRazgovora: string | null
    isOpen: boolean
    onClose: () => void
}

export function ChatLogViewer({ idRazgovora, isOpen, onClose }: ChatLogViewerProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (idRazgovora && isOpen) {
            fetchMessages()
        }
    }, [idRazgovora, isOpen])

    const fetchMessages = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("razgovori")
            .select("*")
            .eq("id_razgovora", idRazgovora)
            .order("created_at", { ascending: true })

        if (error) {
            console.error("Error fetching messages:", error)
        } else {
            setMessages(data || [])
        }
        setLoading(false)
    }

    const getPlatformIcon = (platform: string) => {
        switch (platform?.toLowerCase()) {
            case "instagram": return <Instagram className="h-4 w-4" />
            case "facebook": return <Facebook className="h-4 w-4" />
            case "whatsapp": return <MessageCircle className="h-4 w-4" />
            default: return <MessageCircle className="h-4 w-4" />
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] h-[70vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        Chat Logs for {idRazgovora}
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                        {messages.length === 0 && !loading && (
                            <div className="text-center py-8 text-muted-foreground">
                                Nema poruka za ovaj razgovor.
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.role === "assistant" ? "items-start" : "items-end"
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] text-muted-foreground uppercase opacity-70">
                                        {msg.role} • {new Date(msg.created_at).toLocaleTimeString()}
                                    </span>
                                    {getPlatformIcon(msg.platform)}
                                </div>
                                <div
                                    className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${msg.role === "assistant"
                                            ? "bg-muted text-muted-foreground"
                                            : "bg-primary text-primary-foreground"
                                        }`}
                                >
                                    {msg.message}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
