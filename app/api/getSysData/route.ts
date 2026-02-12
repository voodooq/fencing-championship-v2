import { type NextRequest, NextResponse } from "next/server"

// Get the base URL from environment variable (without sportCode)
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

import { DATA_REFRESH_INTERVAL } from "@/config/site"

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

  //console.log("Fetching data from:", dataUrl)

  try {
    const response = await fetch(dataUrl, { next: { revalidate: DATA_REFRESH_INTERVAL } })

    if (!response.ok) {
      console.error(`Failed to fetch ${dataUrl}: ${response.status} ${response.statusText}`)

      if (response.status === 404) {
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

      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching data:", error)
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
