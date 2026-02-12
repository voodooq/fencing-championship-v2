import { NextResponse, type NextRequest } from "next/server"

// This API relies on request URL query params and remote fetching, mark as dynamic
export const dynamic = 'force-dynamic'

// Get the base URL from environment variable (without sportCode)
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

import { DATA_REFRESH_INTERVAL } from "@/config/site"

const dataFiles = [{ name: "sysData", url: "sysData.txt" }]

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const sportCode = url.searchParams.get("sportCode")

    if (!sportCode) {
      return NextResponse.json({ error: "Missing required parameter: sportCode" }, { status: 400 })
    }

    // 构建完整的 URL - 现在完全动态，不验证 sportCode 是否在预定义列表中
    const dynamicBaseUrl = `${BASE_URL}/${sportCode}`
    //console.log("Fetching data from:", dynamicBaseUrl)

    const allData: Record<string, any> = {}

    for (const file of dataFiles) {
      const fileUrl = `${dynamicBaseUrl}/${file.url}`
      //console.log("Fetching file:", fileUrl)

      try {
        const response = await fetch(fileUrl, {
          next: { revalidate: DATA_REFRESH_INTERVAL }, // Revalidate every 15 seconds
        })

        if (!response.ok) {
          console.error(`Failed to fetch ${fileUrl}: ${response.status} ${response.statusText}`)

          if (response.status === 404) {
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

          throw new Error(`HTTP error! status: ${response.status} for file: ${file.name}. URL: ${fileUrl}`)
        }

        const text = await response.text()
        try {
          const data = JSON.parse(text)
          allData[file.name] = data
        } catch (parseError) {
          console.error(`Error parsing JSON for ${file.name}:`, parseError)
          console.error("Received text:", text.substring(0, 200) + "...")
          return NextResponse.json(
            {
              error: "INVALID_DATA_FORMAT",
              message: `项目 "${sportCode}" 的数据格式无效`,
              details: `服务器返回的数据无法解析，请稍后重试。`,
              sportCode: sportCode,
            },
            { status: 500 },
          )
        }
      } catch (fetchError) {
        console.error(`Network error fetching ${fileUrl}:`, fetchError)
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

    // console.log("Successfully fetched data for sportCode:", sportCode)
    return NextResponse.json(allData)
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
