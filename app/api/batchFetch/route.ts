import { type NextRequest, NextResponse } from "next/server"

// Get the base URL from environment variable
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

import { DATA_REFRESH_INTERVAL } from "@/config/site"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { sportCode, requests } = body

        if (!sportCode || !Array.isArray(requests)) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        }

        const dynamicBaseUrl = `${BASE_URL}/${sportCode}`
        const results: Record<string, any> = {}

        await Promise.all(
            requests.map(async (req: any) => {
                const { key, type, directory, eventCode, phaseId } = req
                let url = ""

                if (type === "sysData") {
                    url = `${dynamicBaseUrl}/sysData.txt`
                } else {
                    // Standard getSysData logic
                    url = `${dynamicBaseUrl}/${directory}/`
                    if (directory === "dualPhaseMatch" && phaseId) {
                        url += `${phaseId}.txt`
                    } else if (directory === "eventState") {
                        url += "eventState.txt"
                    } else {
                        url += `${eventCode}.txt`
                    }
                }

                try {
                    const response = await fetch(url, { next: { revalidate: DATA_REFRESH_INTERVAL } })
                    if (!response.ok) {
                        results[key] = { error: true, status: response.status }
                    } else {
                        const data = await response.json()
                        results[key] = data
                    }
                } catch (error) {
                    console.error(`Error fetching ${key} (${url}):`, error)
                    results[key] = { error: true, message: String(error) }
                }
            })
        )

        return NextResponse.json(results)
    } catch (error) {
        console.error("Error in batchFetch:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
