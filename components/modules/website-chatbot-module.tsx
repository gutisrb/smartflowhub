"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Users, Clock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WebsiteChatbotModuleProps {
  clientId: string
}

export function WebsiteChatbotModule({ clientId }: WebsiteChatbotModuleProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Website Chatbot</h2>
          <p className="text-muted-foreground">Manage website chatbot conversations and leads</p>
        </div>
        <Button disabled>
          <MessageCircle className="w-4 h-4 mr-2" />
          View Conversations
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Chats</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Generated</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
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
          <CardTitle>Website Chatbot Management</CardTitle>
          <CardDescription>
            Monitor and manage your website chatbot interactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Real-time chat conversation viewer</li>
            <li>Automated lead qualification</li>
            <li>Chat transcript export</li>
            <li>Visitor behavior tracking</li>
            <li>Custom chatbot responses and flows</li>
            <li>Integration with CRM for seamless lead handoff</li>
            <li>Analytics on chat performance and conversion</li>
          </ul>
          <div className="mt-6">
            <p className="text-sm text-muted-foreground italic">
              Contact your administrator to activate this module with custom chatbot workflows.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
