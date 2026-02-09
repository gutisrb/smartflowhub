
import { createClient } from './client'

export async function getClients() {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching clients:', error)
        return []
    }
    return data
}

export async function createNewClient(name: string, email?: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('clients')
        .insert([{ name, email }])
        .select()
        .single()

    if (error) {
        console.error('Error creating client:', error)
        return null
    }
    return data
}

export async function getJobsByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching jobs:', error)
        return []
    }
    return data
}

export async function createJob(jobData: any) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('jobs')
        .insert([jobData])
        .select()
        .single()

    if (error) {
        console.error('Error creating job:', error)
        throw error
    }
    return data
}

export async function getLeadsByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('kontakti')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching leads:', error)
        return []
    }
    return data
}
