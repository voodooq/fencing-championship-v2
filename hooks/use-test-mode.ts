import { useState, useEffect } from "react"

/**
 * 模块级缓存 + Promise 锁
 * 确保无论多少个组件同时调用 useTestMode，只发一次 /api/env 请求
 */
let cachedTestMode: boolean | null = null
let fetchPromise: Promise<boolean> | null = null

async function fetchTestModeOnce(): Promise<boolean> {
  if (cachedTestMode !== null) return cachedTestMode

  // 请求合并：多个组件同时挂载时，只发一次请求
  if (fetchPromise) return fetchPromise

  fetchPromise = (async () => {
    try {
      const response = await fetch("/api/env")
      if (response.ok) {
        const data = await response.json()
        cachedTestMode = data.testMode ?? false
        return cachedTestMode!
      }
    } catch (error) {
      console.error("Failed to fetch test mode config:", error)
    }
    cachedTestMode = false
    return false
  })()

  return fetchPromise
}

/**
 * 获取测试模式配置的 Hook
 *
 * 优化点：
 * - 模块级缓存，整个应用生命周期只请求一次
 * - Promise 锁实现请求合并，多个组件同时挂载不会重复请求
 */
export function useTestMode() {
  const [testMode, setTestMode] = useState<boolean>(cachedTestMode ?? false)

  useEffect(() => {
    if (cachedTestMode !== null) {
      setTestMode(cachedTestMode)
      return
    }

    fetchTestModeOnce().then(setTestMode)
  }, [])

  return testMode
}
