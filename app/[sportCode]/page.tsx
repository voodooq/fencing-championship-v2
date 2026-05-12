"use client"

import { useState, useMemo, useCallback } from "react"
import Header from "../../components/header"
import Banner from "../../components/banner"
import Filters from "../../components/filters"
import Schedule from "../../components/schedule"
import LoadingOverlay from "../../components/loading"
import { isValidSportCode } from "../../config/sports"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePolling } from "@/hooks/use-polling"
import { HOME_POLLING_INTERVAL } from "@/config/site"

interface Event {
  eventId: number
  eventCode: string
  eventOrder: number
  eventName: string
  genderCode: string
  weaponCode: string
  categoryCode: string
  typeCode: string
  openDate: string
  formattedDate: string
  openTime: string
  hasPool: number
  statusDes: string
}

interface AllData {
  sysData: [
    any,
    { order: number; code: string; name: string }[], // weapons
    { order: number; code: string; name: string }[], // genders
    { order: number; code: string; name: string }[], // categories
    Event[],
    { EventID: number; StatusDes: string; RunPhaseID: number | null }[], // event states
  ]
}

interface ApiError {
  error: string
  message: string
  details: string
  sportCode?: string
  attemptedUrl?: string
}

export default function SportHomePage({ params }: { params: { sportCode: string } }) {
  const [error, setError] = useState<ApiError | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedGender, setSelectedGender] = useState<string>("all")
  const [selectedWeapon, setSelectedWeapon] = useState<string>("all")

  /**
   * 通过 batchFetch 获取首页数据
   * 改进：
   * 1. 使用 batchFetch 替代 getAllData，获得 ETag 指纹比对支持
   * 2. 通过 usePolling 获得指数退避和可见性感知
   * 3. 同时获取 sysData 和 eventState，减少请求次数
   */
  const fetchFn = useCallback(async (_isPolling: boolean, etag?: string) => {
    if (!params?.sportCode) return null

    // 验证 sportCode 格式
    if (!isValidSportCode(params.sportCode)) {
      setError({
        error: "INVALID_SPORT_CODE",
        message: "项目代码格式无效",
        details: `项目代码 "${params.sportCode}" 格式不正确。`,
        sportCode: params.sportCode,
      })
      return null
    }

    const response = await fetch("/api/batchFetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(etag ? { "if-none-match": etag } : {}),
      },
      body: JSON.stringify({
        sportCode: params.sportCode,
        requests: [
          { key: "sysData", type: "sysData" },
          { key: "eventState", directory: "eventState", eventCode: "eventState" },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (errorData.error === "SPORT_CODE_NOT_FOUND") {
        setError({
          error: "SPORT_CODE_NOT_FOUND",
          message: `项目 "${params.sportCode}" 不存在`,
          details: "无法找到对应项目数据，请检查项目代码或数据源路径配置。",
          sportCode: params.sportCode,
          attemptedUrl: errorData.attemptedUrl,
        })
        return null
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    // ETag 新格式处理
    if (result && typeof result === "object" && "modified" in result) {
      if (result.modified === false) {
        return { modified: false }
      }
      return { modified: true, data: result.data, etag: result.etag }
    }

    return result
  }, [params])

  const { data: pollingData, loading, refresh } = usePolling<Record<string, any>>({
    fetchFn,
    interval: HOME_POLLING_INTERVAL,
    enabled: !!params?.sportCode,
    cacheKey: `home_${params.sportCode}`,
  })

  // 从轮询数据中提取 allData
  const allData = useMemo<AllData | null>(() => {
    if (!pollingData?.sysData) return null
    if (!Array.isArray(pollingData.sysData) || pollingData.sysData.length < 6) return null

    // 获取 eventState（优先从单独请求的 eventState 获取，回退到 sysData[5]）
    // NOTE: eventState 请求可能返回错误对象 {error: true}（truthy），
    // 不能用 || 短路，必须逐个判断是否是数组
    const eventStates = Array.isArray(pollingData.eventState)
      ? pollingData.eventState
      : Array.isArray(pollingData.sysData[5])
        ? pollingData.sysData[5]
        : []

    // Process the data to include statusDes
    return {
      sysData: [
        pollingData.sysData[0],
        pollingData.sysData[1],
        pollingData.sysData[2],
        pollingData.sysData[3],
        pollingData.sysData[4].map((event: Event) => ({
          ...event,
          statusDes:
            eventStates.find((status: { EventID: number; StatusDes: string }) => status.EventID === event.eventId)
              ?.StatusDes || "",
        })),
        eventStates,
      ],
    }
  }, [pollingData])

  const processedData = useMemo(() => {
    if (!allData) return null
    return {
      dates: Array.from(new Set(allData.sysData[4].map((event) => event.formattedDate))),
      weapons: allData.sysData[1],
      genders: allData.sysData[2],
      types: allData.sysData[3],
    }
  }, [allData])

  const filteredEvents = useMemo(() => {
    if (!allData) return []

    const normalize = (v: any) => String(v ?? "").trim().toUpperCase()

    const mapGender = (v: any) => {
      const n = normalize(v)
      if (!n) return ""
      if (n === "F") return "W"
      if (n === "W") return "W"
      if (n === "M") return "M"
      if (String(v).includes("女子") || String(v).includes("女")) return "W"
      if (String(v).includes("男子") || String(v).includes("男")) return "M"
      return n
    }

    return allData.sysData[4].filter((event) => {
      const genderCode = mapGender(event.genderCode)

      // Fallback: try infer gender from event name when genderCode is missing or empty
      const name = String(event.eventName || "")
      const fallbackGenderFromName = (() => {
        if (name.includes("女子") || name.includes("女")) return "W"
        if (name.includes("男子") || name.includes("男")) return "M"
        return ""
      })()

      const eventGenderMapped = genderCode || mapGender(fallbackGenderFromName)
      const selectedGenderMapped = mapGender(selectedGender)

      return (
        (selectedDate === "all" || event.formattedDate === selectedDate) &&
        (selectedType === "all" || event.typeCode === selectedType) &&
        (selectedGender === "all" || eventGenderMapped === selectedGenderMapped) &&
        (selectedWeapon === "all" || event.weaponCode === selectedWeapon)
      )
    })
  }, [allData, selectedDate, selectedType, selectedGender, selectedWeapon])

  if (!params?.sportCode || (loading && !allData)) {
    return <LoadingOverlay />
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header sportCode={params.sportCode} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center space-y-4">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>

            <h2 className="text-2xl font-bold text-gray-900">
              {error.error === "SPORT_CODE_NOT_FOUND" ? "项目不存在" : "加载失败"}
            </h2>

            <div className="space-y-2">
              <p className="text-lg text-gray-700">{error.message}</p>
              <p className="text-sm text-gray-500">{error.details}</p>
            </div>

            {error.sportCode && (
              <div className="bg-gray-100 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <strong>项目代码:</strong> {error.sportCode}
                </p>
                {error.attemptedUrl && (
                  <p className="text-xs text-gray-500 mt-1 break-all">
                    <strong>尝试访问:</strong> {error.attemptedUrl}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <Button onClick={() => window.location.reload()} className="w-full">
                重新加载
              </Button>

              <Link href="/">
                <Button variant="outline" className="w-full bg-transparent">
                  返回首页
                </Button>
              </Link>

              {error.error === "SPORT_CODE_NOT_FOUND" && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>建议:</strong> 请检查项目代码是否正确，或联系管理员确认该项目是否可用。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header sportCode={params.sportCode} />
      <div className="flex-1 overflow-auto pb-16">
        <Banner sportCode={params.sportCode} />
        {processedData ? (
          <Filters
            sysData={processedData}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            selectedGender={selectedGender}
            setSelectedGender={setSelectedGender}
            selectedWeapon={selectedWeapon}
            setSelectedWeapon={setSelectedWeapon}
          />
        ) : (
          <LoadingOverlay inline />
        )}
        {allData ? (
          <Schedule events={filteredEvents} evnetstate={allData.sysData[5]} sportCode={params.sportCode} />
        ) : (
          <LoadingOverlay inline />
        )}
      </div>
    </div>
  )
}
