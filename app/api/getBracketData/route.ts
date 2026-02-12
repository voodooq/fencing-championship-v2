import { type NextRequest, NextResponse } from "next/server"

// Get the base URL from environment variable
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

import { DATA_REFRESH_INTERVAL } from "@/config/site"

export const dynamic = 'force-dynamic' // defaults to auto

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
        const phaseResponse = await fetch(paramUrl, { next: { revalidate: DATA_REFRESH_INTERVAL } })

        if (!phaseResponse.ok) {
            if (phaseResponse.status === 404) {
                return NextResponse.json({ error: "DATA_NOT_FOUND", message: "暂无对阵数据" }, { status: 404 })
            }
            throw new Error(`Failed to fetch phases: ${phaseResponse.status}`)
        }

        const phases = await phaseResponse.json()
        if (!Array.isArray(phases)) {
            throw new Error("Invalid phase data format")
        }

        const sortedPhases = phases.sort((a: any, b: any) => a.phaseOrder - b.phaseOrder)

        // 2. Fetch matches for all phases in parallel
        const phasesWithMatches = await Promise.all(
            sortedPhases.map(async (phase: any) => {
                const matchUrl = `${dynamicBaseUrl}/dualPhaseMatch/${phase.phaseId}.txt`
                try {
                    const matchResponse = await fetch(matchUrl, { next: { revalidate: DATA_REFRESH_INTERVAL } })
                    if (!matchResponse.ok) {
                        console.warn(`Failed to fetch matches for phase ${phase.phaseId}: ${matchResponse.status}`)
                        return { ...phase, matches: [] }
                    }
                    const matches = await matchResponse.json()
                    return {
                        ...phase,
                        matches: matches,
                    }
                } catch (error) {
                    console.error(`Error fetching matches for phase ${phase.phaseId}:`, error)
                    return { ...phase, matches: [] }
                }
            })
        )

        return NextResponse.json(phasesWithMatches)

    } catch (error) {
        console.error("Error in getBracketData:", error)
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
