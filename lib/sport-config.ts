import { getSportConfig, type SportConfig } from "../config/sports"

// 从 URL 路径获取 sportCode 的工具函数
export function getSportCodeFromPath(pathname: string): string | null {
  // 匹配 /[sportCode]/ 或 /[sportCode]/xxx 格式
  const match = pathname.match(/^\/([^/]+)(?:\/|$)/)
  if (match && match[1]) {
    const sportCode = match[1]
    // 基本验证：确保不是系统路径
    const systemPaths = ["api", "_next", "favicon.ico", "robots.txt", "sitemap.xml"]
    if (!systemPaths.includes(sportCode)) {
      return sportCode
    }
  }
  return null
}

// 在浏览器环境中获取当前的 sportCode
export function getCurrentSportCode(): string | null {
  if (typeof window !== "undefined") {
    return getSportCodeFromPath(window.location.pathname)
  }
  return null
}

// 构建 API URL，使用路径中的 sportCode
export function buildApiUrl(endpoint: string, params: Record<string, string> = {}, sportCode?: string): string {
  const currentSportCode = sportCode || getCurrentSportCode()

  // 过滤掉可能导致缓存失效的动态参数（如 timestamp）
  const cleanParams = { ...params }
  delete cleanParams.timestamp

  const searchParams = new URLSearchParams(cleanParams)

  if (currentSportCode) {
    searchParams.set("sportCode", currentSportCode)
  }

  const queryString = searchParams.toString()
  return queryString ? `${endpoint}?${queryString}` : endpoint
}

// 获取当前运动项目配置
export function getCurrentSportConfig(): SportConfig | null {
  const sportCode = getCurrentSportCode()
  return sportCode ? getSportConfig(sportCode) : null
}

// 构建带有 sportCode 的路径
export function buildSportPath(sportCode: string, path = ""): string {
  return `/${sportCode}${path.startsWith("/") ? path : `/${path}`}`
}
