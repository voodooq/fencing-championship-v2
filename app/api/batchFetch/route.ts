import { type NextRequest, NextResponse } from "next/server"

// Get the base URL from environment variable
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

import { DATA_REFRESH_INTERVAL } from "@/config/site"

// Basic in-memory cache
const memoryCache: Record<string, { data: any; expiry: number }> = {}
// Max items in cache to prevent memory pressure
const MAX_CACHE_ITEMS = 500
// Track active requests to collapse simultaneous identical requests
const inflightRequests: Record<string, Promise<any> | undefined> = {}

async function fetchWithCache(url: string, cacheDuration: number, signal?: AbortSignal) {
    const now = Date.now()

    // 1. SWR Logic: If cache exists but is expired, return stale data and revalidate in background
    if (memoryCache[url]) {
        if (memoryCache[url].expiry > now) {
            return memoryCache[url].data
        } else {
            // Stale data exists, start background revalidation
            console.log(`[SWR] Revalidating stale data: ${url}`)
            // Trigger background fetch (don't await it here)
            fetchWithCacheInternal(url, cacheDuration).catch(err => console.error(`[SWR] Background revalidation failed for ${url}:`, err))
            return memoryCache[url].data
        }
    }

    return fetchWithCacheInternal(url, cacheDuration, signal)
}

async function fetchWithCacheInternal(url: string, cacheDuration: number, signal?: AbortSignal) {
    // 2. Request Collapsing: If a request for this URL is already in flight, wait for it
    if (inflightRequests[url] !== undefined) {
        console.log(`[Collapsing] Sharing in-flight request: ${url}`)
        return inflightRequests[url]
    }

    const fetchPromise = (async () => {
        try {
            const response = await fetch(url, {
                next: { revalidate: Math.floor(cacheDuration / 1000) },
                signal: signal
            })

            // Handle 404 - Negative Caching
            if (response.status === 404) {
                const negativeCacheDuration = 5000 // Cache 404s for 5 seconds
                memoryCache[url] = {
                    data: { error: true, status: 404, message: "File not found" },
                    expiry: Date.now() + negativeCacheDuration
                }
                return memoryCache[url].data
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            const data = await response.json()

            // Basic LRU-like management: if cache too large, clear oldest (or just reset)
            if (Object.keys(memoryCache).length >= MAX_CACHE_ITEMS) {
                const oldestKey = Object.keys(memoryCache)[0]
                delete memoryCache[oldestKey]
            }

            memoryCache[url] = { data, expiry: Date.now() + cacheDuration }
            return data
        } finally {
            // Clean up inflight tracking
            delete inflightRequests[url]
        }
    })()

    inflightRequests[url] = fetchPromise
    return fetchPromise
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { sportCode, requests } = body

        if (!sportCode || !Array.isArray(requests)) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        }

        const dynamicBaseUrl = `${BASE_URL}/${sportCode}`
        const results: Record<string, any> = {}
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

                    try {
                        const data = await fetchWithCache(url, cacheDuration, controller.signal)
                        results[key] = data
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
