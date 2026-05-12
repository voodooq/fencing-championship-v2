import React, { useMemo } from "react"
import Link from "next/link"
import { buildSportPath } from "../lib/sport-config"

interface Event {
  eventId: number
  eventCode: string
  eventName: string
  formattedDate: string
  openTime: string
  hasPool: number
}

interface EventState {
  EventID: number
  StatusDes: string
  RunPhaseID: number | null
}

interface ScheduleProps {
  events: Event[]
  evnetstate?: EventState[]
  sportCode?: string
}

/**
 * 根据赛事状态决定跳转到哪个子页面
 * 让用户直接看到当前最有价值的信息，而不是总从第一个 tab 开始
 */
function getTargetPage(statusDes: string): string {
  if (!statusDes) return "rounds"

  // 最终排名 → 排名页
  if (statusDes.includes("最终排名") || statusDes.includes("排名")) {
    return "rankings"
  }

  // 对阵表相关状态 → 对阵表页
  if (
    statusDes.includes("决赛") ||
    statusDes.includes("半决赛") ||
    statusDes.includes("8表") ||
    statusDes.includes("16表") ||
    statusDes.includes("32表") ||
    statusDes.includes("64表") ||
    statusDes.includes("128表") ||
    statusDes.includes("淘汰")
  ) {
    return "brackets"
  }

  // 小组赛相关 → 小组赛页
  if (statusDes.includes("小组") || statusDes.includes("循环")) {
    return "groups"
  }

  // 检录相关 → 检录页
  if (statusDes.includes("检录") || statusDes.includes("签到")) {
    return "checkin"
  }

  // 默认 → 比赛轮次
  return "rounds"
}

/**
 * 赛程列表组件
 * NOTE: 使用 React.memo 避免父组件（首页）筛选条件变化但 events 不变时的不必要重渲染
 */
const Schedule = React.memo(function Schedule({ events, evnetstate = [], sportCode }: ScheduleProps) {
  // NOTE: 预计算 eventState 查找表，避免每个事件行都做 Array.find
  const eventStateMap = useMemo(() => {
    const map = new Map<number, EventState>()
    evnetstate.forEach((state) => map.set(state.EventID, state))
    return map
  }, [evnetstate])

  // NOTE: 预计算分组数据，避免每次渲染都重新分组
  const groupedEvents = useMemo(() => {
    const groups: Record<string, Event[]> = {}
    events.forEach((event) => {
      if (!groups[event.formattedDate]) {
        groups[event.formattedDate] = []
      }
      groups[event.formattedDate].push(event)
    })
    return Object.entries(groups)
  }, [events])

  if (events.length === 0) {
    return <div className="flex-1 overflow-auto px-4 py-8 text-center text-gray-500">没有符合筛选条件的赛事</div>
  }

  return (
    <div className="flex-1 overflow-auto px-4">
      {groupedEvents.map(([date, dayEvents]) => (
        <div key={date} className="mb-4 border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-white border-b">
            <h2 className="text-gray-700 text-sm">{date}</h2>
          </div>
          <div>
            <div className="grid grid-cols-[80px_1fr_120px] px-3 py-1.5 bg-blue-500 text-white text-sm">
              <div>时间</div>
              <div>项目名称</div>
              <div className="text-right">状态</div>
            </div>
            {dayEvents.map((event) => {
              const state = eventStateMap.get(event.eventId)
              const statusDes = state?.StatusDes || ""
              const targetPage = getTargetPage(statusDes)
              // NOTE: brackets 页面需要知道当前阶段以自动定位
              const phaseQuery = targetPage === "brackets" && statusDes ? `?phase=${encodeURIComponent(statusDes)}` : ""
              return (
                <Link
                  key={event.eventId}
                  href={
                    sportCode
                      ? buildSportPath(sportCode, `/event/${encodeURIComponent(event.eventCode)}/${targetPage}${phaseQuery}`)
                      : `/event/${encodeURIComponent(event.eventCode)}/${targetPage}${phaseQuery}`
                  }
                  className="grid grid-cols-[80px_1fr_120px] px-3 py-2 bg-white text-sm hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div>{event.openTime.substring(0, 5)}</div>
                  <div className="whitespace-nowrap overflow-hidden text-ellipsis">{event.eventName}</div>
                  <div className="text-right">{statusDes || "未开始"}</div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
})

export default Schedule
