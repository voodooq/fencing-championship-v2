"use client"

import { useState, useEffect, useMemo } from "react"
import { notFound, redirect } from "next/navigation"
import Header from "../../components/header"
import Banner from "../../components/banner"
import Filters from "../../components/filters"
import Schedule from "../../components/schedule"
import LoadingOverlay from "../../components/loading"
import { buildApiUrl } from "../../lib/sport-config"
import { isValidSportCode } from "../../config/sports"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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
  const [allData, setAllData] = useState<AllData | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedGender, setSelectedGender] = useState<string>("all")
  const [selectedWeapon, setSelectedWeapon] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params?.sportCode) {
      // 验证 sportCode 格式是否有效（不再检查是否在预定义列表中）
      if (!isValidSportCode(params.sportCode)) {
        notFound()
        return
      }

      fetchData()
    }
  }, [params])

  const fetchData = async () => {
    if (!params?.sportCode) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        buildApiUrl("/api/getAllData", { timestamp: Date.now().toString() }, params.sportCode),
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (errorData.error === "SPORT_CODE_NOT_FOUND") {
          redirect("/")
          return
        } else {
          setError({
            error: "HTTP_ERROR",
            message: `请求失败 (${response.status})`,
            details: `服务器返回 ${response.status} 错误，请稍后重试。`,
            sportCode: params.sportCode,
          })
        }
        return
      }

      const data = await response.json()

      if (data.error) {
        if (data.error === "SPORT_CODE_NOT_FOUND") {
          redirect("/")
          return
        }
        setError(data as ApiError)
        return
      }

      if (!data || !data.sysData || !Array.isArray(data.sysData) || data.sysData.length < 6) {
        setError({
          error: "INVALID_DATA_STRUCTURE",
          message: "数据结构无效",
          details: "服务器返回的数据格式不正确，请联系管理员。",
          sportCode: params.sportCode,
        })
        return
      }

      // Process the data to include statusDes
      const processedData = {
        ...data,
        sysData: [
          ...data.sysData.slice(0, 4),
          data.sysData[4].map((event: Event) => ({
            ...event,
            statusDes:
              data.sysData[5].find((status: { EventID: number; StatusDes: string }) => status.EventID === event.eventId)
                ?.StatusDes || "",
          })),
          data.sysData[5],
        ],
      }

      setAllData(processedData)
    } catch (error) {
      console.error("Error fetching data:", error)
      setError({
        error: "NETWORK_ERROR",
        message: "网络连接失败",
        details: `无法连接到服务器，请检查网络连接后重试。错误详情: ${error instanceof Error ? error.message : String(error)}`,
        sportCode: params.sportCode,
      })
    } finally {
      setLoading(false)
    }
  }

  const processedData = useMemo(() => {
    if (!allData) return null
    return {
      dates: Array.from(new Set(allData.sysData[4].map((event) => event.formattedDate))),
      weapons: allData.sysData[1],
      genders: allData.sysData[2],
      types: allData.sysData[3], // Using the correct index for types
    }
  }, [allData])

  const filteredEvents = useMemo(() => {
    if (!allData) return []
    return allData.sysData[4].filter(
      (event) =>
        (selectedDate === "all" || event.formattedDate === selectedDate) &&
        (selectedType === "all" || event.typeCode === selectedType) &&
        (selectedGender === "all" || event.genderCode === selectedGender) &&
        (selectedWeapon === "all" || event.weaponCode === selectedWeapon),
    )
  }, [allData, selectedDate, selectedType, selectedGender, selectedWeapon])

  if (!params?.sportCode || loading) {
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
          <LoadingOverlay />
        )}
        {allData ? (
          <Schedule events={filteredEvents} evnetstate={allData.sysData[5]} sportCode={params.sportCode} />
        ) : (
          <LoadingOverlay />
        )}
      </div>
    </div>
  )
}
