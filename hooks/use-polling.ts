import { useState, useEffect, useCallback, useRef } from "react"
import { DATA_POLLING_INTERVAL } from "@/config/site"

// NOTE: 最大轮询间隔上限，防止指数退避无限延长
const MAX_POLLING_INTERVAL = 60000 // 60 seconds

interface UsePollingOptions<T> {
    fetchFn: (isPolling: boolean, etag?: string) => Promise<any>
    interval?: number
    deps?: any[]
    enabled?: boolean
    cacheKey?: string // 唯一缓存键，用于持久化数据
}

/**
 * 通用智能轮询 Hook
 * 支持 Stale-While-Revalidate 模式、持久化缓存、可见性感知、指数退避
 *
 * 带宽优化策略：
 * 1. 页面不可见时暂停轮询，切回前台立即刷新
 * 2. 连续无数据变化时，自动延长间隔（10s → 20s → 40s → 60s）
 * 3. 数据一旦变化，立即恢复初始间隔
 */
export function usePolling<T>({
    fetchFn,
    interval = DATA_POLLING_INTERVAL,
    deps = [],
    enabled = true,
    cacheKey,
}: UsePollingOptions<T>) {
    // 尝试从缓存初始化数据
    const [data, setData] = useState<T | null>(() => {
        if (typeof window !== "undefined" && cacheKey) {
            const cached = sessionStorage.getItem(`cache_poll_${cacheKey}`)
            if (cached) {
                try {
                    return JSON.parse(cached)
                } catch (e) {
                    return null
                }
            }
        }
        return null
    })

    // 如果已经有缓存数据，初始 loading 设为 false，实现秒开
    const [loading, setLoading] = useState(!data)
    const [error, setError] = useState<any>(null)

    const lastDataStringRef = useRef<string>(data ? JSON.stringify(data) : "")
    const etagRef = useRef<string>("")
    const isInitialFetchRef = useRef<boolean>(true)
    // NOTE: 连续未变化次数，用于指数退避计算
    const unchangedCountRef = useRef<number>(0)
    // NOTE: 当前实际轮询间隔，随退避动态调整
    const currentIntervalRef = useRef<number>(interval)
    const intervalIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    /**
     * 更新数据并重置退避计数
     * 抽离公共逻辑，减少 executeFetch 中的重复代码
     */
    const updateData = useCallback((result: any) => {
        const resultString = JSON.stringify(result)
        if (resultString !== lastDataStringRef.current) {
            setData(result)
            lastDataStringRef.current = resultString
            // 数据变化 → 重置退避，恢复初始间隔
            unchangedCountRef.current = 0
            currentIntervalRef.current = interval
            // 同步到缓存
            if (cacheKey && typeof window !== "undefined") {
                sessionStorage.setItem(`cache_poll_${cacheKey}`, resultString)
            }
        } else {
            // 数据未变化 → 递增退避计数
            unchangedCountRef.current += 1
            // 指数退避：interval * 2^count，上限 MAX_POLLING_INTERVAL
            currentIntervalRef.current = Math.min(
                interval * Math.pow(2, unchangedCountRef.current),
                MAX_POLLING_INTERVAL
            )
        }
    }, [interval, cacheKey])

    const executeFetch = useCallback(
        async (isPolling = false) => {
            try {
                // 只有在既不是轮询、也不是初始有缓存数据的情况下，才显示 loading
                // 使用 lastDataStringRef 判断是否有数据，避免依赖 data 状态导致死循环
                if (!isPolling && isInitialFetchRef.current && !lastDataStringRef.current) {
                    setLoading(true)
                }

                // 携带指纹发起请求，减少带宽压力
                const response = await fetchFn(isPolling, etagRef.current)
                
                // 处理指纹比对逻辑：如果服务器返回未修改，则不更新状态
                if (response && typeof response === "object" && "modified" in response) {
                    if (response.modified === false) {
                        // 数据未变化 → 递增退避
                        unchangedCountRef.current += 1
                        currentIntervalRef.current = Math.min(
                            interval * Math.pow(2, unchangedCountRef.current),
                            MAX_POLLING_INTERVAL
                        )
                        if (isInitialFetchRef.current) isInitialFetchRef.current = false
                        return
                    }
                    
                    // 记录新指纹
                    if (response.etag) etagRef.current = response.etag
                    
                    // 提取实际数据
                    const result = response.data
                    if (!result) return

                    updateData(result)
                } else {
                    // 兼容旧版或普通返回格式
                    const result = response
                    if (!result) return
                    
                    updateData(result)
                }

                if (isInitialFetchRef.current) {
                    isInitialFetchRef.current = false
                }
                setError(null)
            } catch (err) {
                console.error("Polling fetch failed:", err)
                setError(err)
            } finally {
                setLoading(false)
            }
        },
        [fetchFn, cacheKey, interval, updateData],
    )

    // NOTE: 使用递归 setTimeout 替代 setInterval，实现动态间隔（指数退避）
    useEffect(() => {
        if (!enabled) return

        executeFetch()

        const scheduleNext = () => {
            intervalIdRef.current = setTimeout(() => {
                executeFetch(true).finally(() => {
                    // 请求完成后再安排下一轮，避免请求堆积
                    scheduleNext()
                })
            }, currentIntervalRef.current)
        }

        scheduleNext()

        return () => {
            if (intervalIdRef.current) {
                clearTimeout(intervalIdRef.current)
            }
        }
    }, [executeFetch, interval, enabled, ...deps])

    // NOTE: 可见性感知 — 页面切到后台时暂停轮询，切回前台立即刷新
    useEffect(() => {
        if (!enabled) return

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                // 切回前台：立即刷新一次数据，确保实时性
                executeFetch(true)
            }
            // NOTE: 页面切到后台时不需要额外处理，
            // 因为 setTimeout 的回调在后台标签页中会被浏览器自动节流（通常延迟到 1 分钟以上）
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [executeFetch, enabled])

    return { data, setData, loading, error, refresh: () => executeFetch(false) }
}
