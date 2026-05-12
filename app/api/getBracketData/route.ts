import { type NextRequest, NextResponse } from "next/server"
import { SERVER_CACHE_DURATION, CDN_STALE_REVALIDATE } from "@/config/site"
import { fetchWithCache } from "@/lib/server-cache"

// Get the base URL from environment variable
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

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
