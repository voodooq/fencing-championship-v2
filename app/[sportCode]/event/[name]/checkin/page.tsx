"use client"

import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import LoadingOverlay from "@/components/loading"
import { buildApiUrl } from "@/lib/sport-config"
import { DATA_POLLING_INTERVAL } from "@/config/site"

interface CheckInRecord {
  athleteName: string
  organization: string
  piste: string
  phaseName: string
  checkInTime: string
  isTeam?: boolean
}

interface Event {
  eventId: number
  eventCode: string
  eventName: string
  typeCode: string
}

interface CheckInPageProps {
  params: { sportCode: string; name: string }
}

export default function CheckInPage({ params, event: eventProp }: CheckInPageProps & { event?: Event }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [checkInData, setCheckInData] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ type: "no_data" | "other"; message: string } | null>(null)
  const [event, setEvent] = useState<Event | null>(eventProp || null)

  useEffect(() => {
    if (eventProp) setEvent(eventProp)
  }, [eventProp])

  const fetchData = async (isPolling = false) => {
    if (!params?.sportCode || !params?.name) return

    try {
      if (!isPolling) setLoading(true)
      setError(null)

      let currentEvent = eventProp || event
      if (!currentEvent) {
        try {
          const sysResponse = await fetch("/api/batchFetch", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sportCode: params.sportCode, requests: [{ key: "sysData", type: "sysData" }] })
          })
          if (sysResponse.ok) {
            const sysRes = await sysResponse.json()
            const evt = sysRes.sysData?.[4]?.find((e: Event) => e.eventCode === decodeURIComponent(params.name))
            if (evt) { currentEvent = evt; setEvent(evt); }
          }
        } catch (err) { console.error(err) }
      }

      const requests = [
        { key: "startList", directory: "startList", eventCode: decodeURIComponent(params.name) },
        { key: "startListTeam", directory: "startListTeam", eventCode: decodeURIComponent(params.name) }
      ]

      // Fetch startList and startListTeam (sysData removed)
      const batchResponse = await fetch("/api/batchFetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sportCode: params.sportCode,
          requests: requests
        }),
      })

      if (!batchResponse.ok) {
        throw new Error(`Batch fetch failed: ${batchResponse.status}`)
      }

      const batchData = await batchResponse.json()

      if (!currentEvent) {
        if (!isPolling) setLoading(false)
        return
      }

      const isTeamEvent = currentEvent.typeCode === "T"

      let data;
      if (isTeamEvent) {
        data = batchData.startListTeam;
      } else {
        data = batchData.startList;
      }

      if (!data || data.error) {
        throw new Error(`Failed to fetch check-in data: ${data?.status || 'Unknown error'}`)
      }

      let checkInRecords: CheckInRecord[] = []

      if (isTeamEvent) {
        if (Array.isArray(data) && data.length >= 5 && Array.isArray(data[4])) {
          checkInRecords = data[4].map((record: any) => ({
            athleteName: record.athleteName || "未知队伍",
            organization: record.delegation || "",
            phaseName: record.phaseName || "",
            piste: record.piste || "",
            checkInTime: record.startTime || "",
            isTeam: true,
          }))
        }
      } else {
        if (Array.isArray(data) && data.length >= 4 && Array.isArray(data[3])) {
          checkInRecords = data[3].map((record: any) => ({
            athleteName: record.athleteName || "未知",
            organization: record.delegation || "",
            phaseName: record.phaseName || "",
            piste: record.piste || "",
            checkInTime: record.startTime || "",
            isTeam: false,
          }))
        }
      }

      checkInRecords.sort((a, b) => {
        if (!a.checkInTime) return 1
        if (!b.checkInTime) return -1

        return a.checkInTime.localeCompare(b.checkInTime)
      })

      setCheckInData(checkInRecords)
    } catch (error) {
      console.error("Error fetching check-in data:", error)
      if (error instanceof Error && error.message.includes("HTTP error! status: 500")) {
        setError({ type: "no_data", message: "当前没有检录数据" })
      } else {
        setError({
          type: "other",
          message: `Failed to load data: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        })
      }
    } finally {
      if (!isPolling) setLoading(false)
    }
  }

  useEffect(() => {
    if (params?.sportCode && params?.name) {
      fetchData()

      const intervalId = setInterval(() => fetchData(true), DATA_POLLING_INTERVAL)
      return () => clearInterval(intervalId)
    }
  }, [params])

  const filteredData = checkInData.filter(
    (record) =>
      searchQuery === "" ||
      record.athleteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.organization.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (!params?.sportCode || !params?.name || loading) {
    return <LoadingOverlay />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className={`text-lg ${error.type === "no_data" ? "text-gray-600" : "text-red-500"} mb-4`}>
          {error.message}
        </div>
        {error.type === "other" && <Button onClick={() => fetchData()}>重试</Button>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9 bg-white"
          placeholder="请输入要搜索人员的姓名或单位"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] bg-[#F5F8FA] text-sm font-medium">
          <div className="p-3">姓名/队伍</div>
          <div className="p-3">剑道</div>
          <div className="p-3">阶段</div>
          <div className="p-3">时间</div>
          <div className="p-3">单位</div>
        </div>
        <div className="divide-y">
          {filteredData.length > 0 ? (
            filteredData.map((record, index) => (
              <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] text-sm">
                <div className="p-3">{record.athleteName}</div>
                <div className="p-3">{record.piste}</div>
                <div className="p-3">{record.phaseName}</div>
                <div className="p-3">{record.checkInTime}</div>
                <div className="p-3">{record.organization}</div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">暂无检录数据</div>
          )}
        </div>
      </div>
    </div>
  )
}
