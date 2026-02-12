"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronLeft, ChevronUp } from "lucide-react"
import Link from "next/link"
import { DATA_POLLING_INTERVAL } from "@/config/site"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import LoadingOverlay from "@/components/loading"
import { buildApiUrl, buildSportPath } from "../../../../lib/sport-config"
import { isValidSportCode, getSportConfig } from "../../../../config/sports"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import React from "react"

interface Event {
  eventId: number
  eventCode: string
  eventName: string
  competitionNo: number
  typeCode: string
}

interface AllData {
  sysData: [any, any, any, any, Event[]]
}

interface ApiError {
  error: string
  message: string
  details: string
  sportCode?: string
}

const BackToTopButton = ({ isModalOpen = false }: { isModalOpen?: boolean }) => {
  if (isModalOpen) return null

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-lg transition-all duration-300 z-50 opacity-80 hover:opacity-100"
      aria-label="回到顶部"
    >
      <ChevronUp className="h-4 w-4" />
    </button>
  )
}

export default function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { sportCode: string; name: string }
}) {
  const pathname = usePathname()
  const [allData, setAllData] = useState<AllData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const topRowTabs = useMemo(
    () => [
      { id: "rounds", label: "比赛轮次" },
      { id: "participants", label: "参赛名单" },
    ],
    [],
  )

  const bottomRowTabs = useMemo(() => {
    // Base tabs that are always shown
    const baseTabs = [
      { id: "checkin", label: "检录信息" },
      { id: "brackets", label: "对阵表" },
      { id: "rankings", label: "最终排名" },
    ]

    // 只有个人赛有 "小组赛"
    if (event && event.typeCode !== "T") {
      // Insert the groups tab after checkin
      baseTabs.splice(1, 0, { id: "groups", label: "小组赛" })
    }

    return baseTabs
  }, [event]) // Depend on event to recalculate when it changes

  // Move validation inside useEffect after params are available
  useEffect(() => {
    if (params?.sportCode && params?.name) {
      // 验证 sportCode 格式是否有效
      if (!isValidSportCode(params.sportCode)) {
        notFound()
        return
      }

      const load = () => {
        fetchData().catch((error) => {
          console.error("Error in useEffect:", error)
          setError({
            error: "UNKNOWN_ERROR",
            message: "发生未知错误",
            details: `${error instanceof Error ? error.message : JSON.stringify(error)}`,
            sportCode: params.sportCode,
          })
        })
      }

      load()

      const intervalId = setInterval(() => fetchData(true), DATA_POLLING_INTERVAL)
      return () => clearInterval(intervalId)
    }
  }, [params])

  const setModalState = (isOpen: boolean) => {
    setIsModalOpen(isOpen)
  }

  const fetchData = async (isPolling = false) => {
    if (!params?.sportCode || !params?.name) return

    try {
      if (!isPolling) setLoading(true)
      setError(null)
      //console.log("Fetching data for sportCode:", params.sportCode)

      const response = await fetch(
        buildApiUrl("/api/getAllData", { timestamp: Date.now().toString() }, params.sportCode),
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
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

      const data: AllData = await response.json()

      //console.log("Fetched data:", data)
      setAllData(data)
      const currentEvent = data.sysData[4].find((e) => e.eventCode === decodeURIComponent(params.name))
      if (!currentEvent) {
        setError({
          error: "EVENT_NOT_FOUND",
          message: "赛事不存在",
          details: `在项目 "${params.sportCode}" 中找不到赛事 "${params.name}"`,
          sportCode: params.sportCode,
        })
        return
      }
      setEvent(currentEvent)
    } catch (error) {
      console.error("Error fetching data:", error)
      setError({
        error: "NETWORK_ERROR",
        message: "网络连接失败",
        details: `无法连接到服务器: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        sportCode: params.sportCode,
      })
    } finally {
      if (!isPolling) setLoading(false)
    }
  }

  if (!params?.sportCode || !params?.name || loading) {
    return <LoadingOverlay />
  }

  // 获取运动项目配置（可能是动态生成的）
  const sportConfig = getSportConfig(params.sportCode)

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="flex items-center h-12 px-4 border-b bg-white">
          <Link href={buildSportPath(params.sportCode)} className="p-1.5 -ml-1.5">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 text-center text-base font-medium">加载失败</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center space-y-4">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>

            <h2 className="text-2xl font-bold text-gray-900">{error.message}</h2>

            <p className="text-sm text-gray-500">{error.details}</p>

            {error.sportCode && (
              <div className="bg-gray-100 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <strong>项目代码:</strong> {error.sportCode}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>赛事代码:</strong> {params.name}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <Button onClick={() => fetchData().catch(console.error)} className="w-full">
                重新加载
              </Button>

              <Link href={buildSportPath(params.sportCode)}>
                <Button variant="outline" className="w-full bg-transparent">
                  返回项目首页
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 items-center justify-center">
        <div className="text-2xl font-semibold text-red-500">Event not found</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="flex items-center h-12 px-4 border-b bg-white">
        <Link href={buildSportPath(params.sportCode)} className="p-1.5 -ml-1.5">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-medium">
          {event.eventName} - {sportConfig.name}
        </h1>
      </header>

      <div className="bg-white border-b">
        <div className="flex flex-col max-w-screen-lg mx-auto w-full">
          {/* Top row tabs */}
          <div className="flex justify-start gap-2 px-4 py-2">
            {topRowTabs.map((tab) => (
              <Link
                key={tab.id}
                href={buildSportPath(params.sportCode, `/event/${params.name}/${tab.id}`)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-full transition-colors relative whitespace-nowrap",
                  pathname.endsWith(tab.id)
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 hover:text-gray-900 bg-gray-100/80",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          {/* Bottom row tabs */}
          <div className="flex justify-start gap-2 px-4 py-2">
            {bottomRowTabs.map((tab) => (
              <Link
                key={tab.id}
                href={buildSportPath(params.sportCode, `/event/${params.name}/${tab.id}`)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-full transition-colors relative whitespace-nowrap",
                  pathname.endsWith(tab.id)
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 hover:text-gray-900 bg-gray-100/80",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
          <div className="space-y-2">
            <div className="flex">
              <span className="text-gray-500">项目名称：</span>
              <span>{event.eventName}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500">参赛运动员数量：</span>
              <span>{event.competitionNo}</span>
            </div>
          </div>
        </div>

        {React.cloneElement(children as React.ReactElement<any>, {
          typeCode: event.typeCode,
          event: event,
          setModalOpen: setModalState,
          sportCode: params.sportCode,
        })}
      </div>
      <BackToTopButton isModalOpen={isModalOpen} />
    </div>
  )
}
