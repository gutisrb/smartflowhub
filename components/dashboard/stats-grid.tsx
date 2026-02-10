
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CalendarCheck, CheckCircle2, DollarSign, Clock } from "lucide-react"

interface StatsGridProps {
    stats: {
        totalLeads: number
        bookingRate: number
        showUpRate: number
        conversionRate: number
    }
}

export function StatsGrid({ stats }: StatsGridProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ukupno Leadova</CardTitle>
                    <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalLeads}</div>
                    <p className="text-xs text-muted-foreground italic">Svi kanali (Form/Bot)</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-orange-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Booking Rate</CardTitle>
                    <CalendarCheck className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.bookingRate}%</div>
                    <p className="text-xs text-muted-foreground">Leads → Booked</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-purple-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Show-Up Rate</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.showUpRate}%</div>
                    <p className="text-xs text-muted-foreground">Booked → Complete</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conversion</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.conversionRate}%</div>
                    <p className="text-xs text-muted-foreground">Meetings → Closed</p>
                </CardContent>
            </Card>

        </div>
    )
}
