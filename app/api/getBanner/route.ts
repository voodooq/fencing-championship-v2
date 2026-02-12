import { type NextRequest, NextResponse } from "next/server"

// This API uses request URL and remote resources; mark as dynamic
export const dynamic = 'force-dynamic'

// Get the base URL from environment variable (without sportCode)
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

import { DATA_REFRESH_INTERVAL } from "@/config/site"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const sportCode = url.searchParams.get("sportCode")

  if (!sportCode) {
    return NextResponse.json({ error: "Missing required parameter: sportCode" }, { status: 400 })
  }

  const dynamicBaseUrl = `${BASE_URL}/${sportCode}`
  const imageUrl = `${dynamicBaseUrl}/banner.jpg`

  try {
    // 3. 向源服务器 (OSS) 发起请求
    // 使用 Next.js 的 ISR (Incremental Static Regeneration) 机制
    // revalidate: 使用配置的间隔
    // 这期间无论有多少个请求，Next.js 都只会向 OSS 发起一次请求 (请求合并)
    const response = await fetch(imageUrl, {
      method: "GET",
      next: { revalidate: DATA_REFRESH_INTERVAL },
    })

    // 4. 处理来自源服务器的响应

    // Case B: 404 Not Found (Banner 不存在)
    if (response.status === 404) {
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
          // 404 的占位图可以缓存一段时间，比如 10 分钟
          "Cache-Control": "public, max-age=600",
        },
      })
    }

    // Case C: 其他错误
    if (!response.ok) {
      console.error(`Failed to fetch banner ${imageUrl}: ${response.status} ${response.statusText}`)
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    // Case D: 200 OK (成功获取到新图片)
    // 5. 准备要发送给浏览器的响应头
    const headers = new Headers()

    // 从源响应中复制关键的缓存头
    const contentType = response.headers.get("content-type")

    if (contentType) {
      headers.set("Content-Type", contentType)
    }

    // 关键：设置浏览器缓存策略与服务器同步
    // public: 允许浏览器和 CDN 缓存
    // max-age: 浏览器缓存时间 (与配置一致)
    // stale-while-revalidate=5: 允许短暂使用过期数据，提升体验
    headers.set("Cache-Control", `public, max-age=${DATA_REFRESH_INTERVAL}, stale-while-revalidate=5`)

    // 6. 将图片数据流式传输给浏览器
    return new NextResponse(response.body, {
      status: 200,
      statusText: "OK",
      headers,
    })
  } catch (error) {
    console.error("Error fetching banner image:", error)
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
        // 错误占位图缓存 5 分钟
        "Cache-Control": "public, max-age=300",
      },
    })
  }
}
