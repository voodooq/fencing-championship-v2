import { SERVER_CACHE_DURATION } from "@/config/site"

/**
 * 全局共享的服务端内存缓存模块
 *
 * 核心设计：
 * 1. 所有 API 路由共享同一份缓存，相同 URL 只存一份数据
 * 2. SWR 模式：缓存过期后立即返回旧数据，后台异步刷新
 * 3. 请求合并：同一 URL 的并发请求只发一次网络请求
 * 4. 版本号机制：每次数据变化时递增版本号，用于轻量 ETag 计算
 *    （避免对完整 JSON 做 stringify + MD5，大幅降低 CPU 开销）
 * 5. 请求限流：对同一 URL 的刷新请求进行节流，防止大并发时产生过多回源请求
 */

interface CacheEntry {
  data: any
  expiry: number
  /** 数据变更版本号，每次实际数据更新时递增 */
  version: number
  /** 上次实际向 OSS 发起请求的时间戳，用于限流 */
  lastFetchTime: number
}

// NOTE: 模块级单例，所有 API 路由共享
const memoryCache: Record<string, CacheEntry> = {}
const inflightRequests: Record<string, Promise<any> | undefined> = {}

const MAX_CACHE_ITEMS = 500
// 全局版本计数器
let globalVersionCounter = 0

/**
 * 负缓存时长（毫秒）
 * 404 等错误响应短暂缓存，防止对不存在的资源频繁请求
 */
const NEGATIVE_CACHE_DURATION = 5000

/**
 * SWR 后台刷新的最小间隔（毫秒）
 * 即使缓存过期，如果距上次刷新不足此间隔，也不触发后台刷新
 * 防止大并发场景下每个请求都触发后台刷新
 */
const MIN_REFRESH_INTERVAL = 3000

/**
 * 带 SWR 和请求合并的缓存读取
 * - 缓存有效 → 直接返回
 * - 缓存过期 → 返回旧数据 + 后台刷新（SWR，带限流）
 * - 无缓存 → 发起网络请求
 */
export async function fetchWithCache(
  url: string,
  cacheDuration: number = SERVER_CACHE_DURATION * 1000,
  signal?: AbortSignal
): Promise<any> {
  const now = Date.now()

  if (memoryCache[url]) {
    if (memoryCache[url].expiry > now) {
      return memoryCache[url].data
    }
    // SWR: 返回旧数据，后台刷新（带限流保护）
    // NOTE: 只有距上次刷新超过 MIN_REFRESH_INTERVAL 才触发后台刷新
    // 1000 个用户同时轮询时，只有第一个过期请求会触发刷新，其余全部直接返回旧数据
    const timeSinceLastFetch = now - memoryCache[url].lastFetchTime
    if (timeSinceLastFetch > MIN_REFRESH_INTERVAL) {
      fetchFromOrigin(url, cacheDuration).catch((err) =>
        console.error(`[ServerCache SWR] Background refresh failed for ${url}:`, err)
      )
    }
    return memoryCache[url].data
  }

  return fetchFromOrigin(url, cacheDuration, signal)
}

/**
 * 获取缓存条目的版本号
 * 用于轻量 ETag 计算，避免对数据做 JSON.stringify + MD5
 */
export function getCacheVersion(url: string): number {
  return memoryCache[url]?.version ?? 0
}

/**
 * 根据多个请求 key 的版本号组合计算 ETag
 * 格式: "v:key1=ver1,key2=ver2,..."
 * 相比 MD5(JSON.stringify(results))，CPU 开销可忽略不计
 */
export function computeEtag(versionMap: Record<string, number>): string {
  const parts = Object.entries(versionMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ver]) => `${key}=${ver}`)
    .join(",")
  return `v:${parts}`
}

/**
 * 从源站获取数据（含请求合并和缓存管理）
 */
async function fetchFromOrigin(
  url: string,
  cacheDuration: number,
  signal?: AbortSignal
): Promise<any> {
  // 请求合并：同一 URL 只发一次
  if (inflightRequests[url] !== undefined) {
    return inflightRequests[url]
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, {
        next: { revalidate: Math.floor(cacheDuration / 1000) },
        signal,
      })

      // 负缓存：404 短暂缓存，避免反复请求不存在的资源
      if (response.status === 404) {
        const errorData = { error: true, status: 404, message: "File not found" }
        setCacheEntry(url, errorData, NEGATIVE_CACHE_DURATION)
        return errorData
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const text = await response.text()
      const data = JSON.parse(text)
      setCacheEntry(url, data, cacheDuration)
      return data
    } finally {
      delete inflightRequests[url]
    }
  })()

  inflightRequests[url] = fetchPromise
  return fetchPromise
}

/**
 * 写入缓存条目
 * 使用文本长度快速判断数据是否变化，只有可能变化时才做精确比较
 * 只有真正变化时才递增版本号
 */
function setCacheEntry(url: string, data: any, duration: number): void {
  // LRU 简易淘汰：超限时删除最早的条目
  if (Object.keys(memoryCache).length >= MAX_CACHE_ITEMS) {
    const oldestKey = Object.keys(memoryCache)[0]
    delete memoryCache[oldestKey]
  }

  const now = Date.now()
  const existing = memoryCache[url]
  let version: number

  if (existing) {
    // NOTE: 先用序列化后的长度做快速判断，长度相同才做精确比较
    // 大部分情况下数据不变，长度比较可以快速跳过
    const newStr = JSON.stringify(data)
    const oldStr = JSON.stringify(existing.data)
    const changed = newStr.length !== oldStr.length || newStr !== oldStr
    version = changed ? ++globalVersionCounter : existing.version
  } else {
    version = ++globalVersionCounter
  }

  memoryCache[url] = {
    data,
    expiry: now + duration,
    version,
    lastFetchTime: now,
  }
}
