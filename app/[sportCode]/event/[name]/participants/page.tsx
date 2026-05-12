"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Search } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import LoadingOverlay from "@/components/loading"
import { Button } from "@/components/ui/button"
import { usePolling } from "@/hooks/use-polling"
import { useEventData } from "@/contexts/event-data-context"

interface Athlete {
  eventId: number
  eventCode: string
  athOrder: number
  orgCode: string
  orgName: string
  athCode: string
  athName: string
  pointRank: number | null
}

interface Referee {
  RowNum: number
  RegisterInfo: string
  SexName: string
  Weapon: string
  Category: string
}

interface Team {
  eventId: number
  eventCode: string
  teamOrder: number
  teamCode: string
  teamName: string
}

interface TeamMember {
  eventCode: string
  teamCode: string
  athId: number
  athCode: string
  athName: string
  orgCode: string
  orgName: string
}

interface Event {
  eventId: number
  eventCode: string
  eventName: string
  typeCode: string
}

interface ParticipantsPageProps {
  params: { sportCode: string; name: string }
}

export default function ParticipantsPage({ params }: ParticipantsPageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [userType, setUserType] = useState<"participant" | "referee">("participant")
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [referees, setReferees] = useState<Referee[]>([])
  const [error, setError] = useState<{ type: "no_data" | "other"; message: string } | null>(null)

  // NOTE: 从 Context 获取事件数据，不再单独请求 sysData
  const { event: contextEvent } = useEventData()

  /**
   * 获取参赛名单数据
   * 改进：直接从 Context 获取 event 信息，省去了之前的 sysData 请求
   */
  const fetchFn = useCallback(async (isPolling: boolean, etag?: string) => {
    if (!params?.sportCode || !params?.name) return null

    // 只请求实际需要的参赛名单数据（不再重复请求 sysData）
    const requests = [
      { key: "startList", directory: "startList", eventCode: decodeURIComponent(params.name) },
      { key: "startListTeam", directory: "startListTeam", eventCode: decodeURIComponent(params.name) }
    ]

    const batchResponse = await fetch("/api/batchFetch", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(etag ? { "if-none-match": etag } : {})
      },
      body: JSON.stringify({ sportCode: params.sportCode, requests }),
    })

    if (!batchResponse.ok) throw new Error(`Batch fetch failed: ${batchResponse.status}`)
    const batchRes = await batchResponse.json()

    // 兼容性处理
    const isNewFormat = batchRes && typeof batchRes === "object" && "modified" in batchRes;

    if (isNewFormat && batchRes.modified === false) {
      return { modified: false }
    }

    const rawResult = isNewFormat ? batchRes.data : batchRes;
    
    // 归一化处理：确保返回的是"数据集数组" (any[][])
    const finalData: any[][] = [];
    const addDataset = (data: any) => {
      if (!data || data.error) return;
      if (Array.isArray(data)) {
        if (data.length > 0 && Array.isArray(data[0])) {
          // 如果已经是二维数组（多 Sheet），打散放入
          finalData.push(...data);
        } else {
          // 如果是单层数组，直接放入
          finalData.push(data);
        }
      }
    };

    addDataset(rawResult?.startList);
    addDataset(rawResult?.startListTeam);

    if (finalData.length === 0) {
      // 没有任何数据，抛出错误以便触发"暂无数据"提示
      throw new Error("500: No participant data found");
    }

    return isNewFormat 
      ? { modified: true, data: finalData, etag: batchRes.etag }
      : finalData;
  }, [params])

  const { data: participantsData, loading, error: pollError, refresh } = usePolling({
    fetchFn,
    enabled: !!params?.sportCode && !!params?.name,
    cacheKey: `participants_${params.sportCode}_${params.name}`
  })

  // Update specific lists when participantsData changes
  useEffect(() => {
    if (Array.isArray(participantsData) && participantsData.length >= 1) {
      setAthletes([])
      setTeams([])
      setTeamMembers([])
      setReferees([])

      participantsData.forEach((arr: any[]) => {
        if (!Array.isArray(arr) || arr.length === 0) return
        const firstItem = arr[0]

        if ('RegisterInfo' in firstItem && 'RowNum' in firstItem) {
          setReferees(arr)
        } else if ('teamName' in firstItem && 'teamOrder' in firstItem && !('athName' in firstItem)) {
          setTeams(arr)
        } else if ('teamCode' in firstItem && 'athName' in firstItem) {
          setTeamMembers(arr)
        } else if ('athName' in firstItem && 'athOrder' in firstItem && !('teamCode' in firstItem)) {
          setAthletes(arr)
        }
      })
    }
  }, [participantsData])

  // Map pollError to existing error state
  useEffect(() => {
    if (pollError) {
      if (pollError.message?.includes("500")) {
        setError({ type: "no_data", message: "当前没有数据" })
      } else {
        setError({ type: "other", message: `Failed to load data: ${pollError.message}` })
      }
    } else {
      setError(null)
    }
  }, [pollError])

  const filteredAthletes = useMemo(() => athletes.filter(
    (athlete) =>
      athlete.athName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      athlete.orgName.toLowerCase().includes(searchQuery.toLowerCase()),
  ), [athletes, searchQuery])

  const filteredTeams = useMemo(() => teams.filter((team) => team.teamName.toLowerCase().includes(searchQuery.toLowerCase())), [teams, searchQuery])

  const filteredTeamMembers = useMemo(() => teamMembers.filter(
    (member) =>
      member.athName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.orgName.toLowerCase().includes(searchQuery.toLowerCase()),
  ), [teamMembers, searchQuery])

  const filteredReferees = useMemo(() => referees.filter((referee) =>
    referee.RegisterInfo.toLowerCase().includes(searchQuery.toLowerCase()),
  ), [referees, searchQuery])

  if (!params?.sportCode || !params?.name || (loading && athletes.length === 0 && teams.length === 0 && referees.length === 0)) {
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

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9 bg-white"
          placeholder="请输入要搜索人员的姓名或单位"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <RadioGroup
        defaultValue="participant"
        className="flex gap-6"
        value={userType}
        onValueChange={(value) => setUserType(value as "participant" | "referee")}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="participant" id="participant" />
          <Label htmlFor="participant">{contextEvent?.typeCode === "T" ? "参赛队伍" : "参赛运动员"}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="referee" id="referee" />
          <Label htmlFor="referee">裁判员</Label>
        </div>
      </RadioGroup>

      <div className="bg-white rounded-lg border overflow-hidden">
        {userType === "participant" ? (
          contextEvent?.typeCode === "T" ? (
            <>
              <div className="grid grid-cols-[60px_1fr] bg-blue-500 text-white text-sm">
                <div className="p-2 text-center">序号</div>
                <div className="p-2">队伍信息</div>
              </div>
              {filteredTeams.map((team) => {
                const members = filteredTeamMembers.filter((member) => member.teamCode === team.teamCode)
                const teamOrg = members.length > 0 ? members[0].orgName : ""
                return (
                  <div key={team.teamCode} className="grid grid-cols-[60px_1fr] text-sm border-t first:border-t-0">
                    <div className="p-3 text-center">{team.teamOrder}</div>
                    <div className="p-3">
                      <div className="font-medium">
                        {team.teamName} / {teamOrg}
                      </div>
                      <div className="mt-1 text-gray-600">{members.map((member) => member.athName).join("、")}</div>
                    </div>
                  </div>
                )
              })}
            </>
          ) : (
            <>
              <div className="grid grid-cols-[80px_1fr_100px] bg-blue-500 text-white text-sm">
                <div className="p-2 text-center">序号</div>
                <div className="p-2">姓名/单位</div>
                <div className="p-2 text-center">赛前排名</div>
              </div>
              {filteredAthletes.map((athlete) => (
                <div
                  key={athlete.athCode}
                  className="grid grid-cols-[80px_1fr_100px] text-sm border-t first:border-t-0"
                >
                  <div className="p-3 text-center">{athlete.athOrder}</div>
                  <div className="p-3">
                    {athlete.athName} / {athlete.orgName}
                  </div>
                  <div className="p-3 text-center">{athlete.pointRank || "-"}</div>
                </div>
              ))}
            </>
          )
        ) : (
          <>
            <div className="grid grid-cols-[60px_1fr_80px_80px] bg-blue-500 text-white text-sm">
              <div className="p-2 text-center">序号</div>
              <div className="p-2">姓名/单位</div>
              <div className="p-2 text-center">剑种</div>
              <div className="p-2 text-center">等级</div>
            </div>
            {filteredReferees.map((referee) => (
              <div
                key={referee.RowNum}
                className="grid grid-cols-[60px_1fr_80px_80px] text-sm border-t first:border-t-0"
              >
                <div className="p-3 text-center">{referee.RowNum}</div>
                <div className="p-3">{referee.RegisterInfo}</div>
                <div className="p-3 text-center">{referee.Weapon}</div>
                <div className="p-3 text-center">{referee.Category}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
