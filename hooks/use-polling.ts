import { useState, useEffect, useCallback, useRef } from "react"
import { DATA_POLLING_INTERVAL } from "@/config/site"

// NOTE: 最大轮询间隔上限，防止指数退避无限延长
const MAX_POLLING_INTERVAL = 60000 // 60 seconds
// NOTE: 退避增长使用 1.5 倍而非 2 倍，让恢复更快
const BACKOFF_MULTIPLIER = 1.5

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
 * 1. 页面不可见时完全暂停轮询，切回前台立即刷新
 * 2. 连续无数据变化时，自动延长间隔（10s → 15s → 22s → 34s → 50s → 60s）
 * 3. 数据一旦变化，立即恢复初始间隔
 * 4. 网络离线时暂停轮询，恢复联网后立即刷新
 * 5. ETag 指纹比对，服务端数据未变时几乎零传输
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

    const etagRef = useRef<string>("")
    const isInitialFetchRef = useRef<boolean>(true)
    // NOTE: 连续未变化次数，用于指数退避计算
    const unchangedCountRef = useRef<number>(0)
    // NOTE: 当前实际轮询间隔，随退避动态调整
    const currentIntervalRef = useRef<number>(interval)
    const intervalIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // NOTE: 页面是否可见，用于暂停/恢复轮询
    const isVisibleRef = useRef<boolean>(true)
    // NOTE: 网络是否在线，离线时暂停轮询
    const isOnlineRef = useRef<boolean>(true)
    // NOTE: 是否有正在进行的请求，防止并发
    const isFetchingRef = useRef<boolean>(false)

    /**
     * 更新数据并重置退避计数
     * NOTE: 使用 ETag 作为变化检测依据时，不再需要客户端做 JSON.stringify 比较
     *       只有非 ETag 模式（旧版兼容）才需要字符串比较
     */
    const updateData = useCallback((result: any, isFromEtag: boolean) => {
        if (isFromEtag) {
            // ETag 模式：服务端已确认数据变化（modified: true），直接更新
            setData(result)
            unchangedCountRef.current = 0
            currentIntervalRef.current = interval
            // 异步写入缓存，不阻塞渲染
            if (cacheKey && typeof window !== "undefined") {
                try {
                    sessionStorage.setItem(`cache_poll_${cacheKey}`, JSON.stringify(result))
                } catch (e) {
                    // sessionStorage 满了，忽略
                }
            }
        } else {
            // 旧版兼容模式：通过 JSON 字符串比较检测变化
            const resultString = JSON.stringify(result)
            // NOTE: 使用数据长度 + 前100字符做快速初筛，避免每次都完整比较
            const currentData = data
            const currentString = currentData ? JSON.stringify(currentData) : ""
            if (resultString !== currentString) {
                setData(result)
                unchangedCountRef.current = 0
                currentIntervalRef.current = interval
                if (cacheKey && typeof window !== "undefined") {
                    try {
                        sessionStorage.setItem(`cache_poll_${cacheKey}`, resultString)
                    } catch (e) {
                        // sessionStorage 满了，忽略
                    }
                }
            } else {
                // 数据未变化 → 递增退避计数
                unchangedCountRef.current += 1
                currentIntervalRef.current = Math.min(
                    interval * Math.pow(BACKOFF_MULTIPLIER, unchangedCountRef.current),
                    MAX_POLLING_INTERVAL
                )
            }
        }
    }, [interval, cacheKey, data])

    const executeFetch = useCallback(
        async (isPolling = false) => {
            // 防止并发请求
            if (isFetchingRef.current) return
            isFetchingRef.current = true

            try {
                // 只有在既不是轮询、也不是初始有缓存数据的情况下，才显示 loading
                if (!isPolling && isInitialFetchRef.current && !data) {
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
                            interval * Math.pow(BACKOFF_MULTIPLIER, unchangedCountRef.current),
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

                    updateData(result, true)
                } else {
                    // 兼容旧版或普通返回格式
                    const result = response
                    if (!result) return
                    
                    updateData(result, false)
                }

                if (isInitialFetchRef.current) {
                    isInitialFetchRef.current = false
                }
                setError(null)
            } catch (err) {
                console.error("Polling fetch failed:", err)
                setError(err)
                // 请求失败也递增退避，避免频繁重试加重后端压力
                unchangedCountRef.current += 1
                currentIntervalRef.current = Math.min(
                    interval * Math.pow(BACKOFF_MULTIPLIER, unchangedCountRef.current),
                    MAX_POLLING_INTERVAL
                )
            } finally {
                setLoading(false)
                isFetchingRef.current = false
            }
        },
        [fetchFn, cacheKey, interval, updateData, data],
    )

    // NOTE: 使用递归 setTimeout 替代 setInterval，实现动态间隔（指数退避）
    useEffect(() => {
        if (!enabled) return

        executeFetch()

        const scheduleNext = () => {
            intervalIdRef.current = setTimeout(() => {
                // NOTE: 页面不可见或网络离线时跳过请求，但继续调度（等待恢复）
                if (!isVisibleRef.current || !isOnlineRef.current) {
                    scheduleNext()
                    return
                }
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
                isVisibleRef.current = true
                // 切回前台：重置退避并立即刷新一次数据，确保实时性
                unchangedCountRef.current = 0
                currentIntervalRef.current = interval
                executeFetch(true)
            } else {
                isVisibleRef.current = false
                // NOTE: 页面切到后台，标记不可见
                // setTimeout 回调中会检查此标记并跳过请求
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [executeFetch, enabled, interval])

    // NOTE: 网络感知 — 离线时暂停，恢复联网后立即刷新
    useEffect(() => {
        if (!enabled || typeof window === "undefined") return

        const handleOnline = () => {
            isOnlineRef.current = true
            // 恢复联网：重置退避并立即刷新
            unchangedCountRef.current = 0
            currentIntervalRef.current = interval
            executeFetch(true)
        }

        const handleOffline = () => {
            isOnlineRef.current = false
        }

        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)
        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
        }
    }, [executeFetch, enabled, interval])

    return { data, setData, loading, error, refresh: () => executeFetch(false) }
}
