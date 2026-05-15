
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

export async function updateJob(id: string, jobData: any) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('jobs')
        .update(jobData)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('Error updating job:', error)
        throw error
    }
    return data
}

export async function deleteJob(id: string) {
    const supabase = createClient()
    const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting job:', error)
        throw error
    }
    return true
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

// B2C candidates (mjob/Avala) — dedicated kandidati table
export async function getKandidatiByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('kandidati')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching kandidati:', error)
        return []
    }
    return data
}

export async function createKandidat(kandidatData: any) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('kandidati')
        .insert([kandidatData])
        .select()
        .single()

    if (error) {
        console.error('Error creating kandidat:', error)
        throw error
    }
    return data
}

export async function updateKandidat(id: string, updates: Record<string, any>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('kandidati')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('Error updating kandidat:', error)
        throw error
    }
    return data
}

export async function deleteKandidat(id: string) {
    const supabase = createClient()
    const { error } = await supabase
        .from('kandidati')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting kandidat:', error)
        throw error
    }
    return true
}

// Harmonija Knjige — CRM (interested buyers from DMs)
export async function getCrmHarmonijaByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('crm_harmonija')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching crm_harmonija:', error)
        return []
    }
    return data
}

// Harmonija Knjige — book catalog
export async function getKnjigeByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('knjige')
        .select('*')
        .eq('client_id', clientId)
        .order('naslov', { ascending: true })

    if (error) {
        console.error('Error fetching knjige:', error)
        return []
    }
    return data
}

// Publik Praktikum — CRM
export async function getCrmPublikByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('crm_publik')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
    if (error) { console.error('Error fetching crm_publik:', error); return [] }
    return data
}

// Stela Knjige — CRM
export async function getCrmStelaByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('crm_stela')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
    if (error) { console.error('Error fetching crm_stela:', error); return [] }
    return data
}

// Aleksandar MN — Product catalog
export async function getProizvodiByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('proizvodi')
        .select('*')
        .eq('client_id', clientId)
        .order('naziv', { ascending: true })
    if (error) { console.error('Error fetching proizvodi:', error); return [] }
    return data
}

// Maguna Dizajn — CRM
export async function getCrmMagunaByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('crm_maguna')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
    if (error) { console.error('Error fetching crm_maguna:', error); return [] }
    return data
}

// Aleksandar MN — CRM
export async function getCrmAleksandarMNByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('crm_aleksandarmn')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
    if (error) { console.error('Error fetching crm_aleksandarmn:', error); return [] }
    return data
}

// Module Management
export async function getClientModules(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('client_modules')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_enabled', true)
        .order('sort_order', { ascending: true, nullsFirst: false })

    if (error) {
        console.error('Error fetching client modules:', error)
        return []
    }
    return data
}

export async function enableModuleForClient(clientId: string, moduleKey: string, displayName?: string, sortOrder?: number) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('client_modules')
        .insert([{
            client_id: clientId,
            module_key: moduleKey,
            is_enabled: true,
            display_name: displayName,
            sort_order: sortOrder
        }])
        .select()
        .single()

    if (error) {
        console.error('Error enabling module:', error)
        throw error
    }
    return data
}

export async function disableModuleForClient(clientId: string, moduleKey: string) {
    const supabase = createClient()
    const { error } = await supabase
        .from('client_modules')
        .update({ is_enabled: false })
        .eq('client_id', clientId)
        .eq('module_key', moduleKey)

    if (error) {
        console.error('Error disabling module:', error)
        throw error
    }
    return true
}

export async function getServicesCatalogByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('services_catalog')
        .select('*')
        .eq('client_id', clientId)
        .order('sort_order', { ascending: true })
    if (error) { console.error('Error fetching services_catalog:', error); return [] }
    return data ?? []
}

export async function getDemoCrmByClientId(clientId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('demo_crm')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
    if (error) { console.error('Error fetching demo_crm:', error); return [] }
    return data ?? []
}

export async function getAppointmentsByClientId(clientId: string, fromDate?: string, toDate?: string) {
    const supabase = createClient()
    let query = supabase
        .from('appointments')
        .select('*')
        .eq('client_id', clientId)
        .order('starts_at', { ascending: true })
    if (fromDate) query = query.gte('starts_at', fromDate)
    if (toDate) query = query.lte('starts_at', toDate)
    const { data, error } = await query
    if (error) { console.error('Error fetching appointments:', error); return [] }
    return data ?? []
}

export async function updateDemoCrmStatus(id: string, status: string) {
    const supabase = createClient()
    const { error } = await supabase.from('demo_crm').update({ status }).eq('id', id)
    if (error) throw error
}

export async function updateAppointmentStatus(id: string, status: 'confirmed' | 'cancelled' | 'completed' | 'no_show') {
    const supabase = createClient()
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (error) throw error
}

export async function updateServiceAvailability(id: string, isActive: boolean) {
    const supabase = createClient()
    const { error } = await supabase.from('services_catalog').update({ is_active: isActive }).eq('id', id)
    if (error) throw error
}

export async function updateServicePrice(id: string, priceMin: number, priceMax: number) {
    const supabase = createClient()
    const { error } = await supabase.from('services_catalog').update({ price_min: priceMin, price_max: priceMax }).eq('id', id)
    if (error) throw error
}
