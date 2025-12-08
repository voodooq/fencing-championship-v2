import { type NextRequest, NextResponse } from "next/server"

// Get the base URL from environment variable (without sportCode)
const BASE_URL = process.env.FENCING_API_BASE_URL || "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const sportCode = url.searchParams.get("sportCode")

  if (!sportCode) {
    return NextResponse.json({ error: "Missing required parameter: sportCode" }, { status: 400 })
  }

  const dynamicBaseUrl = `${BASE_URL}/${sportCode}`
  const imageUrl = `${dynamicBaseUrl}/banner.jpg`

  // --- 缓存逻辑开始 ---
  // 1. 从浏览器请求中获取 If-Modified-Since 和 If-None-Match (ETag) 头部
  const ifModifiedSince = request.headers.get("if-modified-since")
  const ifNoneMatch = request.headers.get("if-none-match")

  // 2. 准备要发送到源服务器 (OSS) 的请求头
  const fetchHeaders = new Headers()
  if (ifModifiedSince) {
    fetchHeaders.set("If-Modified-Since", ifModifiedSince)
  }
  if (ifNoneMatch) {
    fetchHeaders.set("If-None-Match", ifNoneMatch)
  }
  // --- 缓存逻辑结束 ---

  try {
    // 3. 向源服务器 (OSS) 发起请求
    const response = await fetch(imageUrl, {
      method: "GET",
      headers: fetchHeaders,
      // cache: "no-store" 确保 Next.js 服务器本身不会缓存 fetch 结果
      // 这强制它每次都去询问源服务器，从而实现实时验证
      cache: "no-store",
    })

    // 4. 处理来自源服务器的响应

    // Case A: 304 Not Modified
    // 源服务器确认了浏览器持有的缓存是最新的
    if (response.status === 304) {
      // 我们也向浏览器返回 304，浏览器将使用它自己的缓存
      return new NextResponse(null, { status: 304 })
    }

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
    const lastModified = response.headers.get("last-modified")
    const etag = response.headers.get("etag")

    if (contentType) {
      headers.set("Content-Type", contentType)
    }
    if (lastModified) {
      headers.set("Last-Modified", lastModified)
    }
    if (etag) {
      headers.set("ETag", etag)
    }

    // 关键：设置新的缓存策略
    // public: 允许浏览器和 CDN 缓存
    // max-age=0: 告诉浏览器缓存立即"过期"
    // must-revalidate: 强制浏览器在下次使用前必须回服务器验证 (即发送 If-Modified-Since)
    headers.set("Cache-Control", "public, max-age=0, must-revalidate")

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
