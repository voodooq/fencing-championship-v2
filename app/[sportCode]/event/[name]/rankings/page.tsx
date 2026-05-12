"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import LoadingOverlay from "@/components/loading"
import { Button } from "@/components/ui/button"
import { usePolling } from "@/hooks/use-polling"
import { STATIC_DATA_POLLING_INTERVAL } from "@/config/site"

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

  /**
   * 获取排名数据
   * 从 getSysData 迁移到 batchFetch 以获得 ETag 指纹比对支持
   */
  const fetchFn = useCallback(async (isPolling: boolean, etag?: string) => {
    if (!params?.sportCode || !params?.name) return null

    const response = await fetch("/api/batchFetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(etag ? { "if-none-match": etag } : {}),
      },
      body: JSON.stringify({
        sportCode: params.sportCode,
        requests: [
          { key: "eventRank", directory: "eventRank", eventCode: params.name },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    // ETag 新格式处理
    if (result && typeof result === "object" && "modified" in result) {
      if (result.modified === false) {
        return { modified: false }
      }
      if (result.etag) {
        return { modified: true, data: result.data, etag: result.etag }
      }
      return result.data
    }

    return result
  }, [params])

  const { data: pollingData, loading, error: pollError, refresh } = usePolling<Record<string, any>>({
    fetchFn,
    // NOTE: 排名数据变化频率低，使用 30 秒轮询间隔
    interval: STATIC_DATA_POLLING_INTERVAL,
    enabled: !!params?.sportCode && !!params?.name,
    cacheKey: `rankings_${params.sportCode}_${params.name}`,
  })

  // 将轮询数据映射到组件状态
  useEffect(() => {
    if (!pollingData) return

    // 兼容两种返回格式：直接数据 或 { eventRank: [...] }
    const rawData = pollingData.eventRank || pollingData
    if (!Array.isArray(rawData)) return

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
  }, [pollingData])

  // 错误状态映射
  useEffect(() => {
    if (pollError) {
      if (pollError.message?.includes("500")) {
        setError({ type: "no_data", message: "当前没有数据" })
      } else {
        setError({
          type: "other",
          message: `Failed to load rankings data: ${pollError.message}`,
        })
      }
    } else {
      setError(null)
    }
  }, [pollError])

  if (!params?.sportCode || !params?.name || (loading && !data)) {
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
