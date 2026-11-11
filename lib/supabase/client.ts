import { createBrowserClient } from '@supabase/ssr'
import { demoCookieStore, isDemoPreview } from './demo-preview'

let client: ReturnType<typeof createBrowserClient> | undefined
let demoClient: ReturnType<typeof createBrowserClient> | undefined

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

    // A tab opened by /api/demo-login keeps its session in sessionStorage instead
    // of cookies, so the operator stays signed in to their own dashboard in every
    // other tab. See lib/supabase/demo-preview.ts.
    if (isDemoPreview()) {
        if (!demoClient) {
            demoClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
                cookies: demoCookieStore,
                isSingleton: false,
            })
        }
        return demoClient
    }

    if (!client) {
        client = createBrowserClient(supabaseUrl, supabaseAnonKey)
    }
    return client
}
