"use client"

import React, { createContext, useContext, useCallback, useMemo } from "react"
import { usePolling } from "@/hooks/use-polling"

interface Event {
  eventId: number
  eventCode: string
  eventName: string
  competitionNo: number
  typeCode: string
}

interface EventState {
  EventID: number
  StatusDes: string
  RunPhaseID: number | null
}

interface EventDataContextValue {
  /** 完整的 sysData 数组 */
  sysData: any[] | null
  /** 当前事件信息 */
  event: Event | null
  /** 事件状态列表 */
  eventStates: EventState[]
  /** 数据加载中 */
  loading: boolean
  /** 错误信息 */
  error: any
  /** 手动刷新 */
  refresh: () => void
}

const EventDataContext = createContext<EventDataContextValue>({
  sysData: null,
  event: null,
  eventStates: [],
  loading: true,
  error: null,
  refresh: () => {},
})

/**
 * 消费 EventData Context 的 Hook
 * 子页面通过此 Hook 获取共享的事件数据，避免重复请求 sysData
 */
export function useEventData(): EventDataContextValue {
  return useContext(EventDataContext)
}

interface EventDataProviderProps {
  sportCode: string
  eventName: string
  children: React.ReactNode
}

/**
 * 事件数据 Provider
 *
 * 核心设计：
 * - Layout 层通过 batchFetch 轮询 sysData + eventState
 * - 支持 ETag 指纹比对、指数退避、可见性感知
 * - 子页面通过 useEventData() 直接获取共享数据，不再单独请求
 * - 消除了之前 Layout(getAllData) + 子页面(batchFetch sysData) 的双重轮询
 */
export function EventDataProvider({ sportCode, eventName, children }: EventDataProviderProps) {
  const fetchFn = useCallback(async (_isPolling: boolean, etag?: string) => {
    const response = await fetch("/api/batchFetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(etag ? { "if-none-match": etag } : {}),
      },
      body: JSON.stringify({
        sportCode,
        requests: [
          { key: "sysData", type: "sysData" },
          { key: "eventState", directory: "eventState", eventCode: "eventState" },
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
      return { modified: true, data: result.data, etag: result.etag }
    }

    return result
  }, [sportCode])

  const { data: pollingData, loading, error, refresh } = usePolling<Record<string, any>>({
    fetchFn,
    enabled: !!sportCode && !!eventName,
    cacheKey: `event_layout_${sportCode}`,
  })

  // 从轮询数据中提取事件信息
  const contextValue = useMemo<EventDataContextValue>(() => {
    if (!pollingData) {
      return { sysData: null, event: null, eventStates: [], loading, error, refresh }
    }

    const sysData = pollingData.sysData
    if (!Array.isArray(sysData) || sysData.length < 5) {
      return { sysData: null, event: null, eventStates: [], loading, error, refresh }
    }

    const eventList = sysData[4] as Event[]
    const decodedName = decodeURIComponent(eventName)
    const currentEvent = eventList?.find((e) => e.eventCode === decodedName) || null
    const eventStates: EventState[] = pollingData.eventState || sysData[5] || []

    return {
      sysData,
      event: currentEvent,
      eventStates,
      loading,
      error,
      refresh,
    }
  }, [pollingData, loading, error, refresh, eventName])

  return (
    <EventDataContext.Provider value={contextValue}>
      {children}
    </EventDataContext.Provider>
  )
}
