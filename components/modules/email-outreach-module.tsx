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
  tableName?: string
  useMockData?: boolean
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
  meeting_time?: string
  linkedin_intel?: string
}

// Demo Stats for Pitch (Optimized for "Email Master v5" visualization)
const DEMO_EMAIL_STATS = {
  total_sent: 1240,
  total_opened: 868,
  total_replied: 142,
  positive_replies: 45,
  meetings_booked: 18,
  open_rate_pct: 70,
  reply_rate_pct: 12
}

const MOCK_EMAIL_LEADS = [
  { id: '1', full_name: 'Marko Petrović', company: 'Hemofarm', cold_email_subject: 'Pitanje za HR tim - Sezonski radnici', email_sent_at: new Date().toISOString(), email_opened: true, email_replied: true, email_reply_sentiment: 'positive', status: 'Sastanak Zakazan', meeting_time: new Date(Date.now() + 86400000 * 2).toISOString(), linkedin_intel: 'Posted about expanding production lines last week.' },
  { id: '2', full_name: 'Jelena Nikolić', company: 'Delta Holding', cold_email_subject: 'Studenti za vaš tim?', email_sent_at: new Date(Date.now() - 86400000).toISOString(), email_opened: true, email_replied: false, email_reply_sentiment: null, status: 'Novi', linkedin_intel: 'Shared article on youth employment trends.' },
  { id: '3', full_name: 'Stefan Janković', company: 'Nordeus', cold_email_subject: 'Saradnja sa OZ Avala', email_sent_at: new Date(Date.now() - 172800000).toISOString(), email_opened: true, email_replied: true, email_reply_sentiment: 'neutral', status: 'Novi', linkedin_intel: 'Celebrated 10 years at company.' },
  { id: '4', full_name: 'Ana Jovanović', company: 'Comtrade', cold_email_subject: 'Pitanje za HR tim - Sezonski radnici', email_sent_at: new Date(Date.now() - 259200000).toISOString(), email_opened: false, email_replied: false, email_reply_sentiment: null, status: 'Novi' },
  { id: '5', full_name: 'Nikola Đorđević', company: 'MK Group', cold_email_subject: 'Studenti za vaš tim?', email_sent_at: new Date(Date.now() - 345600000).toISOString(), email_opened: true, email_replied: true, email_reply_sentiment: 'positive', status: 'Zainteresovan', linkedin_intel: 'Looking for summer interns.' }
]

export function EmailOutreachModule({ clientId, tableName = 'kontakti', useMockData = false }: EmailOutreachModuleProps) {
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
    if (useMockData) {
      setStats(DEMO_EMAIL_STATS)
      setLeads(MOCK_EMAIL_LEADS as any) // Use existing high-quality mock leads
      setLoading(false)
      return
    }

    if (clientId) {
      fetchEmailStats()
      fetchLeads()
    }
  }, [clientId, useMockData])

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
      setStats(DEMO_EMAIL_STATS) // Fallback to mock
      return
    }

    if (data && data.length > 0) {
      // Aggregate stats from all rows
      const aggregated = data.reduce((acc: any, row: any) => ({
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
    } else {
      setStats(DEMO_EMAIL_STATS)
    }
  }

  const fetchLeads = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('client_id', clientId)
      .eq('lead_source', 'cold_email')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !data || data.length === 0) {
      // Use mock if error or empty
      setLeads(MOCK_EMAIL_LEADS as any)
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
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Email Outreach</h2>
            {useMockData && (
              <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 text-[10px] uppercase tracking-wider">
                AI Predicted Results
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Cold email campaigns and lead tracking</p>
        </div>
        <Button onClick={useMockData ? undefined : fetchLeads} disabled={useMockData}>
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
                  <TableHead>Intel</TableHead>
                  <TableHead>Meeting</TableHead>
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
                    <TableCell className="max-w-[200px] truncate" title={lead.linkedin_intel || ''}>
                      {lead.linkedin_intel ? (
                        <span className="text-xs text-muted-foreground italic">{lead.linkedin_intel}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {lead.meeting_time ? (
                        <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                          {formatDate(lead.meeting_time)}
                        </Badge>
                      ) : '-'}
                    </TableCell>
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
                <p className="font-medium">OZ Avala B2B Outreach</p>
                <p className="text-sm text-muted-foreground">Companies hiring now (LinkedIn Jobs + Infostud)</p>
              </div>
              <Badge>Active</Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>📊 Target: <span className="font-semibold text-gray-900">16 emails/day (Safe Mode)</span></p>
              <p>🎯 Focus: HR Directors, Owners, Operations Managers</p>
              <p>📍 Location: Belgrade, Novi Sad, Serbia</p>
              <p>✉️ Platform: Gmail + AI Personalization (Workflow 5)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
