"use client"

import { useState, useEffect, useCallback } from "react"
import LoadingOverlay from "@/components/loading"
import { Button } from "@/components/ui/button"
import { usePolling } from "@/hooks/use-polling"

interface EventFormat {
  EventID: number
  EventName: string
  CompetitionNo: number
  FormatNumber: number
  FormatPool: string | null
  FormatPoolDesc: string | null
  FormatElimination: string | null
  FormatEliDesc: string | null
}

// Define shared Event interface if not imported
interface Event {
  eventId: number
  eventCode: string
  eventName: string
  typeCode: string
}

export default function RoundsPage({ params }: { params: { sportCode: string; name: string } }) {
  const [eventFormat, setEventFormat] = useState<EventFormat | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [error, setError] = useState<{ type: "no_data" | "other"; message: string } | null>(null)

  /**
   * 获取比赛轮次数据
   * 多步依赖获取：sysData → event → startList/startListTeam → formatData
   */
  const fetchFn = useCallback(async (isPolling: boolean, etag?: string) => {
    if (!params?.sportCode || !params?.name) return null

    let currentEvent = event

    // 首次获取 event 信息
    if (!currentEvent) {
      try {
        const sysResponse = await fetch("/api/batchFetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sportCode: params.sportCode,
            requests: [{ key: "sysData", type: "sysData" }],
          }),
        })
        if (sysResponse.ok) {
          const sysData = await sysResponse.json()
          const sysDataArr = sysData.data?.sysData || sysData.sysData
          const eventList = sysDataArr?.[4]
          if (Array.isArray(eventList)) {
            currentEvent = eventList.find(
              (e: Event) => e.eventCode === decodeURIComponent(params.name),
            )
            if (currentEvent) setEvent(currentEvent)
          }
        }
      } catch (e) {
        console.error("Fallback fetch failed", e)
      }
    }

    if (!currentEvent) {
      console.error("Could not determine event data")
      return null
    }

    const typeCode = currentEvent.typeCode
    if (typeCode === "E") {
      // E 类型无需额外数据
      return null
    }

    // 根据 typeCode 决定请求的 directory
    const directory = typeCode === "T" ? "startListTeam" : "startList"

    // 合并为单次 batchFetch 请求
    const batchResponse = await fetch("/api/batchFetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(etag ? { "if-none-match": etag } : {}),
      },
      body: JSON.stringify({
        sportCode: params.sportCode,
        requests: [
          { key: "formatData", directory: directory, eventCode: decodeURIComponent(params.name) },
        ],
      }),
    })

    if (!batchResponse.ok) {
      throw new Error("Failed to fetch format data")
    }

    const result = await batchResponse.json()

    // ETag 新格式处理
    if (result && typeof result === "object" && "modified" in result) {
      if (result.modified === false) {
        return { modified: false }
      }
      return {
        modified: true,
        data: { ...result.data, _typeCode: typeCode },
        etag: result.etag,
      }
    }

    return { ...result, _typeCode: typeCode }
  }, [params, event])

  const { data: pollingData, loading, error: pollError, refresh } = usePolling<Record<string, any>>({
    fetchFn,
    enabled: !!params?.sportCode && !!params?.name,
    cacheKey: `rounds_${params.sportCode}_${params.name}`,
  })

  // 将轮询数据映射到组件状态
  useEffect(() => {
    if (!pollingData) return

    try {
      const formatData = pollingData.formatData
      const typeCode = pollingData._typeCode

      if (!formatData || formatData.error) {
        throw new Error(formatData?.message || "Failed to fetch format data")
      }

      if (Array.isArray(formatData) && formatData.length >= 1) {
        const index = typeCode === "T" ? 3 : 2
        const relevantFormatData = formatData[index]

        if (!relevantFormatData) {
          console.error("Format data missing at index", index)
          throw new Error(`无法获取赛制信息 (Data missing at index ${index})`)
        }

        if (Array.isArray(relevantFormatData) && relevantFormatData.length > 0) {
          setEventFormat(relevantFormatData[0])
        } else {
          setEventFormat(relevantFormatData as any || {})
        }
        setError(null)
      } else {
        throw new Error("数据格式不正确")
      }
    } catch (err) {
      console.error("Error processing rounds data:", err)
      if (err instanceof Error && err.message.includes("500")) {
        setError({ type: "no_data", message: "当前没有数据" })
      } else {
        setError({
          type: "other",
          message: `Failed to load event data: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
        })
      }
    }
  }, [pollingData])

  // 错误状态映射
  useEffect(() => {
    if (pollError) {
      if (pollError.message?.includes("500")) {
        setError({ type: "no_data", message: "当前没有数据" })
      } else {
        setError({
          type: "other",
          message: `Failed to load event data: ${pollError.message}`,
        })
      }
    }
  }, [pollError])

  if (!params?.sportCode || !params?.name || (loading && !eventFormat)) {
    return <LoadingOverlay />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className={`text-lg ${error.type === "no_data" ? "text-gray-600" : "text-red-500"} mb-4`}>
          {error.message}
        </div>
        {error.type === "other" && <Button onClick={() => refresh()}>重试</Button>}
      </div>
    )
  }

  if (!eventFormat) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading event format data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {eventFormat && (
        <>
          {eventFormat.FormatPool && (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="bg-blue-500 text-white px-4 py-2">{eventFormat.FormatPool}</div>
              <div className="p-4 space-y-2">
                <div
                  dangerouslySetInnerHTML={{
                    __html: eventFormat.FormatPoolDesc
                      ? eventFormat.FormatPoolDesc.split(/[;；]/)
                        .map((part) => `<p>${part.trim()}</p>`)
                        .join("")
                      : "No description available",
                  }}
                />
              </div>
            </div>
          )}
          {eventFormat.FormatElimination && (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="bg-blue-500 text-white px-4 py-2">{eventFormat.FormatElimination}</div>
              <div className="p-4 space-y-2">
                <div
                  dangerouslySetInnerHTML={{
                    __html: eventFormat.FormatEliDesc
                      ? eventFormat.FormatEliDesc.split(/[;；]/)
                        .map((part) => `<p>${part.trim()}</p>`)
                        .join("")
                      : "No description available",
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
