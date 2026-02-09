
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, CheckCircle, Percent } from "lucide-react"

interface StatsGridProps {
    stats: {
        totalLeads: number
        poslatePrijave: number
        zaposleni: number
        prosekPrijava: number
    }
}

export function StatsGrid({ stats }: StatsGridProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ukupno Leadova</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalLeads}</div>
                    <p className="text-xs text-muted-foreground">Svi aktivni leadovi</p>
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Poslate Prijave</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.poslatePrijave}</div>
                    <p className="text-xs text-muted-foreground">Status 'Prijavljen'</p>
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Zaposleni</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.zaposleni}</div>
                    <p className="text-xs text-muted-foreground">Uspešno zaposleni</p>
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Prosek Prijava</CardTitle>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.prosekPrijava}%</div>
                    <p className="text-xs text-muted-foreground">Stopa konverzije</p>
                </CardContent>
            </Card>
        </div>
    )
}
