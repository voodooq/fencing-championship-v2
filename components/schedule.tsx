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

export default function Schedule({ events, evnetstate = [], sportCode }: ScheduleProps) {
  if (events.length === 0) {
    return <div className="flex-1 overflow-auto px-4 py-8 text-center text-gray-500">没有符合筛选条件的赛事</div>
  }

  const groupedEvents = events.reduce(
    (acc, event) => {
      if (!acc[event.formattedDate]) {
        acc[event.formattedDate] = []
      }
      acc[event.formattedDate].push(event)
      return acc
    },
    {} as Record<string, Event[]>,
  )

  const getEventState = (eventId: number) => {
    return evnetstate?.find((state) => state.EventID === eventId)
  }

  return (
    <div className="flex-1 overflow-auto px-4">
      {Object.entries(groupedEvents).map(([date, dayEvents]) => (
        <div key={date} className="mb-4 border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-white border-b">
            <h2 className="text-gray-700 text-sm">{date}</h2>
          </div>
          <div>
            <div className="grid grid-cols-[80px_1fr_120px] px-3 py-1.5 bg-blue-500 text-white text-sm">
              <div>时间</div>
              <div>项目名称</div>
              <div>状态</div>
            </div>
            {dayEvents.map((event) => (
              <Link
                key={event.eventId}
                href={
                  sportCode
                    ? buildSportPath(sportCode, `/event/${encodeURIComponent(event.eventCode)}`)
                    : `/event/${encodeURIComponent(event.eventCode)}`
                }
                className="grid grid-cols-[80px_1fr_120px] px-3 py-2 bg-white text-sm hover:bg-gray-50 border-b last:border-b-0"
              >
                <div>{event.openTime.substring(0, 5)}</div>
                <div className="whitespace-nowrap overflow-hidden text-ellipsis">{event.eventName}</div>
                <div>{getEventState(event.eventId)?.StatusDes || "未开始"}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
