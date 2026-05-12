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
 *
 * 性能设计：
 * - 所有可变状态都通过 Ref 引用，避免 useCallback 依赖变化导致轮询链重建
 * - executeFetch 的依赖数组稳定，不会因数据更新而重新创建
 */
export function usePolling<T>({
    fetchFn,
    interval = DATA_POLLING_INTERVAL,
    deps = [],
    enabled = true,
    cacheKey,
}: UsePollingOptions<T>) {
    // NOTE: 始终以 null 初始化，确保 SSR 和 hydration 阶段渲染一致
    // sessionStorage 读取推迟到 useEffect（客户端挂载后），避免 hydration mismatch
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)

    // NOTE: 通过 Ref 引用 data，避免闭包循环，在 useEffect 之前声明
    const dataRef = useRef<T | null>(data)
    dataRef.current = data

    // 客户端挂载后从 sessionStorage 恢复缓存数据（秒开）
    useEffect(() => {
        if (cacheKey) {
            const cached = sessionStorage.getItem(`cache_poll_${cacheKey}`)
            if (cached) {
                try {
                    const parsed = JSON.parse(cached)
                    setData(parsed)
                    dataRef.current = parsed
                    setLoading(false)
                } catch (e) {
                    // 缓存数据损坏，忽略
                }
            }
        }
        // NOTE: 只在挂载时执行一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
    // NOTE: 通过 Ref 引用 fetchFn，避免 executeFetch 依赖 fetchFn 导致轮询链重建
    const fetchFnRef = useRef(fetchFn)
    fetchFnRef.current = fetchFn
    // NOTE: 通过 Ref 引用 interval 和 cacheKey，避免依赖变化
    const intervalRef = useRef(interval)
    intervalRef.current = interval
    const cacheKeyRef = useRef(cacheKey)
    cacheKeyRef.current = cacheKey

    /**
     * 写入 sessionStorage 缓存
     * 异步执行，不阻塞渲染
     */
    const saveToCache = useCallback((result: any) => {
        const key = cacheKeyRef.current
        if (key && typeof window !== "undefined") {
            try {
                sessionStorage.setItem(`cache_poll_${key}`, JSON.stringify(result))
            } catch (e) {
                // sessionStorage 满了，忽略
            }
        }
    }, [])

    /**
     * 递增退避计数，延长轮询间隔
     */
    const incrementBackoff = useCallback(() => {
        unchangedCountRef.current += 1
        currentIntervalRef.current = Math.min(
            intervalRef.current * Math.pow(BACKOFF_MULTIPLIER, unchangedCountRef.current),
            MAX_POLLING_INTERVAL
        )
    }, [])

    /**
     * 重置退避，恢复初始轮询间隔
     */
    const resetBackoff = useCallback(() => {
        unchangedCountRef.current = 0
        currentIntervalRef.current = intervalRef.current
    }, [])

    /**
     * 核心轮询执行函数
     *
     * 关键性能设计：
     * - 不依赖 data 状态，通过 dataRef 读取当前数据
     * - 不依赖 fetchFn，通过 fetchFnRef 引用最新版本
     * - 依赖数组稳定，不会因数据更新导致 useEffect 重新执行
     */
    const executeFetch = useCallback(
        async (isPolling = false) => {
            // 防止并发请求
            if (isFetchingRef.current) return
            isFetchingRef.current = true

            try {
                // 只有首次加载且无缓存时才显示 loading
                if (!isPolling && isInitialFetchRef.current && !dataRef.current) {
                    setLoading(true)
                }

                // 携带指纹发起请求，减少带宽压力
                const response = await fetchFnRef.current(isPolling, etagRef.current)

                // 处理指纹比对逻辑：如果服务器返回未修改，则不更新状态
                if (response && typeof response === "object" && "modified" in response) {
                    if (response.modified === false) {
                        // 数据未变化 → 递增退避
                        incrementBackoff()
                        if (isInitialFetchRef.current) isInitialFetchRef.current = false
                        return
                    }

                    // 记录新指纹
                    if (response.etag) etagRef.current = response.etag

                    // 提取实际数据
                    const result = response.data
                    if (!result) return

                    // ETag 模式：服务端已确认数据变化，直接更新
                    setData(result)
                    resetBackoff()
                    saveToCache(result)
                } else {
                    // 兼容旧版或普通返回格式
                    const result = response
                    if (!result) return

                    // 旧版模式：通过 JSON 比较检测变化
                    const resultString = JSON.stringify(result)
                    const currentString = dataRef.current ? JSON.stringify(dataRef.current) : ""
                    if (resultString !== currentString) {
                        setData(result)
                        resetBackoff()
                        saveToCache(result)
                    } else {
                        incrementBackoff()
                    }
                }

                if (isInitialFetchRef.current) {
                    isInitialFetchRef.current = false
                }
                setError(null)
            } catch (err) {
                console.error("Polling fetch failed:", err)
                setError(err)
                // 请求失败也递增退避，避免频繁重试加重后端压力
                incrementBackoff()
            } finally {
                setLoading(false)
                isFetchingRef.current = false
            }
        },
        // NOTE: 依赖数组极小且稳定，不会因数据变化而重建
        [incrementBackoff, resetBackoff, saveToCache],
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
    }, [executeFetch, enabled, ...deps])

    // NOTE: 可见性感知 — 页面切到后台时暂停轮询，切回前台立即刷新
    useEffect(() => {
        if (!enabled) return

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                isVisibleRef.current = true
                // 切回前台：重置退避并立即刷新一次数据，确保实时性
                resetBackoff()
                executeFetch(true)
            } else {
                isVisibleRef.current = false
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [executeFetch, enabled, resetBackoff])

    // NOTE: 网络感知 — 离线时暂停，恢复联网后立即刷新
    useEffect(() => {
        if (!enabled || typeof window === "undefined") return

        const handleOnline = () => {
            isOnlineRef.current = true
            // 恢复联网：重置退避并立即刷新
            resetBackoff()
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
    }, [executeFetch, enabled, resetBackoff])

    return { data, setData, loading, error, refresh: () => executeFetch(false) }
}
