"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronUp } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import LoadingOverlay from "@/components/loading"
import { buildSportPath } from "../../../../lib/sport-config"
import { isValidSportCode, getSportConfig } from "../../../../config/sports"
import { Button } from "@/components/ui/button"
import React from "react"
import { useTestMode } from "../../../../hooks/use-test-mode"
import { EventDataProvider, useEventData } from "@/contexts/event-data-context"

interface ApiError {
  error: string
  message: string
  details: string
  sportCode?: string
  attemptedUrl?: string
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

/**
 * Event Layout 的内部组件
 * 从 EventDataContext 中获取共享的事件数据
 */
function EventLayoutInner({
  children,
  params,
}: {
  children: React.ReactNode
  params: { sportCode: string; name: string }
}) {
  const pathname = usePathname()
  const isTestMode = useTestMode()
  const { event, loading, error: dataError, refresh } = useEventData()

  // NOTE: 将 Context 错误映射为 ApiError 格式
  const error: ApiError | null = useMemo(() => {
    if (!dataError) return null
    return {
      error: "FETCH_ERROR",
      message: "数据加载失败",
      details: dataError instanceof Error ? dataError.message : String(dataError),
      sportCode: params.sportCode,
    }
  }, [dataError, params.sportCode])

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

  // 获取运动项目配置（可能是动态生成的）
  const sportConfig = getSportConfig(params.sportCode)

  if (!params?.sportCode || !params?.name || (loading && !event)) {
    return <LoadingOverlay />
  }

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
              <Button onClick={() => refresh()} className="w-full">
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
          {event.eventName} - {sportConfig.name}{isTestMode ? "-测试成绩" : ""}
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

        {/* NOTE: 通过 cloneElement 传递 event 信息给子页面（向后兼容） */}
        {React.cloneElement(children as React.ReactElement<any>, {
          typeCode: event.typeCode,
          event: event,
          sportCode: params.sportCode,
        })}
      </div>
      <BackToTopButton />
    </div>
  )
}

/**
 * Event Layout 外层组件
 * 负责 sportCode 格式校验和 EventDataProvider 包裹
 *
 * 改进点：
 * 1. 使用 EventDataProvider + usePolling 替代手动 setTimeout + getAllData
 * 2. 获得 ETag 指纹比对、指数退避、可见性感知等优化
 * 3. 子页面通过 useEventData() 共享数据，不再重复请求 sysData
 */
export default function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { sportCode: string; name: string }
}) {
  // 验证 sportCode 格式
  if (params?.sportCode && !isValidSportCode(params.sportCode)) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="flex items-center h-12 px-4 border-b bg-white">
          <Link href="/" className="p-1.5 -ml-1.5">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 text-center text-base font-medium">格式无效</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center space-y-4">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900">项目代码格式无效</h2>
            <p className="text-sm text-gray-500">
              项目代码 &quot;{params.sportCode}&quot; 格式不正确。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <EventDataProvider sportCode={params.sportCode} eventName={params.name}>
      <EventLayoutInner params={params}>{children}</EventLayoutInner>
    </EventDataProvider>
  )
}
