"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Users, ArrowUpRight } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { format } from "date-fns"

interface SocialChatbotModuleProps {
    clientId: string
}

export function SocialChatbotModule({ clientId }: SocialChatbotModuleProps) {
    const [conversations, setConversations] = useState<any[]>([])
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [stats, setStats] = useState({
        activeChats: 0,
        totalMessages: 0,
    })

    const supabase = createClient()

    // Fetch unique conversations (grouped by id_razgovora)
    const fetchConversations = useCallback(async () => {
        // This is a simplified query. In a real app, you'd likely have a separate 'conversations' table
        // or use a distinct query. For now, we'll fetch recent messages and group client-side.
        const { data, error } = await supabase
            .from('razgovori')
            .select('*')
            .eq('client_id', clientId)
            // .eq('platform', 'instagram') // Enable if platform column exists and is populated
            .order('created_at', { ascending: false })
            .limit(500)

        if (error) {
            console.error('Error fetching conversations:', error)
            return
        }

        // Group by conversation ID
        const grouped = data.reduce((acc: any, curr: any) => {
            const id = curr.id_razgovora
            if (!acc[id]) {
                acc[id] = {
                    id: id,
                    lastMessage: curr,
                    messages: [],
                    participant: curr.role === 'user' ? 'User' : 'Bot' // Simplification
                }
            }
            acc[id].messages.push(curr)
            return acc
        }, {})

        const conversationList = Object.values(grouped).sort((a: any, b: any) =>
            new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
        )

        setConversations(conversationList)
        setStats({
            activeChats: conversationList.length,
            totalMessages: data.length
        })
    }, [clientId, supabase])

    useEffect(() => {
        fetchConversations()

        const channel = supabase
            .channel(`social-chat-realtime-${clientId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "razgovori", filter: `client_id=eq.${clientId}` },
                () => fetchConversations()
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchConversations, clientId, supabase])

    // Select first conversation by default
    useEffect(() => {
        if (conversations.length > 0 && !selectedConversation) {
            setSelectedConversation(conversations[0].id)
        }
    }, [conversations, selectedConversation])

    const currentMessages = selectedConversation
        ? conversations.find(c => c.id === selectedConversation)?.messages.sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        : []

    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 shrink-0">
                <Card className="shadow-sm border-l-4 border-l-pink-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Chats</CardTitle>
                        <MessageCircle className="h-4 w-4 text-pink-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeChats}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-indigo-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalMessages}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Conversation List */}
                <Card className="col-span-4 flex flex-col overflow-hidden shadow-sm border-gray-200">
                    <div className="p-4 border-b bg-gray-50/50">
                        <h3 className="font-semibold text-gray-900">Inbox</h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="divide-y divide-gray-100">
                            {conversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv.id)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedConversation === conv.id ? 'bg-blue-50/50 border-l-2 border-blue-500' : ''}`}
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <span className="font-medium text-sm text-gray-900 truncate">Visitor {conv.id.substring(0, 8)}</span>
                                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                            {format(new Date(conv.lastMessage.created_at), 'MMM d, HH:mm')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate line-clamp-2">
                                        {conv.lastMessage.message}
                                    </p>
                                </div>
                            ))}
                            {conversations.length === 0 && (
                                <div className="p-8 text-center text-gray-400 text-sm">No conversations yet</div>
                            )}
                        </div>
                    </ScrollArea>
                </Card>

                {/* Chat View */}
                <Card className="col-span-8 flex flex-col overflow-hidden shadow-sm border-gray-200">
                    {selectedConversation ? (
                        <>
                            <div className="p-4 border-b bg-gray-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-pink-100 text-pink-600">IG</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm">Visitor {selectedConversation.substring(0, 8)}</h3>
                                        <p className="text-xs text-gray-500">Instagram DM</p>
                                    </div>
                                </div>
                            </div>
                            <ScrollArea className="flex-1 p-4 bg-white">
                                <div className="space-y-4">
                                    {currentMessages?.map((msg: any, i: number) => {
                                        const isUser = msg.role === 'user';
                                        return (
                                            <div key={i} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                                                <div
                                                    className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isUser
                                                            ? 'bg-gray-100 text-gray-900 rounded-tl-none'
                                                            : 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                                                        }`}
                                                >
                                                    <p>{msg.message}</p>
                                                    <span className={`text-[10px] mt-1 block opacity-70 ${isUser ? 'text-gray-500' : 'text-blue-100'}`}>
                                                        {format(new Date(msg.created_at), 'HH:mm')}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </ScrollArea>
                            {/* Disabled Input Area for Read-Only View */}
                            <div className="p-4 border-t bg-gray-50/30">
                                <div className="text-center text-xs text-gray-400 italic">
                                    This view is currently read-only. Reply via Instagram App.
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                            Select a conversation to view details
                        </div>
                    )}
                </Card>
            </div>
        </div>
    )
}
