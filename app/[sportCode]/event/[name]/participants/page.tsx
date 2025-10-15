"use client"

import { useState, useEffect, useCallback } from "react"
import { Search } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import LoadingOverlay from "@/components/loading"
import { Button } from "@/components/ui/button"
import { buildApiUrl } from "@/lib/sport-config"

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ type: "no_data" | "other"; message: string } | null>(null)
  const [event, setEvent] = useState<Event | null>(null)

  const fetchEventAndParticipants = useCallback(async () => {
    if (!params?.sportCode || !params?.name) return

    try {
      setLoading(true)

      // Fetch event details
      const eventResponse = await fetch(buildApiUrl("/api/getAllData", {}, params.sportCode))
      if (!eventResponse.ok) {
        throw new Error(`HTTP error! status: ${eventResponse.status} when fetching event details`)
      }
      const eventData = await eventResponse.json()
      const currentEvent = eventData.sysData[4].find((e: Event) => e.eventCode === params.name)
      if (!currentEvent) {
        throw new Error("Event not found")
      }
      setEvent(currentEvent)

      // Determine directory based on typeCode
      const directory = currentEvent.typeCode === "T" ? "startListTeam" : "startList"

      // Fetch participants
      const participantsResponse = await fetch(
        buildApiUrl(
          "/api/getSysData",
          {
            eventCode: encodeURIComponent(params.name),
            directory: directory,
          },
          params.sportCode,
        ),
      )
      if (!participantsResponse.ok) {
        throw new Error(`HTTP error! status: ${participantsResponse.status} when fetching participants`)
      }
      const participantsData = await participantsResponse.json()

      if (Array.isArray(participantsData) && participantsData.length >= 1) {
        if (currentEvent.typeCode === "T") {
          setTeams(participantsData[0])
          setTeamMembers(participantsData[1])
          setReferees(participantsData[2])
        } else {
          setAthletes(participantsData[0])
          setReferees(participantsData[1])
        }
      } else {
        throw new Error("数据格式不正确")
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      if (error instanceof Error && error.message.includes("HTTP error! status: 500")) {
        setError({ type: "no_data", message: "当前没有数据" })
      } else {
        setError({
          type: "other",
          message: `Failed to load data: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    if (params?.sportCode && params?.name) {
      fetchEventAndParticipants()
    }
  }, [fetchEventAndParticipants, params])

  if (!params?.sportCode || !params?.name || loading) {
    return <LoadingOverlay />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className={`text-lg ${error.type === "no_data" ? "text-gray-600" : "text-red-500"} mb-4`}>
          {error.message}
        </div>
        {error.type === "other" && <Button onClick={() => fetchEventAndParticipants()}>重试</Button>}
      </div>
    )
  }

  const filteredAthletes = athletes.filter(
    (athlete) =>
      athlete.athName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      athlete.orgName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredTeams = teams.filter((team) => team.teamName.toLowerCase().includes(searchQuery.toLowerCase()))

  const filteredTeamMembers = teamMembers.filter(
    (member) =>
      member.athName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.orgName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredReferees = referees.filter((referee) =>
    referee.RegisterInfo.toLowerCase().includes(searchQuery.toLowerCase()),
  )

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
          <Label htmlFor="participant">{event?.typeCode === "T" ? "参赛队伍" : "参赛运动员"}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="referee" id="referee" />
          <Label htmlFor="referee">裁判员</Label>
        </div>
      </RadioGroup>

      <div className="bg-white rounded-lg border overflow-hidden">
        {userType === "participant" ? (
          event?.typeCode === "T" ? (
            <>
              <div className="grid grid-cols-[60px_1fr] bg-blue-500 text-white text-sm">
                <div className="p-2 text-center">序号</div>
                <div className="p-2">队伍信息</div>
              </div>
              {filteredTeams.map((team) => {
                const teamMembers = filteredTeamMembers.filter((member) => member.teamCode === team.teamCode)
                const teamOrg = teamMembers.length > 0 ? teamMembers[0].orgName : ""
                return (
                  <div key={team.teamCode} className="grid grid-cols-[60px_1fr] text-sm border-t first:border-t-0">
                    <div className="p-3 text-center">{team.teamOrder}</div>
                    <div className="p-3">
                      <div className="font-medium">
                        {team.teamName} / {teamOrg}
                      </div>
                      <div className="mt-1 text-gray-600">{teamMembers.map((member) => member.athName).join("、")}</div>
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
