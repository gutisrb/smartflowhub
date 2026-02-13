"use client"

interface CandidatesModuleProps {
    clientId: string
}

export function CandidatesModule({ clientId }: CandidatesModuleProps) {
    return (
        <div className="p-8 text-center text-gray-500">
            <h2 className="text-xl font-semibold mb-2">Candidates</h2>
            <p>Module under construction for client: {clientId}</p>
        </div>
    )
}
