import { type NextRequest, NextResponse } from "next/server"
import { SERVER_CACHE_DURATION, CDN_STALE_REVALIDATE } from "@/config/site"

// Get the base URL from environment variable
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

// NOTE: 内存缓存和请求合并，减少 OSS 回源
const memoryCache: Record<string, { data: any; expiry: number }> = {}
const inflightRequests: Record<string, Promise<any> | undefined> = {}

async function fetchWithCache(url: string): Promise<any> {
  const now = Date.now()
  const cacheDuration = SERVER_CACHE_DURATION * 1000

  if (memoryCache[url]) {
    if (memoryCache[url].expiry > now) {
      return memoryCache[url].data
    } else {
      fetchFromOSS(url, cacheDuration).catch(err =>
        console.error(`[getBracketData SWR] Background refresh failed:`, err)
      )
      return memoryCache[url].data
    }
  }

  return fetchFromOSS(url, cacheDuration)
}

async function fetchFromOSS(url: string, cacheDuration: number): Promise<any> {
  if (inflightRequests[url] !== undefined) {
    return inflightRequests[url]
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, {
        next: { revalidate: SERVER_CACHE_DURATION },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      memoryCache[url] = { data, expiry: Date.now() + cacheDuration }
      return data
    } finally {
      delete inflightRequests[url]
    }
  })()

  inflightRequests[url] = fetchPromise
  return fetchPromise
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url)
    const eventCode = url.searchParams.get("eventCode")
    const sportCode = url.searchParams.get("sportCode")

    if (!eventCode || !sportCode) {
        return NextResponse.json({ error: "Missing required parameters: eventCode and sportCode" }, { status: 400 })
    }

    const dynamicBaseUrl = `${BASE_URL}/${sportCode}`

    try {
        // 1. Fetch dualPhase list
        const paramUrl = `${dynamicBaseUrl}/dualPhase/${eventCode}.txt`
        const phases = await fetchWithCache(paramUrl)

        if (!Array.isArray(phases)) {
            if (phases && phases.error) {
                return NextResponse.json({ error: "DATA_NOT_FOUND", message: "暂无对阵数据" }, { status: 404 })
            }
            throw new Error("Invalid phase data format")
        }

        const sortedPhases = phases.sort((a: any, b: any) => a.phaseOrder - b.phaseOrder)

        // 2. Fetch matches for all phases in parallel
        const phasesWithMatches = await Promise.all(
            sortedPhases.map(async (phase: any) => {
                const matchUrl = `${dynamicBaseUrl}/dualPhaseMatch/${phase.phaseId}.txt`
                try {
                    const matches = await fetchWithCache(matchUrl)
                    return {
                        ...phase,
                        matches: Array.isArray(matches) ? matches : [],
                    }
                } catch (error) {
                    console.error(`Error fetching matches for phase ${phase.phaseId}:`, error)
                    return { ...phase, matches: [] }
                }
            })
        )

        // NOTE: Cache-Control 让 CDN 缓存响应
        return NextResponse.json(phasesWithMatches, {
            headers: {
                "Cache-Control": `public, max-age=${SERVER_CACHE_DURATION}, s-maxage=${SERVER_CACHE_DURATION}, stale-while-revalidate=${CDN_STALE_REVALIDATE}`,
            },
        })

    } catch (error) {
        console.error("Error in getBracketData:", error)

        if (error instanceof Error && error.message.includes("404")) {
            return NextResponse.json({ error: "DATA_NOT_FOUND", message: "暂无对阵数据" }, { status: 404 })
        }

        return NextResponse.json(
            {
                error: "FETCH_ERROR",
                message: "获取对阵数据失败",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        )
    }
}
