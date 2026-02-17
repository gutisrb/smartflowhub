"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Linkedin, Users, MessageSquare, TrendingUp, Calendar, CheckCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface LinkedInAgentModuleProps {
  clientId: string
}

interface LinkedInStats {
  connections_sent: number
  acceptance_rate: number
  new_leads: number
}

interface LinkedInPost {
  id: string
  post_text: string
  post_theme: string
  engagement_score: number
  status: string
  scheduled_for: string | null
  created_at: string
}

interface LinkedInLead {
  id: string
  full_name: string
  company: string
  connection_message: string
  connection_sent_at: string | null
  connection_accepted: boolean
  status: string
}

export function LinkedInAgentModule({ clientId }: LinkedInAgentModuleProps) {
  const [stats, setStats] = useState<LinkedInStats>({
    connections_sent: 0,
    acceptance_rate: 0,
    new_leads: 0
  })
  const [posts, setPosts] = useState<LinkedInPost[]>([])
  const [leads, setLeads] = useState<LinkedInLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clientId) {
      fetchLinkedInStats()
      fetchPosts()
      fetchLeads()
    }
  }, [clientId])

  const fetchLinkedInStats = async () => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('linkedin_outreach_stats')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching LinkedIn stats:', error)
      return
    }

    if (data && data.length > 0) {
      const aggregated = data.reduce((acc, row) => ({
        connections_sent: acc.connections_sent + (row.total_connections_sent || 0),
        acceptance_rate: 0,
        new_leads: 0
      }), {
        connections_sent: 0,
        acceptance_rate: 0,
        new_leads: 0
      })

      const totalAccepted = data.reduce((sum, row) => sum + (row.total_accepted || 0), 0)
      aggregated.acceptance_rate = aggregated.connections_sent > 0
        ? Math.round((totalAccepted / aggregated.connections_sent) * 100)
        : 0

      setStats({
        ...aggregated,
        new_leads: aggregated.connections_sent
      })
    }
  }

  const fetchPosts = async () => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('linkedin_content')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching posts:', error)
      return
    }

    setPosts(data || [])
  }

  const fetchLeads = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('oz_avala_lead_pipeline')
      .select('*')
      .eq('client_id', clientId)
      .eq('lead_source', 'linkedin_connection')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching leads:', error)
      setLoading(false)
      return
    }

    setLeads(data || [])
    setLoading(false)
  }

  const handleApprovePost = async (postId: string) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('linkedin_content')
      .update({ status: 'approved' })
      .eq('id', postId)

    if (error) {
      console.error('Error approving post:', error)
      return
    }

    fetchPosts()
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
      'draft': 'default',
      'approved': 'success',
      'scheduled': 'secondary',
      'published': 'success',
      'Novi': 'default'
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">LinkedIn Agent</h2>
          <p className="text-muted-foreground">Content posting & connection outreach</p>
        </div>
        <Button onClick={() => { fetchPosts(); fetchLeads(); }}>
          <Linkedin className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections Sent (7d)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.connections_sent}</div>
            <p className="text-xs text-muted-foreground">Mon-Fri 10AM automation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.acceptance_rate}%</div>
            <p className="text-xs text-muted-foreground">Connection acceptance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Posts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{posts.filter(p => p.status === 'draft').length}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Leads</CardTitle>
            <Linkedin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new_leads}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Calendar */}
      <Card>
        <CardHeader>
          <CardTitle>Content Calendar (2x/week)</CardTitle>
          <CardDescription>AI-generated LinkedIn posts for review</CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No posts yet. Workflow runs Tue & Thu at 9 AM.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post Preview</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-xs truncate font-medium" title={post.post_text}>
                      {post.post_text}
                    </TableCell>
                    <TableCell>{post.post_theme}</TableCell>
                    <TableCell>
                      <Badge variant={post.engagement_score >= 8 ? 'success' : 'default'}>
                        {post.engagement_score}/10
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell>{formatDate(post.created_at)}</TableCell>
                    <TableCell>
                      {post.status === 'draft' && (
                        <Button size="sm" onClick={() => handleApprovePost(post.id)}>
                          Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* LinkedIn Connection Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Outreach Leads</CardTitle>
          <CardDescription>Decision makers from LinkedIn connections (Daily 10AM)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No LinkedIn leads yet. Workflow runs Mon-Fri at 10 AM.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Connection Message</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.full_name}</TableCell>
                    <TableCell>{lead.company}</TableCell>
                    <TableCell className="max-w-xs truncate" title={lead.connection_message}>
                      {lead.connection_message}
                    </TableCell>
                    <TableCell>{formatDate(lead.connection_sent_at || '')}</TableCell>
                    <TableCell>
                      {lead.connection_accepted ? (
                        <Badge variant="success">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(lead.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Automation Info */}
      <Card>
        <CardHeader>
          <CardTitle>Active Automations</CardTitle>
          <CardDescription>LinkedIn workflows powered by n8n</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Content Posting</p>
                  <p className="text-sm text-muted-foreground">Tue & Thu at 9 AM</p>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Connection Outreach</p>
                  <p className="text-sm text-muted-foreground">Mon-Fri at 10 AM (10-15/day)</p>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
