"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Send, Users, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmailOutreachModuleProps {
  clientId: string
}

export function EmailOutreachModule({ clientId }: EmailOutreachModuleProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Outreach</h2>
          <p className="text-muted-foreground">Automated email campaigns and outreach tracking</p>
        </div>
        <Button disabled>
          <Send className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon Message */}
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle>Email Outreach Module</CardTitle>
          <CardDescription>
            This module is under development. It will include:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Create and manage email campaigns</li>
            <li>Track opens, clicks, and replies</li>
            <li>Automated follow-up sequences</li>
            <li>Email template library</li>
            <li>Integration with n8n workflows</li>
            <li>Contact segmentation and targeting</li>
          </ul>
          <div className="mt-6">
            <p className="text-sm text-muted-foreground italic">
              Contact your administrator to activate this module with custom workflows.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
