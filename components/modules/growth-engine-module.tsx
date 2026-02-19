"use client"

import { MultiTenantCRMModule } from "@/components/modules/multi-tenant-crm-module"
import { EmailOutreachModule } from "@/components/modules/email-outreach-module"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface GrowthEngineModuleProps {
    clientId: string
    crmSettings: {
        tableName: string
        statuses: string[]
        showAgencyMetrics: boolean
    }
    emailSettings: {
        tableName: string
        useMockData?: boolean
    }
}

export function GrowthEngineModule({ clientId, crmSettings, emailSettings }: GrowthEngineModuleProps) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Growth Engine</h2>
                <p className="text-muted-foreground">
                    Unified view of your lead acquisition and management system.
                </p>
            </div>

            <Tabs defaultValue="outreach" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="outreach">Email Outreach</TabsTrigger>
                    <TabsTrigger value="crm">Business CRM</TabsTrigger>
                </TabsList>

                <TabsContent value="outreach" className="space-y-8">
                    {/* Email Outreach Stats (Top of Funnel) */}
                    <section>
                        <EmailOutreachModule
                            clientId={clientId}
                            tableName={emailSettings.tableName}
                            useMockData={emailSettings.useMockData}
                        />
                    </section>
                </TabsContent>

                <TabsContent value="crm" className="space-y-8">
                    {/* CRM Table (Bottom of Funnel) */}
                    <section>
                        <MultiTenantCRMModule
                            clientId={clientId}
                            tableName={crmSettings.tableName}
                            statuses={crmSettings.statuses}
                            showAgencyMetrics={crmSettings.showAgencyMetrics}
                        />
                    </section>
                </TabsContent>
            </Tabs>
        </div>
    )
}
