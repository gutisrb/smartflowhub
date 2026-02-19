
export interface ClientModuleConfig {
    crm: {
        enabled: boolean
        tableName: string
        statuses: string[]
        showAgencyMetrics: boolean // Priority Score, etc.
    }
    emailOutreach: {
        enabled: boolean
        tableName: string
        useMockData?: boolean // For presentation/pitch purposes
    }
    chatbot: {
        enabled: boolean
        platform: string
    }
}

export interface ClientConfig {
    id: string
    name: string
    email: string
    workflowPrefix: string
    modules: ClientModuleConfig
}

export const CLIENT_CONFIGS: Record<string, ClientConfig> = {
    "office@ozavala.co.rs": {
        id: "7ac02189-d0ec-4532-baa6-d7d4dc84b87c", // OZ Avala ID
        name: "OZ Avala",
        email: "office@ozavala.co.rs",
        workflowPrefix: "OZ Avala",
        modules: {
            crm: {
                enabled: true,
                tableName: "kontakti",
                statuses: ["Novi Lead", "Kontaktiran", "Intervju Zakazan", "Ponuda Poslata", "Zaposlen", "Odbijen", "Lost"],
                showAgencyMetrics: false
            },
            emailOutreach: {
                enabled: true,
                tableName: "kontakti", // Corrected: All workflows use 'kontakti'
                useMockData: true // Placeholder for pitch as requested
            },
            chatbot: {
                enabled: true,
                platform: "website"
            }
        }
    },
    "nikola@smartflow.rs": {
        id: "default-agency-id", // User's Agency ID
        name: "AI Growth Agency",
        email: "nikola@smartflow.rs",
        workflowPrefix: "AI Growth Agency",
        modules: {
            crm: {
                enabled: true,
                tableName: "kontakti",
                statuses: ["Novi Lead", "Kontaktiran", "Demo Scheduled - Video", "Meeting Booked", "Meeting Complete", "Closed", "Lost"],
                showAgencyMetrics: true
            },
            emailOutreach: {
                enabled: true,
                tableName: "kontakti" // Agency likely uses raw table or a different view
            },
            chatbot: {
                enabled: true,
                platform: "website"
            }
        }
    },
    // Fallback/Dev user
    "johhnylaa@gmail.com": {
        id: "default-agency-id",
        name: "AI Growth Agency (Dev)",
        email: "johhnylaa@gmail.com",
        workflowPrefix: "AI Growth Agency",
        modules: {
            crm: {
                enabled: true,
                tableName: "kontakti",
                statuses: ["Novi Lead", "Kontaktiran", "Demo Scheduled - Video", "Meeting Booked", "Meeting Complete", "Closed", "Lost"],
                showAgencyMetrics: true
            },
            emailOutreach: {
                enabled: true,
                tableName: "kontakti"
            },
            chatbot: {
                enabled: true,
                platform: "website"
            }
        }
    }
}

export const getClientConfig = (email: string | null | undefined): ClientConfig | null => {
    if (!email) return null
    return CLIENT_CONFIGS[email] || null // Strict: if not in config, no access (or handle generic)
}
