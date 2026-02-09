
"use client"

import { useState, useEffect } from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getClients, createNewClient } from "@/lib/supabase/queries"

interface ClientSelectorProps {
    selectedClientId: string | null
    onClientSelect: (clientId: string) => void
}

export function ClientSelector({ selectedClientId, onClientSelect }: ClientSelectorProps) {
    const [clients, setClients] = useState<any[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [newClientName, setNewClientName] = useState("")

    useEffect(() => {
        loadClients()
    }, [])

    const loadClients = async () => {
        const data = await getClients()
        setClients(data || [])
        // Select first client if none selected and clients exist
        if (!selectedClientId && data && data.length > 0) {
            onClientSelect(data[0].id)
        }
    }

    const handleCreateClient = async () => {
        if (!newClientName.trim()) return

        const newClient = await createNewClient(newClientName)
        if (newClient) {
            setClients([newClient, ...clients])
            onClientSelect(newClient.id) // Auto-select new client
            setNewClientName("")
            setIsDialogOpen(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Select value={selectedClientId || ""} onValueChange={onClientSelect}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent>
                    {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                            {client.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                        <PlusCircle className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Client</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={newClientName}
                                onChange={(e) => setNewClientName(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <Button onClick={handleCreateClient}>Create Client</Button>
                </DialogContent>
            </Dialog>
        </div>
    )
}
