"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, TrendingUp, Users, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface EmailOutreachModuleProps {
  clientId: string
}

interface EmailStats {
  total_sent: number
  total_opened: number
  total_replied: number
  positive_replies: number
  meetings_booked: number
  open_rate_pct: number
  reply_rate_pct: number
}

interface Lead {
  id: string
  full_name: string
  email: string
  company: string
  lead_source: string
  cold_email_subject: string
  email_sent_at: string
  email_opened: boolean
  email_replied: boolean
  email_reply_sentiment: string | null
  status: string
}

export function EmailOutreachModule({ clientId }: EmailOutreachModuleProps) {
  const [stats, setStats] = useState<EmailStats>({
    total_sent: 0,
    total_opened: 0,
    total_replied: 0,
    positive_replies: 0,
    meetings_booked: 0,
    open_rate_pct: 0,
    reply_rate_pct: 0
  })
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clientId) {
      fetchEmailStats()
      fetchLeads()
    }
  }, [clientId])

  const fetchEmailStats = async () => {
    const supabase = createClient()

    // Get aggregated stats for last 7 days
    const { data, error } = await supabase
      .from('email_outreach_stats')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching email stats:', error)
      return
    }

    if (data && data.length > 0) {
      // Aggregate stats from all rows
      const aggregated = data.reduce((acc, row) => ({
        total_sent: acc.total_sent + (row.total_sent || 0),
        total_opened: acc.total_opened + (row.total_opened || 0),
        total_replied: acc.total_replied + (row.total_replied || 0),
        positive_replies: acc.positive_replies + (row.positive_replies || 0),
        meetings_booked: acc.meetings_booked + (row.meetings_booked || 0),
        open_rate_pct: 0, // Will calculate after
        reply_rate_pct: 0
      }), {
        total_sent: 0,
        total_opened: 0,
        total_replied: 0,
        positive_replies: 0,
        meetings_booked: 0,
        open_rate_pct: 0,
        reply_rate_pct: 0
      })

      // Calculate percentages
      aggregated.open_rate_pct = aggregated.total_sent > 0
        ? Math.round((aggregated.total_opened / aggregated.total_sent) * 100)
        : 0
      aggregated.reply_rate_pct = aggregated.total_sent > 0
        ? Math.round((aggregated.total_replied / aggregated.total_sent) * 100)
        : 0

      setStats(aggregated)
    }
  }

  const fetchLeads = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('oz_avala_lead_pipeline')
      .select('*')
      .eq('client_id', clientId)
      .eq('lead_source', 'cold_email')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching leads:', error)
      setLoading(false)
      return
    }

    setLeads(data || [])
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "success" | "destructive"> = {
      'Novi': 'default',
      'Zainteresovan': 'success',
      'Not Interested': 'destructive'
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null
    const variants: Record<string, "default" | "secondary" | "success" | "destructive"> = {
      'positive': 'success',
      'negative': 'destructive',
      'neutral': 'secondary'
    }
    return <Badge variant={variants[sentiment] || 'secondary'}>{sentiment}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Outreach</h2>
          <p className="text-muted-foreground">Cold email campaigns and lead tracking</p>
        </div>
        <Button onClick={fetchLeads}>
          <Mail className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent (7d)</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_sent}</div>
            <p className="text-xs text-muted-foreground">
              {stats.open_rate_pct}% open rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replies</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_replied}</div>
            <p className="text-xs text-muted-foreground">
              {stats.reply_rate_pct}% reply rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Replies</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.positive_replies}</div>
            <p className="text-xs text-muted-foreground">
              Interested leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.meetings_booked}</div>
            <p className="text-xs text-muted-foreground">
              From email outreach
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Cold Email Leads</CardTitle>
          <CardDescription>Last 50 leads from email outreach campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No email leads yet. Workflow will populate data automatically.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Replied</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.full_name}</TableCell>
                    <TableCell>{lead.company}</TableCell>
                    <TableCell className="max-w-xs truncate" title={lead.cold_email_subject}>
                      {lead.cold_email_subject || '-'}
                    </TableCell>
                    <TableCell>{formatDate(lead.email_sent_at)}</TableCell>
                    <TableCell>
                      {lead.email_opened ? (
                        <Badge variant="success">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.email_replied ? (
                        <Badge variant="success">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getSentimentBadge(lead.email_reply_sentiment)}</TableCell>
                    <TableCell>{getStatusBadge(lead.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Campaign Info */}
      <Card>
        <CardHeader>
          <CardTitle>Active Campaigns</CardTitle>
          <CardDescription>Email outreach campaigns powered by Instantly.ai</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Cold Email Q1 2026</p>
                <p className="text-sm text-muted-foreground">Construction & Engineering companies in Serbia</p>
              </div>
              <Badge>Active</Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>📊 Target: 100-150 emails/day</p>
              <p>🎯 Focus: Company owners, HR managers, Project managers</p>
              <p>📍 Location: Belgrade, Novi Sad, Serbia</p>
              <p>✉️ Platform: Instantly.ai (high deliverability)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
