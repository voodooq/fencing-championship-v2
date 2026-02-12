"use client"

import { useState, useEffect, useCallback } from "react"
import LoadingOverlay from "@/components/loading"
import { Button } from "@/components/ui/button"
import { buildApiUrl } from "@/lib/sport-config"
import { DATA_POLLING_INTERVAL } from "@/config/site"

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

export default function RoundsPage({ params, event: eventProp }: { params: { sportCode: string; name: string }, event?: Event }) {
  const [eventFormat, setEventFormat] = useState<EventFormat | null>(null)
  const [event, setEvent] = useState<Event | null>(eventProp || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ type: "no_data" | "other"; message: string } | null>(null)

  // Update local event state if prop changes
  useEffect(() => {
    if (eventProp) setEvent(eventProp)
  }, [eventProp])

  const fetchEventData = useCallback(async (isPolling = false) => {
    if (!params?.sportCode || !params?.name) return
    // If we have event data from props/state, we don't need to fetch sysData unless we really want IT specifically.
    // Layout provides reliable event data.
    let currentEvent = eventProp || event

    // Fallback: If no event prop, fetch sysData
    if (!currentEvent) {
      try {
        const sysResponse = await fetch("/api/batchFetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sportCode: params.sportCode,
            requests: [{ key: "sysData", type: "sysData" }]
          })
        })
        if (sysResponse.ok) {
          const sysData = await sysResponse.json()
          const eventList = sysData.sysData?.[4]
          if (Array.isArray(eventList)) {
            currentEvent = eventList.find((e: Event) => e.eventCode === decodeURIComponent(params.name))
            if (currentEvent) setEvent(currentEvent)
          }
        }
      } catch (e) {
        console.error("Fallback fetch failed", e)
      }
    }

    if (!currentEvent) {
      console.error("Could not determine event data")
      if (!isPolling) setLoading(false)
      return
    }

    try {
      if (!isPolling) setLoading(true)
      setError(null)
      //console.log("Fetching data...")

      const requests = []

      // Determine requests based on typeCode
      // Note: We need to know which startList to fetch.
      /* 
         Previous logic: 
         1. Fetch sysData -> get event -> check typeCode
         2. If typeCode!=T && !=E -> get startList
         3. If typeCode==T -> get startListTeam
      */

      const typeCode = currentEvent.typeCode

      if (typeCode !== "E") {
        if (typeCode === "T") {
          requests.push({ key: "startListTeam", directory: "startListTeam", eventCode: decodeURIComponent(params.name) })
        } else {
          requests.push({ key: "startList", directory: "startList", eventCode: decodeURIComponent(params.name) })
        }
      }

      if (requests.length === 0) {
        // If only 'E', we might not need any extra data here? 
        // Previous code fetched sysData, then if E, did nothing more?
        // Let's check original code logic.
        setLoading(false)
        return
      }

      const batchResponse = await fetch("/api/batchFetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sportCode: params.sportCode,
          requests: requests
        })
      });

      if (!batchResponse.ok) {
        throw new Error("Failed to fetch sysData");
      }
      const batchData = await batchResponse.json();
      // currentEvent is already available from outer scope
      if (!currentEvent) {
        if (!isPolling) setLoading(false)
        return
      }

      // Determine directory based on typeCode
      const directory = currentEvent.typeCode === "T" ? "startListTeam" : "startList"

      // Now fetch the format data
      // Optimization: We could have fetched this in the first batch if we knew the directory.
      // But we need headers to know the directory. 
      // Typically sysData is cached so this is fast.
      // Or we can just fetch both "startList" and "startListTeam" in the batch and use the right one?
      // Let's stick with two steps if logic requires it, OR just fetch the one we need. 
      // Actually, to fully optimize, we can modify batchFetch to accept 
      // requests = [{ key: "startList", directory: "startList", ... }, { key: "startListTeam", ... }]
      // and then pick the right one.

      const formatResponse = await fetch("/api/batchFetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportCode: params.sportCode,
          requests: [
            { key: "formatData", directory: directory, eventCode: decodeURIComponent(params.name) }
          ]
        })
      });

      if (!formatResponse.ok) {
        throw new Error("Failed to fetch format data");
      }

      const formatBatchData = await formatResponse.json();
      const formatData = formatBatchData.formatData;

      if (formatData.error) {
        throw new Error(formatData.message || "Failed to fetch format data")
      }

      if (Array.isArray(formatData) && formatData.length >= 1) {
        // Check if format data exists at expected index
        const index = currentEvent.typeCode === "T" ? 3 : 2
        const relevantFormatData = formatData[index]

        if (!relevantFormatData) {
          console.error("Format data missing at index", index, "Full data:", formatData)
          throw new Error(`无法获取赛制信息 (Data missing at index ${index})`)
        }

        if (Array.isArray(relevantFormatData) && relevantFormatData.length > 0) {
          setEventFormat(relevantFormatData[0])
        } else {
          // If it's an object (not array) or empty array?
          // If it's empty array, passing it might be fine, or check logic.
          // For now, assume if it exists it's valid enough to stop loading.
          setEventFormat(relevantFormatData as any || {})
        }
      } else {
        throw new Error("数据格式不正确")
      }
    } catch (error) {
      console.error("Error fetching event data:", error)
      if (error instanceof Error && error.message.includes("HTTP error! status: 500")) {
        setError({ type: "no_data", message: "当前没有数据" })
      } else {
        setError({
          type: "other",
          message: `Failed to load event data: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        })
      }
    } finally {
      if (!isPolling) setLoading(false)
    }
  }, [params, eventProp, event])

  useEffect(() => {
    if (params?.sportCode && params?.name) {
      fetchEventData().catch((error) => {
        console.error("Unhandled error in fetchEventData:", error)
        setError({
          type: "other",
          message: `Unhandled error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        })
        setLoading(false)
      })

      const intervalId = setInterval(() => {
        fetchEventData(true).catch(console.error)
      }, DATA_POLLING_INTERVAL)

      return () => clearInterval(intervalId)
    }
  }, [fetchEventData, params])

  if (!params?.sportCode || !params?.name || loading) {
    return <LoadingOverlay />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className={`text-lg ${error.type === "no_data" ? "text-gray-600" : "text-red-500"} mb-4`}>
          {error.message}
        </div>
        {error.type === "other" && <Button onClick={() => fetchEventData()}>重试</Button>}
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
