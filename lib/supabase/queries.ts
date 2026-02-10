
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

export async function getCandidatesByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching candidates:', error)
        return []
    }
    return data
}

export async function createCandidate(candidateData: any) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('candidates')
        .insert([candidateData])
        .select()
        .single()

    if (error) {
        console.error('Error creating candidate:', error)
        throw error
    }
    return data
}

export async function updateCandidate(id: string, candidateData: any) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('candidates')
        .update(candidateData)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('Error updating candidate:', error)
        throw error
    }
    return data
}

export async function deleteCandidate(id: string) {
    const supabase = createClient()
    const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting candidate:', error)
        throw error
    }
    return true
}
