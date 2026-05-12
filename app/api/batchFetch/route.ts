import { type NextRequest, NextResponse } from "next/server"
import { fetchWithCache, getCacheVersion, computeEtag } from "@/lib/server-cache"
import { SERVER_CACHE_DURATION, CDN_STALE_REVALIDATE } from "@/config/site"

// Get the base URL from environment variable
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { sportCode, requests } = body
        const clientEtag = request.headers.get("if-none-match")

        if (!sportCode || !Array.isArray(requests)) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        }

        const dynamicBaseUrl = `${BASE_URL}/${sportCode}`
        const results: Record<string, any> = {}
        // NOTE: 使用服务端缓存时长，减少回源频率
        const cacheDuration = SERVER_CACHE_DURATION * 1000

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        // 记录每个请求 key 对应的 URL，用于版本号查询
        const keyUrlMap: Record<string, string[]> = {}

        try {
            await Promise.all(
                requests.map(async (req: any) => {
                    const { key, type, directory, eventCode, phaseId } = req
                    let url = ""

                    // Special handling for fullBracket composite request
                    if (type === "fullBracket") {
                        const phasesUrl = `${dynamicBaseUrl}/dualPhase/${eventCode}.txt`
                        keyUrlMap[key] = [phasesUrl]
                        try {
                            const phases = await fetchWithCache(phasesUrl, cacheDuration, controller.signal)
                            if (Array.isArray(phases)) {
                                const matchUrls: string[] = []
                                const matchPromises = phases.map(async (phase: any) => {
                                    const matchUrl = `${dynamicBaseUrl}/dualPhaseMatch/${phase.phaseId}.txt`
                                    matchUrls.push(matchUrl)
                                    const matches = await fetchWithCache(matchUrl, cacheDuration, controller.signal).catch(() => [])
                                    return {
                                        ...phase,
                                        matches: Array.isArray(matches) ? matches : []
                                    }
                                })
                                results[key] = await Promise.all(matchPromises)
                                keyUrlMap[key] = [phasesUrl, ...matchUrls]
                            } else {
                                results[key] = phases
                            }
                        } catch (err) {
                            console.error(`Error in fullBracket composite fetch for ${eventCode}:`, err)
                            results[key] = { error: true, message: String(err) }
                        }
                        return
                    }

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

                    keyUrlMap[key] = [url]

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

        // NOTE: 基于版本号的轻量 ETag 计算
        // 每个缓存条目在数据变化时会递增版本号，
        // 这里只需拼接版本号字符串，CPU 开销可忽略不计
        // 相比之前 JSON.stringify(results) + MD5(100KB+) 的方式，性能提升数十倍
        const versionMap: Record<string, number> = {}
        for (const [key, urls] of Object.entries(keyUrlMap)) {
            // 对于 fullBracket 等多 URL 的 key，取所有 URL 版本号之和
            versionMap[key] = urls.reduce((sum, u) => sum + getCacheVersion(u), 0)
        }
        const serverEtag = computeEtag(versionMap)

        // NOTE: Cache-Control 让 CDN 缓存此响应，减少回源
        const cacheHeaders = {
            "Cache-Control": `public, max-age=${SERVER_CACHE_DURATION}, s-maxage=${SERVER_CACHE_DURATION}, stale-while-revalidate=${CDN_STALE_REVALIDATE}`,
        }

        // 如果客户端 ETag 匹配，返回 "not modified"（几乎零传输）
        if (clientEtag === serverEtag) {
            return NextResponse.json({ modified: false, etag: serverEtag }, { headers: cacheHeaders })
        }

        // BACKWARD COMPATIBILITY: If no etag was sent, return raw results
        if (!clientEtag) {
            return NextResponse.json(results, { headers: cacheHeaders })
        }

        return NextResponse.json({ modified: true, data: results, etag: serverEtag }, { headers: cacheHeaders })
    } catch (error) {
        console.error("Error in batchFetch:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
