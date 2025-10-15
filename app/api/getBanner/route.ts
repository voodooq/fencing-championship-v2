import { type NextRequest, NextResponse } from "next/server"

// Get the base URL from environment variable (without sportCode)
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const sportCode = url.searchParams.get("sportCode")

  if (!sportCode) {
    return NextResponse.json({ error: "Missing required parameter: sportCode" }, { status: 400 })
  }

  // 构建完整的 URL - 现在完全动态
  const dynamicBaseUrl = `${BASE_URL}/${sportCode}`
  const imageUrl = `${dynamicBaseUrl}/banner.jpg`

  //console.log("Fetching banner from:", imageUrl)

  try {
    const response = await fetch(imageUrl)

    if (!response.ok) {
      console.error(`Failed to fetch banner ${imageUrl}: ${response.status} ${response.statusText}`)

      // If banner doesn't exist, return a placeholder instead of error
      if (response.status === 404) {
        // Return a simple SVG placeholder
        const placeholderSvg = `
          <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#3B82F6"/>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="24" font-family="Arial, sans-serif">
              ${sportCode}
            </text>
            <text x="50%" y="60%" text-anchor="middle" dy=".3em" fill="white" font-size="16" font-family="Arial, sans-serif">
              运动项目横幅
            </text>
          </svg>
        `

        return new NextResponse(placeholderSvg, {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public, max-age=3600",
          },
        })
      }

      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    // Stream the response directly
    const headers = new Headers(response.headers)
    headers.set("Cache-Control", "public, max-age=3600")

    return new NextResponse(response.body, {
      status: 200,
      statusText: "OK",
      headers,
    })
  } catch (error) {
    console.error("Error fetching banner image:", error)

    // Return a fallback SVG instead of error
    const fallbackSvg = `
      <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#6B7280"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="20" font-family="Arial, sans-serif">
          无法加载横幅图片
        </text>
      </svg>
    `

    return new NextResponse(fallbackSvg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300",
      },
    })
  }
}
