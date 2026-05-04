import { type NextRequest, NextResponse } from "next/server"
import { SERVER_CACHE_DURATION, CDN_STALE_REVALIDATE } from "@/config/site"

// Get the base URL from environment variable (without sportCode)
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

const validDirectories = [
  "dualPhase",
  "dualPhaseMatch",
  "eventRank",
  "poolRank",
  "poolResult",
  "startList",
  "startListTeam",
  "eventState",
]

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
      // SWR: 返回旧数据，后台刷新
      fetchFromOSS(url, cacheDuration).catch(err =>
        console.error(`[getSysData SWR] Background refresh failed:`, err)
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
  const directory = url.searchParams.get("directory")
  const phaseId = url.searchParams.get("phaseId")
  const sportCode = url.searchParams.get("sportCode")

  if (!eventCode || !directory) {
    return NextResponse.json({ error: "Missing required parameters: eventCode and directory" }, { status: 400 })
  }

  if (!sportCode) {
    return NextResponse.json({ error: "Missing required parameter: sportCode" }, { status: 400 })
  }

  if (!validDirectories.includes(directory)) {
    return NextResponse.json({ error: "Invalid directory" }, { status: 400 })
  }

  // 构建完整的 URL - 现在完全动态
  const dynamicBaseUrl = `${BASE_URL}/${sportCode}`

  let dataUrl = `${dynamicBaseUrl}/${directory}/`
  if (directory === "dualPhaseMatch" && phaseId) {
    dataUrl += `${phaseId}.txt`
  } else if (directory === "eventState") {
    dataUrl += "eventState.txt"
  } else {
    dataUrl += `${eventCode}.txt`
  }

  try {
    const data = await fetchWithCache(dataUrl)

    // NOTE: Cache-Control 让 CDN 缓存响应，减少回源
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, max-age=${SERVER_CACHE_DURATION}, s-maxage=${SERVER_CACHE_DURATION}, stale-while-revalidate=${CDN_STALE_REVALIDATE}`,
      },
    })
  } catch (error) {
    console.error("Error fetching data:", error)

    if (error instanceof Error && error.message.includes("404")) {
      return NextResponse.json(
        {
          error: "DATA_NOT_FOUND",
          message: "请求的数据不存在",
          details: `无法找到 ${directory} 目录下的 ${eventCode} 数据`,
          sportCode: sportCode,
          directory: directory,
          eventCode: eventCode,
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        error: "FETCH_ERROR",
        message: "获取数据失败",
        details: error instanceof Error ? error.message : String(error),
        sportCode: sportCode,
        directory: directory,
        eventCode: eventCode,
      },
      { status: 500 },
    )
  }
}
