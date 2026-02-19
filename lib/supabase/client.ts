import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Handle missing environment variables during build/prerendering
    if (!supabaseUrl || !supabaseAnonKey) {
        // We only want to warn in production if they are still missing
        if (process.env.NODE_ENV === 'production') {
            console.warn('Supabase environment variables are missing. Using placeholders to prevent build crash.')
        }
        return createBrowserClient(
            supabaseUrl || 'https://placeholder.supabase.co',
            supabaseAnonKey || 'placeholder'
        )
    }

    if (!client) {
        client = createBrowserClient(supabaseUrl, supabaseAnonKey)
    }
    return client
}

