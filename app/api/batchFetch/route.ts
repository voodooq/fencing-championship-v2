import { type NextRequest, NextResponse } from "next/server"

// Get the base URL from environment variable
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

import { DATA_REFRESH_INTERVAL } from "@/config/site"

// Basic in-memory cache
const memoryCache: Record<string, { data: any; expiry: number }> = {}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { sportCode, requests } = body

        if (!sportCode || !Array.isArray(requests)) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        }

        const dynamicBaseUrl = `${BASE_URL}/${sportCode}`
        const results: Record<string, any> = {}
        const now = Date.now()
        const cacheDuration = (DATA_REFRESH_INTERVAL || 15) * 1000

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        try {
            await Promise.all(
                requests.map(async (req: any) => {
                    const { key, type, directory, eventCode, phaseId } = req
                    let url = ""

                    if (type === "sysData") {
                        url = `${dynamicBaseUrl}/sysData.txt`
                    } else {
                        url = `${dynamicBaseUrl}/${directory}/`
                        if (directory === "dualPhaseMatch" && phaseId) {
                            url += `${phaseId}.txt`
                        } else if (directory === "eventState") {
                            url += "eventState.txt"
                        } else {
                            url += `${eventCode}.txt`
                        }
                    }

                    // Check cache first
                    if (memoryCache[url] && memoryCache[url].expiry > now) {
                        results[key] = memoryCache[url].data
                        return
                    }

                    try {
                        const response = await fetch(url, {
                            next: { revalidate: DATA_REFRESH_INTERVAL },
                            signal: controller.signal
                        })
                        if (!response.ok) {
                            results[key] = { error: true, status: response.status }
                        } else {
                            const data = await response.json()
                            results[key] = data
                            // Store in cache
                            memoryCache[url] = { data, expiry: now + cacheDuration }
                        }
                    } catch (error) {
                        if (error instanceof Error && error.name === 'AbortError') {
                            results[key] = { error: true, message: "Request timeout" }
                        } else {
                            console.error(`Error fetching ${key} (${url}):`, error)
                            results[key] = { error: true, message: String(error) }
                        }
                    }
                })
            )
        } finally {
            clearTimeout(timeoutId)
        }

        return NextResponse.json(results)
    } catch (error) {
        console.error("Error in batchFetch:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
