"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import LoadingOverlay from "@/components/loading"
import { Button } from "@/components/ui/button"
import { buildApiUrl } from "@/lib/sport-config"

interface Athlete {
  rank: number
  regName: string
  orgName: string
  medalCode: string
  teamMember: string
}

interface RankingsData {
  athletes: Athlete[]
}

export default function RankingsPage({ params }: { params: { sportCode: string; name: string } }) {
  const [data, setData] = useState<RankingsData | null>(null)
  const [error, setError] = useState<{ type: "no_data" | "other"; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params?.sportCode || !params?.name) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(
          buildApiUrl(
            "/api/getSysData",
            {
              eventCode: encodeURIComponent(params.name),
              directory: "eventRank",
              timestamp: Date.now().toString(),
            },
            params.sportCode,
          ),
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const rawData = await response.json()
        if (!Array.isArray(rawData)) {
          throw new Error("Invalid data structure received")
        }

        const processedData: RankingsData = {
          athletes: rawData.map((item: any) => ({
            rank: item.rank,
            regName: item.regName,
            orgName: item.orgName,
            medalCode: item.medalCode,
            teamMember: item.teamMember,
          })),
        }
        setData(processedData)
      } catch (error) {
        console.error("Error fetching rankings data:", error)
        if (error instanceof Error && error.message.includes("HTTP error! status: 500")) {
          setError({ type: "no_data", message: "当前没有数据" })
        } else {
          setError({
            type: "other",
            message: `Failed to load rankings data: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
          })
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    const intervalId = setInterval(fetchData, 5000)
    return () => clearInterval(intervalId)
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
        {error.type === "other" && <Button onClick={() => window.location.reload()}>重试</Button>}
      </div>
    )
  }

  if (!data || !data.athletes || data.athletes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">暂无排名数据</div>
      </div>
    )
  }

  const getMedalIcon = (medalCode: string) => {
    switch (medalCode) {
      case "G":
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#FFD700" stroke="#FF0000" strokeWidth="1">
            <path d="M12 2L15 8L21 9L17 14L18 20L12 17L6 20L7 14L3 9L9 8L12 2Z" />
          </svg>
        )
      case "S":
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#C0C0C0" stroke="#808080" strokeWidth="1">
            <path d="M12 2L15 8L21 9L17 14L18 20L12 17L6 20L7 14L3 9L9 8L12 2Z" />
          </svg>
        )
      case "B":
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#CD7F32" stroke="#8B4513" strokeWidth="1">
            <path d="M12 2L15 8L21 9L17 14L18 20L12 17L6 20L7 14L3 9L9 8L12 2Z" />
          </svg>
        )
      default:
        return null
    }
  }

  const hasTeamMembers = data.athletes.some((athlete) => athlete.teamMember !== "")

  return (
    <div className="bg-white rounded-lg border">
      <div className="grid grid-cols-[80px_1fr] text-sm bg-[#F5F8FA] font-medium p-3">
        <div>排名</div>
        <div>{hasTeamMembers ? "队伍/队员/单位" : "姓名/单位"}</div>
      </div>
      <div className="divide-y">
        {data.athletes.map((athlete, index) => (
          <div
            key={index}
            className={cn("grid grid-cols-[80px_1fr] text-sm p-3", index % 2 === 0 ? "bg-white" : "bg-[#F5F8FA]")}
          >
            <div className="flex items-center gap-2">
              {getMedalIcon(athlete.medalCode) || <span className="text-gray-400 w-6">{athlete.rank}</span>}
            </div>
            <div className="flex flex-col">
              <span>{athlete.regName}</span>
              {athlete.teamMember && <span className="text-gray-600">{athlete.teamMember}</span>}
              <span className="text-gray-500">{athlete.orgName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
