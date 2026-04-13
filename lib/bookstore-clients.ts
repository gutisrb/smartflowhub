/**
 * Config for all book-store clients.
 * Modules use this to determine table names and UI labels
 * instead of hardcoded client ID checks.
 */

export interface BookStoreConfig {
    crmTable: string          // Supabase table name for CRM
    brandName: string         // Display name for the brand
    catalogLabel: string      // Label for the catalog tab
    crmLabel: string          // Label for the CRM tab
    color?: string            // Accent color for brand switcher
    websiteUrl: string        // Domain (no protocol) for display + links
    instagramHandle: string   // Instagram handle incl. @
}

export const BOOK_STORE_CLIENTS: Record<string, BookStoreConfig> = {
    // Harmonija Knjige
    "255db627-c62b-44ce-a9dc-3a7e90dd1b67": {
        crmTable:        "crm_harmonija",
        brandName:       "Harmonija Knjige",
        catalogLabel:    "Knjige",
        crmLabel:        "CRM",
        color:           "#10b981",  // emerald
        websiteUrl:      "harmonijaknjige.rs",
        instagramHandle: "@harmonija_knjige",
    },
    // Publik Praktikum
    "bd12eb98-e62a-4a87-b620-a9881081449b": {
        crmTable:        "crm_publik",
        brandName:       "Publik Praktikum",
        catalogLabel:    "Knjige",
        crmLabel:        "CRM",
        color:           "#f59e0b",  // amber
        websiteUrl:      "publikpraktikum.rs",
        instagramHandle: "@publikpraktikum",
    },
    // Stela Knjige
    "d7337d00-db70-46c3-828b-e9ac82e21717": {
        crmTable:        "crm_stela",
        brandName:       "Stela Knjige",
        catalogLabel:    "Knjige",
        crmLabel:        "CRM",
        color:           "#a78bfa",  // violet
        websiteUrl:      "stelaknjige.rs",
        instagramHandle: "@stela_knjige",
    },
}

/**
 * Group client — one login that can switch between child brands.
 * Key = group client ID, value = ordered list of child client IDs.
 */
export const GROUP_CLIENTS: Record<string, string[]> = {
    // Harmonija Group (demo@harmonijagroup.rs)
    "c29e88ad-ee07-44ae-93bb-886f850b6d02": [
        "255db627-c62b-44ce-a9dc-3a7e90dd1b67",  // Harmonija Knjige
        "bd12eb98-e62a-4a87-b620-a9881081449b",  // Publik Praktikum
        "d7337d00-db70-46c3-828b-e9ac82e21717",  // Stela Knjige
    ],
}

export function getBookStoreConfig(clientId: string | null | undefined): BookStoreConfig | null {
    if (!clientId) return null
    return BOOK_STORE_CLIENTS[clientId] ?? null
}

export function getGroupBrands(clientId: string | null | undefined): BookStoreConfig[] {
    if (!clientId) return []
    const childIds = GROUP_CLIENTS[clientId]
    if (!childIds) return []
    return childIds.map(id => BOOK_STORE_CLIENTS[id]).filter(Boolean)
}

export function isGroupClient(clientId: string | null | undefined): boolean {
    if (!clientId) return false
    return clientId in GROUP_CLIENTS
}
