"use client"
import { useState, useEffect, useRef } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { JSX } from "react"

interface LogEntry {
  timestamp: string
  message: string
  type: "info" | "success" | "error"
}

interface EventItem {
  Id: number
  EventCode: string
  EventName: string
  StartDate: string
  StartTime: string
}

interface PhaseItem {
  Id: number
  PhaseName: string
  PhaseOrder: number
  completed?: boolean
}

export default function CompetitionManagement() {
  const [selectedDate, setSelectedDate] = useState("")
  const [loading, setLoading] = useState<string | null>(null)
  const [competitionCode, setCompetitionCode] = useState("")
  const [apiBaseUrl] = useState(
    process.env.NEXT_PUBLIC_PUSH_DATA_API_BASE_URL || "http://hhdata-d.yy-sport.com.cn:10087",
  )
  const [competitionInfo, setCompetitionInfo] = useState({
    name: "",
    code: "",
    publishUrl: "",
    sportId: "", // 添加 sportId 字段
    status: "", // 添加状态字段
  })
  const [eventList, setEventList] = useState<EventItem[]>([])
  const [filteredEventList, setFilteredEventList] = useState<EventItem[]>([])
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null) // 现在存储 EventCode
  const [selectedPhase, setSelectedPhase] = useState<PhaseItem | null>(null) // 新增：选中的阶段
  const [eventPhases, setEventPhases] = useState<Record<string, PhaseItem[]>>({}) // 使用 EventCode 作为 key
  const [logs, setLogs] = useState<LogEntry[]>([])

  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Add log entry
  const addLog = (message: string, type: "info" | "success" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => {
      const newLogs = [...prev, { timestamp, message, type }]
      // 使用 setTimeout 确保 DOM 更新后再滚动
      setTimeout(() => {
        if (scrollAreaRef.current) {
          const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight
          }
        }
      }, 0)
      return newLogs
    })
  }

  // Clear logs
  const clearLogs = () => {
    setLogs([])
  }

  // 排序函数
  const sortEvents = (events: EventItem[]): EventItem[] => {
    return events.sort((a, b) => {
      // 1. 按剑种排序：花剑、重剑、佩剑
      const getWeaponOrder = (eventName: string) => {
        if (eventName.includes("花剑")) return 1
        if (eventName.includes("重剑")) return 2
        if (eventName.includes("佩剑")) return 3
        return 4
      }

      const weaponOrderA = getWeaponOrder(a.EventName)
      const weaponOrderB = getWeaponOrder(b.EventName)
      if (weaponOrderA !== weaponOrderB) {
        return weaponOrderA - weaponOrderB
      }

      // 2. 按性别排序：男、女
      const getGenderOrder = (eventName: string) => {
        if (eventName.includes("男子") || eventName.includes("男")) return 1
        if (eventName.includes("女子") || eventName.includes("女")) return 2
        return 3
      }

      const genderOrderA = getGenderOrder(a.EventName)
      const genderOrderB = getGenderOrder(b.EventName)
      if (genderOrderA !== genderOrderB) {
        return genderOrderA - genderOrderB
      }

      // 3. 按类型排序：个人、团体
      const getTypeOrder = (eventName: string) => {
        if (eventName.includes("个人")) return 1
        if (eventName.includes("团体")) return 2
        return 3
      }

      const typeOrderA = getTypeOrder(a.EventName)
      const typeOrderB = getTypeOrder(b.EventName)
      if (typeOrderA !== typeOrderB) {
        return typeOrderA - typeOrderB
      }

      // 4. 按年龄组排序
      const getAgeOrder = (eventName: string) => {
        const ageMatch = eventName.match(/U(\d+)/)
        if (ageMatch) {
          return Number.parseInt(ageMatch[1])
        }
        if (eventName.includes("开放组")) return 999
        return 500
      }

      const ageOrderA = getAgeOrder(a.EventName)
      const ageOrderB = getAgeOrder(b.EventName)
      if (ageOrderA !== ageOrderB) {
        return ageOrderA - ageOrderB
      }

      // 5. 按开始时间排序（同一天内按时间正序）
      if (a.StartTime && b.StartTime) {
        return a.StartTime.localeCompare(b.StartTime)
      }

      return 0
    })
  }

  // 设置默认日期
  const setDefaultDate = (events: EventItem[]) => {
    if (events.length === 0) return

    // 按 StartDate 正序排列日期
    const dates = [...new Set(events.map((event) => event.StartDate))].sort()
    const today = new Date().toISOString().split("T")[0]

    // 如果今天有比赛，选择今天
    if (dates.includes(today)) {
      setSelectedDate(today)
    } else {
      // 否则选择最后一天的比赛
      setSelectedDate(dates[dates.length - 1])
    }

    setAvailableDates(dates)
  }

  // 根据日期筛选项目
  const filterEventsByDate = (events: EventItem[], date: string) => {
    if (!date) return events
    return events.filter((event) => event.StartDate === date)
  }

  // API call function
  const callAPI = async (endpoint: string, description: string, params: Record<string, any> = {}) => {
    setLoading(endpoint)
    addLog(`开始调用: ${description}`, "info")

    try {
      // Build query parameters
      const queryParams = new URLSearchParams()

      // 根据不同的端点使用不同的参数
      if (endpoint === "/api/OssData/GetSportInfo") {
        queryParams.append("sportCode", competitionCode)
      } else if (endpoint === "/api/OssData/GetEvenList") {
        // 获取赛事设项列表使用 sportId
        if (competitionInfo.sportId) {
          queryParams.append("sportId", competitionInfo.sportId)
        } else {
          throw new Error("请先获取赛事信息以获得 sportId")
        }
      } else if (endpoint === "/api/OssData/GetCurEventPhaseList") {
        // 获取赛事阶段列表使用 eventId
        if (params.eventId) {
          queryParams.append("eventId", params.eventId)
        } else {
          throw new Error("缺少 eventId 参数")
        }
      } else {
        // 所有其他接口都使用 sportCode 参数
        queryParams.append("sportCode", competitionCode)

        // 根据不同接口添加特定参数
        if (params.eventCode) {
          queryParams.append("eventCode", params.eventCode)
        }

        if (params.phaseId !== undefined) {
          queryParams.append("phaseId", params.phaseId.toString())
        }
      }

      // Add other parameters (除了已经处理的特殊参数)
      Object.entries(params).forEach(([key, value]) => {
        if (key !== "eventCode" && key !== "eventId" && key !== "phaseId") {
          queryParams.append(key, value.toString())
        }
      })

      const url = `${apiBaseUrl}${endpoint}?${queryParams.toString()}`
      addLog(`请求URL: ${url}`, "info")

      const controller = new AbortController()
      // 将超时时间从 10 秒延长到 30 秒
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
        },
        mode: "cors",
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type")
      let data

      if (contentType && contentType.includes("application/json")) {
        data = await response.json()
      } else {
        const text = await response.text()
        try {
          data = JSON.parse(text)
        } catch {
          data = { message: text, success: true }
        }
      }

      addLog(`${description} - 调用成功`, "success")
      addLog(`返回数据: ${JSON.stringify(data, null, 2)}`, "info")
      return data
    } catch (error) {
      let errorMessage = "未知错误"
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "请求超时 (60秒)"
        } else if (error.message.includes("Failed to fetch")) {
          errorMessage = "网络连接失败，请检查网络或联系管理员"
        } else {
          errorMessage = error.message
        }
      }
      addLog(`${description} - 调用失败: ${errorMessage}`, "error")
      throw error
    } finally {
      setLoading(null)
    }
  }

  // 1. Get competition info
  const getCompetitionInfo = async () => {
    try {
      const data = await callAPI("/api/OssData/GetSportInfo", "获取赛事信息")
      if (data && data.resultdata && Array.isArray(data.resultdata) && data.resultdata.length > 0) {
        const result = data.resultdata[0] // 取数组的第一个元素
        setCompetitionInfo({
          name: result.SportName || "获取成功",
          code: result.SportCode || competitionCode,
          publishUrl: result.InfoUrl || `http://fencing.yy-sport.com.cn:3021/${competitionCode}`,
          sportId: result.Id?.toString() || "", // Id 字段转为字符串
          status: result.Status?.toString() || "", // 状态信息
        })
        addLog(`赛事信息获取成功: ${result.SportName}`, "success")
        addLog(`SportId: ${result.Id}`, "info")
        addLog(`Status: ${result.Status}`, "info")
      } else {
        addLog("返回数据格式异常或无数据", "error")
      }
    } catch (error) {
      // Error already logged in callAPI
    }
  }

  // 2. Get event list
  const getEventList = async () => {
    try {
      if (!competitionInfo.sportId) {
        addLog("请先获取赛事信息以获得 sportId", "error")
        return
      }

      const data = await callAPI("/api/OssData/GetEvenList", "获取赛事设项列表")
      if (data && data.resultdata && Array.isArray(data.resultdata)) {
        const sortedEvents = sortEvents(data.resultdata)
        setEventList(sortedEvents)
        setDefaultDate(sortedEvents)
        addLog(`获取到 ${data.resultdata.length} 个赛事项目`, "success")
      } else {
        addLog("设项列表数据格式异常", "error")
        setEventList([])
      }
    } catch (error) {
      // Error already logged in callAPI
    }
  }

  // 3. Get event phase list
  const getEventPhaseList = async (eventId: string) => {
    try {
      const data = await callAPI("/api/OssData/GetCurEventPhaseList", "获取赛事阶段", { eventId })
      if (data && data.resultdata && Array.isArray(data.resultdata)) {
        // 按阶段顺序排序
        const sortedPhases = data.resultdata.sort((a: PhaseItem, b: PhaseItem) => a.PhaseOrder - b.PhaseOrder)
        setEventPhases((prev) => ({
          ...prev,
          [eventId]: sortedPhases,
        }))
        addLog(`获取到 ${data.resultdata.length} 个赛事阶段`, "success")
      } else {
        addLog("赛事阶段数据格式异常", "error")
        setEventPhases((prev) => ({
          ...prev,
          [eventId]: [],
        }))
      }
    } catch (error) {
      // Error already logged in callAPI
    }
  }

  // Generic upload function
  const performUpload = async (endpoint: string, description: string, params = {}) => {
    try {
      await callAPI(endpoint, description, params)
    } catch (error) {
      // Error already logged
    }
  }

  // Upload functions - 根据提供的API格式修正
  const uploadSystemData = () => performUpload("/api/OssData/UploadSysData", "初始化赛事信息")
  const uploadAllStartList = () => performUpload("/api/OssData/AllStartList", "初始化报项信息")

  const uploadPoolResult = () => {
    if (!selectedEvent) {
      addLog("请先选择项目", "error")
      return
    }
    // 找到对应的EventCode
    const selectedEventData = eventList.find((event) => event.Id.toString() === selectedEvent)
    const eventCode = selectedEventData?.EventCode
    if (!eventCode) {
      addLog("无法找到项目的EventCode", "error")
      return
    }
    performUpload("/api/OssData/UploadPoolResult", "批量上传小组成绩", { eventCode })
  }

  const uploadPoolRank = () => {
    if (!selectedEvent) {
      addLog("请先选择项目", "error")
      return
    }
    const selectedEventData = eventList.find((event) => event.Id.toString() === selectedEvent)
    const eventCode = selectedEventData?.EventCode
    if (!eventCode) {
      addLog("无法找到项目的EventCode", "error")
      return
    }
    performUpload("/api/OssData/UploadPoolRank", "上传小组赛赛后排名", { eventCode })
  }

  const uploadPhaseOfEvent = () => {
    if (!selectedEvent) {
      addLog("请先选择项目", "error")
      return
    }
    const selectedEventData = eventList.find((event) => event.Id.toString() === selectedEvent)
    const eventCode = selectedEventData?.EventCode
    if (!eventCode) {
      addLog("无法找到项目的EventCode", "error")
      return
    }
    performUpload("/api/OssData/UploadPhaseOfEvent", "批量上传对阵及成绩", { eventCode })
  }

  const uploadAllDualPhase = () => {
    if (!selectedPhase) {
      addLog("请先选择淘汰赛阶段", "error")
      return
    }
    // 使用选中阶段的 phaseId
    performUpload("/api/OssData/AllDualPhase", `上传对阵及成绩 - ${selectedPhase.PhaseName}`, {
      phaseId: selectedPhase.Id,
    })
  }

  const uploadEventResult = () => {
    if (!selectedEvent) {
      addLog("请先选择项目", "error")
      return
    }
    const selectedEventData = eventList.find((event) => event.Id.toString() === selectedEvent)
    const eventCode = selectedEventData?.EventCode
    if (!eventCode) {
      addLog("无法找到项目的EventCode", "error")
      return
    }
    performUpload("/api/OssData/UploadEventRank", "上传最终排名", { eventCode })
  }

  const uploadAllPoolRank = () => performUpload("/api/OssData/AllPoolRank", "批量上传小组赛后排名")
  const uploadAllEventRank = () => performUpload("/api/OssData/AllEventRank", "批量上传最终排名")

  // Handle event selection
  const handleEventSelect = (eventId: string, eventName: string) => {
    if (selectedEvent === eventId) {
      // 如果点击的是已选中的项目，则取消选中
      setSelectedEvent(null)
      setSelectedPhase(null) // 清空选中的阶段
    } else {
      // 选中新项目
      setSelectedEvent(eventId)
      setSelectedPhase(null) // 清空之前选中的阶段
      addLog(`选择项目: ${eventName} (ID: ${eventId})`, "info")

      // 如果还没有获取过该项目的阶段信息，则获取
      if (!eventPhases[eventId]) {
        getEventPhaseList(eventId)
      }
    }
  }

  // Handle phase selection
  const handlePhaseSelect = (phase: PhaseItem) => {
    if (selectedPhase?.Id === phase.Id) {
      // 如果点击的是已选中的阶段，则取消选中
      setSelectedPhase(null)
      addLog(`取消选择阶段: ${phase.PhaseName}`, "info")
    } else {
      // 选中新阶段
      setSelectedPhase(phase)
      addLog(`选择阶段: ${phase.PhaseName} (ID: ${phase.Id})`, "info")
    }
  }

  const handleCompetitionCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCode = e.target.value.toUpperCase()
    setCompetitionCode(newCode)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
  }

  const openPublishUrl = () => {
    if (competitionInfo.publishUrl) {
      window.open(competitionInfo.publishUrl, "_blank")
    }
  }

  // Get status display text
  const getStatusText = (status: string) => {
    switch (status) {
      case "0":
        return "未开始"
      case "1":
        return "进行中"
      case "2":
        return "已结束"
      default:
        return status || "-"
    }
  }

  // Load event list when competition info is loaded and sportId is available
  useEffect(() => {
    if (competitionInfo.code && competitionInfo.sportId) {
      getEventList()
    }
  }, [competitionInfo.code, competitionInfo.sportId])

  // Filter events when date changes
  useEffect(() => {
    const filtered = filterEventsByDate(eventList, selectedDate)
    setFilteredEventList(filtered)
  }, [eventList, selectedDate])

  // 渲染表格行（包括项目和其阶段）
  const renderTableRows = (): JSX.Element[] => {
    const rows: JSX.Element[] = []

    filteredEventList.forEach((event) => {
      const eventId = event.Id.toString()
      const isSelected = selectedEvent === eventId
      const phases = eventPhases[eventId] || []

      // 项目行
      rows.push(
        <TableRow
          key={event.Id}
          className={`border-b cursor-pointer hover:bg-blue-50 ${isSelected ? "bg-blue-100" : ""}`}
          onClick={() => handleEventSelect(event.Id.toString(), event.EventName)}
        >
          <TableCell className="text-sm py-2 font-medium text-blue-600">{event.EventName}</TableCell>
          <TableCell className="text-sm py-2 text-gray-500">{event.StartTime}</TableCell>
          <TableCell className="text-sm py-2 text-gray-400">
            {isSelected ? `${phases.length} 个阶段` : "点击查看阶段"}
          </TableCell>
        </TableRow>,
      )

      // 如果项目被选中，在其下方显示阶段行
      if (isSelected && phases.length > 0) {
        phases.forEach((phase, index) => {
          const isPhaseSelected = selectedPhase?.Id === phase.Id
          rows.push(
            <TableRow
              key={`phase-${eventId}-${index}`}
              className={`border-b cursor-pointer hover:bg-green-50 ${isPhaseSelected ? "bg-green-100" : "bg-blue-50"}`}
              onClick={(e) => {
                e.stopPropagation() // 防止触发项目选择
                handlePhaseSelect(phase)
              }}
            >
              <TableCell className="text-sm py-2"></TableCell>
              <TableCell className="text-sm py-2"></TableCell>
              <TableCell
                className={`text-sm py-2 pl-8 ${isPhaseSelected ? "text-green-700 font-medium" : "text-gray-600"}`}
              >
                └ {phase.PhaseName} {isPhaseSelected && "(已选中)"}
              </TableCell>
            </TableRow>,
          )
        })
      }
    })

    return rows
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column */}
          <div className="col-span-8 space-y-4">
            {/* Competition Code Input */}
            <Card className="bg-white">
              <CardHeader className="bg-sky-500 text-white py-3">
                <CardTitle className="text-base font-medium">赛事编码输入</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">赛事编码:</span>
                  <Input
                    type="text"
                    value={competitionCode}
                    onChange={handleCompetitionCodeChange}
                    placeholder="请输入赛事编码，如：RZSS2033043"
                    className="flex-1 text-sm"
                  />
                  <Button
                    size="sm"
                    className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 text-sm"
                    onClick={getCompetitionInfo}
                    disabled={loading === "/api/OssData/GetSportInfo" || !competitionCode}
                  >
                    {loading === "/api/OssData/GetSportInfo" ? "获取中..." : "获取赛事信息"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Competition Basic Information */}
            <Card className="bg-white">
              <CardHeader className="bg-sky-400 text-white py-3">
                <CardTitle className="text-base font-medium">赛事基础信息</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center">
                  <span className="w-16 text-sm text-gray-600">赛事名称:</span>
                  <span className="text-sm">{competitionInfo.name || "请先输入赛事编码"}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-16 text-sm text-gray-600">赛事编码:</span>
                  <span className="text-sm">{competitionInfo.code || "-"}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-16 text-sm text-gray-600">SportId:</span>
                  <span className="text-sm">{competitionInfo.sportId || "-"}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-16 text-sm text-gray-600">赛事状态:</span>
                  <span className="text-sm">
                    {getStatusText(competitionInfo.status)}
                    {competitionInfo.status && <span className="text-gray-400 ml-1">({competitionInfo.status})</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-sm text-gray-600">发布地址:</span>
                  <span className="flex-1 text-sm text-gray-700">{competitionInfo.publishUrl || "-"}</span>
                  <Button
                    size="sm"
                    className="bg-sky-400 hover:bg-sky-500 text-white px-3 py-1 text-sm"
                    onClick={openPublishUrl}
                    disabled={!competitionInfo.publishUrl}
                  >
                    打开
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardHeader className="bg-sky-400 text-white py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-medium">批量上传所有项目的数据</CardTitle>
                <div className="bg-white text-gray-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                  01
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Button
                    className={`px-4 py-2 text-sm transition-colors ${
                      competitionInfo.code && competitionInfo.sportId
                        ? "bg-sky-500 hover:bg-sky-600 text-white"
                        : "bg-sky-200 text-sky-400 cursor-not-allowed"
                    }`}
                    onClick={uploadSystemData}
                    disabled={
                      loading === "/api/OssData/UploadSysData" || !competitionInfo.code || !competitionInfo.sportId
                    }
                  >
                    {loading === "/api/OssData/UploadSysData" ? "上传中..." : "初始化赛事信息"}
                  </Button>
                  <Button
                    className={`px-4 py-2 text-sm transition-colors ${
                      competitionInfo.code && competitionInfo.sportId
                        ? "bg-sky-500 hover:bg-sky-600 text-white"
                        : "bg-sky-200 text-sky-400 cursor-not-allowed"
                    }`}
                    onClick={uploadAllStartList}
                    disabled={
                      loading === "/api/OssData/AllStartList" || !competitionInfo.code || !competitionInfo.sportId
                    }
                  >
                    {loading === "/api/OssData/AllStartList" ? "上传中..." : "初始化报项信息"}
                  </Button>
                </div>
                {(!competitionInfo.code || !competitionInfo.sportId) && (
                  <div className="text-xs text-gray-500 mt-2">
                    {!competitionInfo.code ? "请先获取赛事信息后再进行操作" : "赛事信息不完整，请重新获取"}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardHeader className="bg-sky-400 text-white py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-medium">批量上传选中项目的数据</CardTitle>
                <div className="bg-white text-gray-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                  02
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Date Selection */}
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">2-0</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">比赛日期:</span>
                      <select
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-36 text-sm border border-gray-300 rounded px-2 py-1"
                        disabled={!competitionInfo.code}
                      >
                        <option value="">请选择日期</option>
                        {availableDates.map((date) => (
                          <option key={date} value={date}>
                            {date}
                          </option>
                        ))}
                      </select>
                      {selectedDate && (
                        <span className="text-xs text-gray-500">({filteredEventList.length} 个项目)</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-4">
                    {/* Events and Phases Table */}
                    <div className="col-span-7">
                      <div className="border rounded">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-sm font-medium text-gray-700 py-2">项目名称</TableHead>
                              <TableHead className="text-sm font-medium text-gray-700 py-2">开始时间</TableHead>
                              <TableHead className="text-sm font-medium text-gray-700 py-2">淘汰赛阶段</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {/* 渲染项目和阶段行 */}
                            {renderTableRows()}
                            {/* Empty state */}
                            {filteredEventList.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-gray-500 py-4">
                                  {!competitionInfo.sportId
                                    ? "请先获取赛事信息以加载项目列表"
                                    : !selectedDate
                                      ? "请选择比赛日期"
                                      : "该日期暂无项目数据"}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      
                    </div>

                    {/* Action Buttons */}
                    <div className="col-span-5 space-y-3">
                                            {/* 选中状态提示 */}
                      {selectedEvent && (
                        <div className="mt-2 text-xl text-gray-600">
                          <div>已选中项目: {eventList.find((e) => e.Id.toString() === selectedEvent)?.EventName}</div>
                          {selectedPhase && <div className="text-xl text-green-600 mt-2">已选中阶段: {selectedPhase.PhaseName}</div>}
                        </div>
                      )}
                      {!selectedEvent && competitionInfo.code && (
                        <div className="text-xl text-gray-500 mt-2">请先选择项目后再进行上传操作</div>
                      )}
                      {selectedEvent && !selectedPhase && (
                        <div className="text-xl text-orange-500 mt-2">请选择淘汰赛阶段"上传对阵及成绩"</div>
                      )}
                      <div className="flex items-center gap-2">
                        
                        
                        <div className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">2-1</div>
                        <Button
                          className={`flex-1 text-sm py-2 transition-colors ${
                            selectedEvent
                              ? "bg-sky-500 hover:bg-sky-600 text-white"
                              : "bg-sky-200 text-sky-400 cursor-not-allowed"
                          }`}
                          onClick={uploadPoolResult}
                          disabled={!selectedEvent || loading === "/api/OssData/UploadPoolResult"}
                        >
                          {loading === "/api/OssData/UploadPoolResult" ? "上传中..." : "批量上传小组成绩"}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">2-2</div>
                        <Button
                          className={`flex-1 text-sm py-2 transition-colors ${
                            selectedEvent
                              ? "bg-sky-500 hover:bg-sky-600 text-white"
                              : "bg-sky-200 text-sky-400 cursor-not-allowed"
                          }`}
                          onClick={uploadPoolRank}
                          disabled={!selectedEvent || loading === "/api/OssData/UploadPoolRank"}
                        >
                          {loading === "/api/OssData/UploadPoolRank" ? "上传中..." : "上传小组赛赛后排名"}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">2-3</div>
                        <Button
                          className={`flex-1 text-sm py-2 transition-colors ${
                            selectedEvent
                              ? "bg-sky-500 hover:bg-sky-600 text-white"
                              : "bg-sky-200 text-sky-400 cursor-not-allowed"
                          }`}
                          onClick={uploadPhaseOfEvent}
                          disabled={!selectedEvent || loading === "/api/OssData/UploadPhaseOfEvent"}
                        >
                          {loading === "/api/OssData/UploadPhaseOfEvent" ? "上传中..." : "批量上传对阵及成绩"}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">2-4</div>
                        <Button
                          className={`flex-1 text-sm py-2 transition-colors ${
                            selectedPhase
                              ? "bg-sky-500 hover:bg-sky-600 text-white"
                              : "bg-sky-200 text-sky-400 cursor-not-allowed"
                          }`}
                          onClick={uploadAllDualPhase}
                          disabled={!selectedPhase || loading === "/api/OssData/AllDualPhase"}
                        >
                          {loading === "/api/OssData/AllDualPhase" ? "上传中..." : "上传对阵及成绩"}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">2-5</div>
                        <Button
                          className={`flex-1 text-sm py-2 transition-colors ${
                            selectedEvent
                              ? "bg-sky-500 hover:bg-sky-600 text-white"
                              : "bg-sky-200 text-sky-400 cursor-not-allowed"
                          }`}
                          onClick={uploadEventResult}
                          disabled={!selectedEvent || loading === "/api/OssData/UploadEventRank"}
                        >
                          {loading === "/api/OssData/UploadEventRank" ? "上传中..." : "上传最终排名"}
                        </Button>
                      </div>                      
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="col-span-4 flex flex-col gap-4 h-full">

            {/* Section 03 - Post-Competition Data Entry */}
            <Card className="bg-white">
              <CardHeader className="bg-sky-400 text-white py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-medium">赛后补录赛【特殊情况适用】</CardTitle>
                <div className="bg-white text-gray-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                  03
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Button
                    className={`flex-1 text-sm py-2 transition-colors ${
                      competitionInfo.code && competitionInfo.sportId
                        ? "bg-sky-500 hover:bg-sky-600 text-white"
                        : "bg-sky-200 text-sky-400 cursor-not-allowed"
                    }`}
                    onClick={uploadAllPoolRank}
                    disabled={
                      loading === "/api/OssData/AllPoolRank" || !competitionInfo.code || !competitionInfo.sportId
                    }
                  >
                    {loading === "/api/OssData/AllPoolRank" ? "上传中..." : "批量上传小组赛后排名"}
                  </Button>
                  <Button
                    className={`flex-1 text-sm py-2 transition-colors ${
                      competitionInfo.code && competitionInfo.sportId
                        ? "bg-sky-500 hover:bg-sky-600 text-white"
                        : "bg-sky-200 text-sky-400 cursor-not-allowed"
                    }`}
                    onClick={uploadAllEventRank}
                    disabled={
                      loading === "/api/OssData/AllEventRank" || !competitionInfo.code || !competitionInfo.sportId
                    }
                  >
                    {loading === "/api/OssData/AllEventRank" ? "上传中..." : "批量上传最终排名"}
                  </Button>
                </div>
                {(!competitionInfo.code || !competitionInfo.sportId) && (
                  <div className="text-xs text-gray-500 mt-2">
                    {!competitionInfo.code ? "请先获取赛事信息后再进行操作" : "赛事信息不完整，请重新获取"}
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Upload Return Information */}
            <Card className="bg-white flex-1 flex flex-col">
              <CardHeader className="bg-sky-300 text-white py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-medium">上传返回信息</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-white border-white hover:bg-sky-400 text-xs px-2 py-1 bg-transparent"
                  onClick={clearLogs}
                >
                  清空日志
                </Button>
              </CardHeader>
              <CardContent className="p-4 flex-1 flex flex-col">
                <ScrollArea
                  ref={scrollAreaRef}
                  className="bg-gray-50 rounded border-2 border-dashed border-gray-300 p-3 h-[600px] overflow-auto"
                >
                  {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      <div className="text-center">
                        <div>返回信息显示区域</div>
                        <div className="text-xs mt-2 text-gray-400">当前API地址: {apiBaseUrl}</div>
                        <div className="text-xs mt-1 text-gray-400">请求超时时间: 60秒</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {logs.map((log, index) => (
                        <div key={index} className="text-xs font-mono">
                          <span className="text-gray-500">[{log.timestamp}]</span>
                          <span
                            className={`ml-2 ${
                              log.type === "success"
                                ? "text-green-600"
                                : log.type === "error"
                                  ? "text-red-600"
                                  : "text-gray-700"
                            }`}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  )
}
