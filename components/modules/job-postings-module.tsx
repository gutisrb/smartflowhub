"use client"

interface JobPostingsModuleProps {
    clientId: string
}

export function JobPostingsModule({ clientId }: JobPostingsModuleProps) {
    return (
        <div className="p-8 text-center text-gray-500">
            <h2 className="text-xl font-semibold mb-2">Job Postings</h2>
            <p>Module under construction for client: {clientId}</p>
        </div>
    )
}
