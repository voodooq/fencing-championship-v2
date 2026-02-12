import { useState, useEffect, useCallback, useRef } from "react"
import { DATA_POLLING_INTERVAL } from "@/config/site"

interface UsePollingOptions<T> {
    fetchFn: (isPolling: boolean) => Promise<T>
    interval?: number
    deps?: any[]
    enabled?: boolean
}

/**
 * 通用智能轮询 Hook
 * 通过对比数据 Hash (JSON 字符串) 减少不必要的重渲染
 */
export function usePolling<T>({
    fetchFn,
    interval = DATA_POLLING_INTERVAL,
    deps = [],
    enabled = true,
}: UsePollingOptions<T>) {
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)

    // 使用 ref 存储上一次数据的字符串表示，用于比对
    const lastDataStringRef = useRef<string>("")
    const isInitialFetchRef = useRef<boolean>(true)

    const executeFetch = useCallback(
        async (isPolling = false) => {
            try {
                if (!isPolling && isInitialFetchRef.current) {
                    setLoading(true)
                }

                const result = await fetchFn(isPolling)
                const resultString = JSON.stringify(result)

                // 智能比对：只有当数据发生实际变化时才更新 state
                if (resultString !== lastDataStringRef.current) {
                    setData(result)
                    lastDataStringRef.current = resultString
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
        [fetchFn],
    )

    useEffect(() => {
        if (!enabled) return

        // 立即执行一次初始获取
        executeFetch()

        const intervalId = setInterval(() => {
            executeFetch(true)
        }, interval)

        return () => clearInterval(intervalId)
    }, [executeFetch, interval, enabled, ...deps])

    return { data, setData, loading, error, refresh: () => executeFetch(false) }
}
