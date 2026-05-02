import { useState, useEffect, useCallback, useRef } from "react"
import { DATA_POLLING_INTERVAL } from "@/config/site"

interface UsePollingOptions<T> {
    fetchFn: (isPolling: boolean) => Promise<T>
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
    const isInitialFetchRef = useRef<boolean>(true)

    const executeFetch = useCallback(
        async (isPolling = false) => {
            try {
                // 只有在既不是轮询、也不是初始有缓存数据的情况下，才显示 loading
                if (!isPolling && isInitialFetchRef.current && !data) {
                    setLoading(true)
                }

                const result = await fetchFn(isPolling)
                const resultString = JSON.stringify(result)

                if (resultString !== lastDataStringRef.current) {
                    setData(result)
                    lastDataStringRef.current = resultString
                    // 同步到缓存
                    if (cacheKey && typeof window !== "undefined") {
                        sessionStorage.setItem(`cache_poll_${cacheKey}`, resultString)
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
        [fetchFn, cacheKey, data],
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
