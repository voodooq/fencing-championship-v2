import { useState, useEffect } from "react"

let cachedTestMode: boolean | null = null

export function useTestMode() {
  const [testMode, setTestMode] = useState<boolean>(cachedTestMode ?? false)

  useEffect(() => {
    if (cachedTestMode !== null) return

    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/env")
        if (response.ok) {
          const data = await response.json()
          cachedTestMode = data.testMode
          setTestMode(data.testMode)
        }
      } catch (error) {
        console.error("Failed to fetch test mode config:", error)
      }
    }

    fetchConfig()
  }, [])

  return testMode
}
