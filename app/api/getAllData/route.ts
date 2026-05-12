import { NextResponse, type NextRequest } from "next/server"
import { SERVER_CACHE_DURATION, CDN_STALE_REVALIDATE } from "@/config/site"
import { fetchWithCache } from "@/lib/server-cache"
import { isValidSportCode } from "@/config/sports"

// Get the base URL from environment variable (without sportCode)
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

const dataFiles = [{ name: "sysData", url: "sysData.txt" }]

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const sportCode = url.searchParams.get("sportCode")

    if (!sportCode || !isValidSportCode(sportCode)) {
      return NextResponse.json({ error: "Missing or invalid required parameter: sportCode" }, { status: 400 })
    }

    // 构建完整的 URL - 现在完全动态，不验证 sportCode 是否在预定义列表中
    const dynamicBaseUrl = `${BASE_URL}/${sportCode}`

    const allData: Record<string, any> = {}

    for (const file of dataFiles) {
      const fileUrl = `${dynamicBaseUrl}/${file.url}`

      try {
        const data = await fetchWithCache(fileUrl)

        // 处理 404 类错误（fetchWithCache 可能缓存了错误状态）
        if (data && data.error && data.status === 404) {
          return NextResponse.json(
            {
              error: "SPORT_CODE_NOT_FOUND",
              message: `运动项目代码 "${sportCode}" 不存在`,
              details: `无法找到项目数据，请检查项目代码是否正确。`,
              sportCode: sportCode,
              attemptedUrl: fileUrl,
            },
            { status: 404 },
          )
        }

        allData[file.name] = data
      } catch (fetchError) {
        console.error(`Error fetching ${fileUrl}:`, fetchError)

        // 区分 404 和其他错误
        if (fetchError instanceof Error && fetchError.message.includes("404")) {
          return NextResponse.json(
            {
              error: "SPORT_CODE_NOT_FOUND",
              message: `运动项目代码 "${sportCode}" 不存在`,
              details: `无法找到项目数据，请检查项目代码是否正确。`,
              sportCode: sportCode,
              attemptedUrl: fileUrl,
            },
            { status: 404 },
          )
        }

        return NextResponse.json(
          {
            error: "NETWORK_ERROR",
            message: `无法连接到项目 "${sportCode}" 的数据源`,
            details: `网络连接失败，请检查网络连接或稍后重试。`,
            sportCode: sportCode,
          },
          { status: 503 },
        )
      }
    }

    if (!allData.sysData) {
      return NextResponse.json(
        {
          error: "MISSING_DATA",
          message: `项目 "${sportCode}" 缺少必要数据`,
          details: `数据源中缺少必要的系统数据。`,
          sportCode: sportCode,
        },
        { status: 500 },
      )
    }

    // NOTE: Cache-Control 让 CDN 和浏览器缓存此响应，大幅减少回源
    return NextResponse.json(allData, {
      headers: {
        "Cache-Control": `public, max-age=${SERVER_CACHE_DURATION}, s-maxage=${SERVER_CACHE_DURATION}, stale-while-revalidate=${CDN_STALE_REVALIDATE}`,
      },
    })
  } catch (error) {
    console.error("Error fetching data:", error)
    return NextResponse.json(
      {
        error: "UNKNOWN_ERROR",
        message: "获取数据时发生未知错误",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
