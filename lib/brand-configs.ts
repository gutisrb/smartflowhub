/**
 * Config for all brand clients.
 * Modules use this to determine table names and UI labels
 * instead of hardcoded client ID checks.
 */

export interface BrandConfig {
    crmTable: string          // Supabase table name for CRM
    brandName: string         // Display name for the brand
    catalogLabel: string      // Label for the catalog tab
    crmLabel: string          // Label for the CRM tab
    color?: string            // Accent color for brand switcher
    websiteUrl: string        // Domain (no protocol) for display + links
    instagramHandle: string   // Instagram handle incl. @
    /** 'knjige' = book catalog (naslov/autor/kategorije[]); 'proizvodi' = product catalog (naziv/brend/kategorija/cena) */
    tableType: 'knjige' | 'proizvodi'
    /** Singular item label shown in UI, e.g. "Knjiga" or "Proizvod" */
    catalogItemLabel: string
    /** Plural count label, e.g. "naslova" or "proizvoda" */
    catalogItemsLabel: string
    /** CRM "tema" column label, e.g. "Kategorija" or "Zdravstveni cilj" */
    crmTemaLabel: string
    /** CRM "knjiga/proizvod" column label, e.g. "Knjiga" or "Proizvod" */
    crmProizvodLabel: string
}

// Backward compat alias
export type BookStoreConfig = BrandConfig

export const BRAND_CONFIGS: Record<string, BrandConfig> = {
    // Harmonija Knjige
    "255db627-c62b-44ce-a9dc-3a7e90dd1b67": {
        crmTable:          "crm_harmonija",
        brandName:         "Harmonija Knjige",
        catalogLabel:      "Knjige",
        crmLabel:          "CRM",
        color:             "#10b981",
        websiteUrl:        "harmonijaknjige.rs",
        instagramHandle:   "@harmonija_knjige",
        tableType:         "knjige",
        catalogItemLabel:  "Knjiga",
        catalogItemsLabel: "naslova",
        crmTemaLabel:      "Kategorija",
        crmProizvodLabel:  "Knjiga",
    },
    // Publik Praktikum
    "bd12eb98-e62a-4a87-b620-a9881081449b": {
        crmTable:          "crm_publik",
        brandName:         "Publik Praktikum",
        catalogLabel:      "Knjige",
        crmLabel:          "CRM",
        color:             "#f59e0b",
        websiteUrl:        "publikpraktikum.rs",
        instagramHandle:   "@publikpraktikum",
        tableType:         "knjige",
        catalogItemLabel:  "Knjiga",
        catalogItemsLabel: "naslova",
        crmTemaLabel:      "Kategorija",
        crmProizvodLabel:  "Knjiga",
    },
    // Stela Knjige
    "d7337d00-db70-46c3-828b-e9ac82e21717": {
        crmTable:          "crm_stela",
        brandName:         "Stela Knjige",
        catalogLabel:      "Knjige",
        crmLabel:          "CRM",
        color:             "#a78bfa",
        websiteUrl:        "stelaknjige.rs",
        instagramHandle:   "@stela_knjige",
        tableType:         "knjige",
        catalogItemLabel:  "Knjiga",
        catalogItemsLabel: "naslova",
        crmTemaLabel:      "Kategorija",
        crmProizvodLabel:  "Knjiga",
    },
    // Maguna Dizajn — sklopivi stolovi, dečiji nameštaj, stočići za šminkanje
    "0c25e7c2-360c-418a-816a-34444d304698": {
        crmTable:          "crm_maguna",
        brandName:         "Maguna Dizajn",
        catalogLabel:      "Stolovi",
        crmLabel:          "Kupci",
        color:             "#f97316",  // orange
        websiteUrl:        "maguna.rs",
        instagramHandle:   "@magunadizajn",
        tableType:         "proizvodi",
        catalogItemLabel:  "Proizvod",
        catalogItemsLabel: "proizvoda",
        crmTemaLabel:      "Kategorija",
        crmProizvodLabel:  "Proizvod",
    },
    // Aleksandar MN — Prevencija i Terapija
    "3255f279-801c-474b-9c16-a75edc336296": {
        crmTable:          "crm_aleksandarmn",
        brandName:         "Aleksandar MN",
        catalogLabel:      "Proizvodi",
        crmLabel:          "Kupci",
        color:             "#3b82f6",  // blue
        websiteUrl:        "aleksandarmn.com",
        instagramHandle:   "@aleksandar.mn",
        tableType:         "proizvodi",
        catalogItemLabel:  "Proizvod",
        catalogItemsLabel: "proizvoda",
        crmTemaLabel:      "Zdravstveni cilj",
        crmProizvodLabel:  "Proizvod",
    },
}

// Backward compat alias
export const BOOK_STORE_CLIENTS = BRAND_CONFIGS

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

export function getBrandConfig(clientId: string | null | undefined): BrandConfig | null {
    if (!clientId) return null
    return BRAND_CONFIGS[clientId] ?? null
}

// Backward compat alias
export const getBookStoreConfig = getBrandConfig

export function getGroupBrands(clientId: string | null | undefined): BrandConfig[] {
    if (!clientId) return []
    const childIds = GROUP_CLIENTS[clientId]
    if (!childIds) return []
    return childIds.map(id => BRAND_CONFIGS[id]).filter(Boolean)
}

export function isGroupClient(clientId: string | null | undefined): boolean {
    if (!clientId) return false
    return clientId in GROUP_CLIENTS
}
