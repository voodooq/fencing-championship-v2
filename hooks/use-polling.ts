import { useState, useEffect, useCallback, useRef } from "react"
import { DATA_POLLING_INTERVAL } from "@/config/site"

interface UsePollingOptions<T> {
    fetchFn: (isPolling: boolean, etag?: string) => Promise<any>
    interval?: number
    deps?: any[]
    enabled?: boolean
    cacheKey?: string // 唯一缓存键，用于持久化数据
}

/**
 * 通用智能轮询 Hook
 * 支持 Stale-While-Revalidate 模式与持久化缓存
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
                        // 数据未变化，直接返回
                        if (isInitialFetchRef.current) isInitialFetchRef.current = false
                        return
                    }
                    
                    // 记录新指纹
                    if (response.etag) etagRef.current = response.etag
                    
                    // 提取实际数据
                    const result = response.data
                    if (!result) return

                    const resultString = JSON.stringify(result)

                    if (resultString !== lastDataStringRef.current) {
                        setData(result)
                        lastDataStringRef.current = resultString
                        // 同步到缓存
                        if (cacheKey && typeof window !== "undefined") {
                            sessionStorage.setItem(`cache_poll_${cacheKey}`, resultString)
                        }
                    }
                } else {
                    // 兼容旧版或普通返回格式
                    const result = response
                    if (!result) return
                    
                    const resultString = JSON.stringify(result)

                    if (resultString !== lastDataStringRef.current) {
                        setData(result)
                        lastDataStringRef.current = resultString
                        if (cacheKey && typeof window !== "undefined") {
                            sessionStorage.setItem(`cache_poll_${cacheKey}`, resultString)
                        }
                    }
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
        [fetchFn, cacheKey],
    )

    useEffect(() => {
        if (!enabled) return

        executeFetch()

        const intervalId = setInterval(() => {
            executeFetch(true)
        }, interval)

        return () => clearInterval(intervalId)
    }, [executeFetch, interval, enabled, ...deps])

    return { data, setData, loading, error, refresh: () => executeFetch(false) }
}
