import { type NextRequest, NextResponse } from "next/server"
import { SERVER_CACHE_DURATION, CDN_STALE_REVALIDATE } from "@/config/site"
import { fetchWithCache } from "@/lib/server-cache"
import { isValidSportCode } from "@/config/sports"

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const eventCode = url.searchParams.get("eventCode")
  const directory = url.searchParams.get("directory")
  const phaseId = url.searchParams.get("phaseId")
  const sportCode = url.searchParams.get("sportCode")

  if (!eventCode || !directory || !/^[^./\\]+$/.test(eventCode)) {
    return NextResponse.json({ error: "Missing or invalid required parameters: eventCode and directory" }, { status: 400 })
  }

  if (phaseId && !/^[^./\\]+$/.test(phaseId)) {
    return NextResponse.json({ error: "Invalid phaseId" }, { status: 400 })
  }

  if (!sportCode || !isValidSportCode(sportCode)) {
    return NextResponse.json({ error: "Missing or invalid required parameter: sportCode" }, { status: 400 })
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
