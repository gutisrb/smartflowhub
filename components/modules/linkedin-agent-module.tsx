"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Linkedin, Users, MessageSquare, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LinkedInAgentModuleProps {
  clientId: string
}

export function LinkedInAgentModule({ clientId }: LinkedInAgentModuleProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">LinkedIn Agent</h2>
          <p className="text-muted-foreground">Automated LinkedIn outreach and lead generation</p>
        </div>
        <Button disabled>
          <MessageSquare className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Leads</CardTitle>
            <Linkedin className="h-4 w-4 text-muted-foreground" />
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
          <CardTitle>LinkedIn Automation Module</CardTitle>
          <CardDescription>
            This module will automate your LinkedIn outreach and lead generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Automated connection requests with personalized messages</li>
            <li>Intelligent lead targeting based on criteria</li>
            <li>Follow-up message sequences</li>
            <li>Profile visit tracking</li>
            <li>Post engagement automation</li>
            <li>Lead scoring and qualification</li>
            <li>Integration with Business CRM</li>
          </ul>
          <div className="mt-6">
            <p className="text-sm text-muted-foreground italic">
              Contact your administrator to activate this module with custom n8n workflows.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
