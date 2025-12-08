"use client"

import { useState, useEffect } from "react"
import LoadingOverlay from "@/components/loading"
import { Button } from "@/components/ui/button"
import { buildApiUrl } from "@/lib/sport-config"

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

interface Event {
  eventId: number
  eventCode: string
  eventName: string
  typeCode: string
}

export default function RoundsPage({ params }: { params: { sportCode: string; name: string } }) {
  const [eventFormat, setEventFormat] = useState<EventFormat | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ type: "no_data" | "other"; message: string } | null>(null)

  const fetchEventData = async () => {
    if (!params?.sportCode || !params?.name) return

    try {
      setLoading(true)
      setError(null)
      //console.log("Fetching event data...")

      // Fetch event details
      const eventResponse = await fetch(buildApiUrl("/api/getAllData", { timestamp: Date.now().toString() }, params.sportCode), {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })
      if (!eventResponse.ok) {
        throw new Error(`HTTP error! status: ${eventResponse.status} when fetching event details`)
      }
      const eventData = await eventResponse.json()
      //console.log("Event data received:", eventData)
      const currentEvent = eventData.sysData[4].find((e: Event) => e.eventCode === params.name)
      if (!currentEvent) {
        throw new Error("Event not found")
      }
      setEvent(currentEvent)

      // Determine directory based on typeCode
      const directory = currentEvent.typeCode === "T" ? "startListTeam" : "startList"

      // Fetch event format
      const formatResponse = await fetch(
        buildApiUrl(
          "/api/getSysData",
          {
            eventCode: encodeURIComponent(params.name),
            directory: directory,
            timestamp: Date.now().toString(),
          },
          params.sportCode,
        ),
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
      )
      if (!formatResponse.ok) {
        throw new Error(`HTTP error! status: ${formatResponse.status} when fetching event format`)
      }
      const formatData = await formatResponse.json()
      //console.log("Format data received:", formatData)
      if (Array.isArray(formatData) && formatData.length >= 1) {
        const relevantFormatData = currentEvent.typeCode === "T" ? formatData[3] : formatData[2]
        if (Array.isArray(relevantFormatData) && relevantFormatData.length > 0) {
          setEventFormat(relevantFormatData[0])
        } else {
          setEventFormat(relevantFormatData)
        }
        //console.log("EventFormat set:", relevantFormatData)
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
      setLoading(false)
    }
  }

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
        fetchEventData().catch(console.error)
      }, 5000)

      return () => clearInterval(intervalId)
    }
  }, [params])

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
