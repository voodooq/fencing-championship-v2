"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import LoadingOverlay from "@/components/loading"
import { buildApiUrl } from "@/lib/sport-config"

interface PoolFencer {
  eventCode: string
  phaseId: number
  poolCode: string
  poolName: string
  startTime: string
  piste: string
  poolReferee: string
  matchOrder: number
  F_DelegationShortName: string
  F_PrintLongName: string
  r1: string | null
  r2: string | null
  r3: string | null
  r4: string | null
  r5: string | null
  r6: string | null
  r7: string | null
  indexWin: string
  diff: number
  hs: number
  hr: number
}

interface PoolMatch {
  PhaseIdOfPool: number
  PoolName: string
  MatchRoundOrder: number
  HomePosition: number
  HomeAthlete: string
  HomeDelegation: string
  HomeResult: string
  AwayPosition: number
  AwayAthlete: string
  AwayDelegation: string
  AwayResult: string
  RowsOrder: number
}

interface PoolData {
  fencers: PoolFencer[]
  matches: PoolMatch[]
}

interface PoolRanking {
  poolRank: number
  interiorRank: number
  F_PrintLongName: string
  F_DelegationShortName: string
  indexWin: string
  matchOrder: number
  hs: number
  hr: number
  diff: number
  qualify: number
}

const sortFencersByMatchOrder = (fencers: PoolFencer[]) => {
  return [...fencers].sort((a, b) => a.matchOrder - b.matchOrder)
}

const sortPoolsByPiste = (pools: [string, PoolFencer[]][]) => {
  return [...pools].sort((a, b) => {
    const getPoolNumber = (poolName: string) => {
      const match = poolName.match(/P(\d+)/i)
      return match ? Number.parseInt(match[1], 10) : 999
    }

    const poolNumberA = getPoolNumber(a[0])
    const poolNumberB = getPoolNumber(b[0])

    return poolNumberA - poolNumberB
  })
}

export default function GroupsPage({ params }: { params: { sportCode: string; name: string } }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [view, setView] = useState<"results" | "rankings">("results")
  const [expandedPool, setExpandedPool] = useState<string | null>(null)
  const [poolData, setPoolData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ type: "no_data" | "other"; message: string } | null>(null)
  const [sortedPools, setSortedPools] = useState<[string, PoolFencer[]][]>([])
  const [expandedRows, setExpandedRows] = useState<number[]>([])
  const [poolRankings, setPoolRankings] = useState<PoolRanking[]>([])

  useEffect(() => {
    if (params?.sportCode && params?.name) {
      fetchData().catch((error) => {
        console.error("Unhandled error in fetchData:", error)
        setLoading(false)
      })
    }
  }, [params])

  const fetchData = async () => {
    if (!params?.sportCode || !params?.name) return

    try {
      setLoading(true)
      setError(null)

      // Fetch pool results
      const resultResponse = await fetch(
        buildApiUrl(
          "/api/getSysData",
          {
            eventCode: encodeURIComponent(params.name),
            directory: "poolResult",
          },
          params.sportCode,
        ),
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
      )
      if (!resultResponse.ok) {
        throw new Error(`HTTP error! status: ${resultResponse.status} when fetching pool results`)
      }
      const resultData = await resultResponse.json()
      if (!Array.isArray(resultData) || resultData.length < 2) {
        throw new Error(`Invalid data structure received: ${JSON.stringify(resultData)}`)
      }

      if (
        !Array.isArray(resultData[0]) ||
        resultData[0].some((fencer) => typeof fencer !== "object" || !("eventCode" in fencer))
      ) {
        throw new Error(`Invalid fencers data structure received: ${JSON.stringify(resultData[0])}`)
      }
      const fetchedPoolData = {
        fencers: resultData[0] as PoolFencer[],
        matches: resultData[1],
      }
      setPoolData(fetchedPoolData)

      // Fetch pool rankings
      const rankResponse = await fetch(
        buildApiUrl(
          "/api/getSysData",
          {
            eventCode: encodeURIComponent(params.name),
            directory: "poolRank",
          },
          params.sportCode,
        ),
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
      )
      if (!rankResponse.ok) {
        throw new Error(`HTTP error! status: ${rankResponse.status} when fetching pool rankings`)
      }
      const rankData = await rankResponse.json()
      if (!Array.isArray(rankData)) {
        throw new Error(`Invalid ranking data structure received: ${JSON.stringify(rankData)}`)
      }
      setPoolRankings(rankData)

      // Group and sort fencers by pool
      const groupedFencers = fetchedPoolData.fencers.reduce(
        (acc, fencer) => {
          if (!acc[fencer.poolName]) {
            acc[fencer.poolName] = []
          }
          acc[fencer.poolName].push(fencer)
          return acc
        },
        {} as Record<string, PoolFencer[]>,
      )

      const sortedPoolsData = sortPoolsByPiste(
        Object.entries(groupedFencers).map(([poolName, fencers]) => [poolName, sortFencersByMatchOrder(fencers)]),
      )
      setSortedPools(sortedPoolsData)
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
  }

  const filteredPools = useMemo(() => {
    return sortedPools.filter(([poolName, fencers]) =>
      fencers.some(
        (fencer) =>
          fencer.F_PrintLongName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          fencer.F_DelegationShortName.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    )
  }, [sortedPools, searchQuery])

  const toggleRowExpansion = (index: number) => {
    setExpandedRows((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }

  if (!params?.sportCode || !params?.name || loading) {
    return <LoadingOverlay />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className={`text-lg ${error.type === "no_data" ? "text-gray-600" : "text-red-500"} mb-4`}>
          {error.message}
        </div>
        {error.type === "other" && <Button onClick={fetchData}>重试</Button>}
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

      <div className="flex gap-2">
        <Button variant={view === "results" ? "default" : "outline"} onClick={() => setView("results")}>
          小组赛成绩
        </Button>
        <Button variant={view === "rankings" ? "default" : "outline"} onClick={() => setView("rankings")}>
          小组赛赛后排名
        </Button>
      </div>

      {view === "results" && (
        <div className="space-y-4">
          {filteredPools.map(([poolName, fencers]) => (
            <div key={poolName} className="bg-white rounded-lg border">
              <div className="p-4 space-y-2">
                <div className="bg-blue-500 text-white px-4 py-2 rounded-md inline-block">{poolName}</div>
                <div className="text-sm space-y-1">
                  <div>
                    时间：{fencers[0].startTime} | 剑道：{fencers[0].piste}
                  </div>
                  <div>裁判：{fencers[0].poolReferee}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-blue-500 text-white">
                      <th className="p-2 text-left whitespace-nowrap border-r border-white/20">姓名/单位</th>
                      <th className="p-2 text-center w-12 border-r border-white/20">No.</th>
                      {fencers.map((_, idx) => (
                        <th key={idx} className="p-2 text-center w-12">
                          {idx + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fencers.map((fencer, idx) => (
                      <tr key={fencer.matchOrder} className="border-t">
                        <td className="p-2">
                          {fencer.F_PrintLongName}
                          <br />
                          <div className="text-sm text-gray-500 text-nowrap">{fencer.F_DelegationShortName}</div>
                        </td>
                        <td className="p-2 text-center bg-blue-500 text-white border-r border-white">
                          {fencer.matchOrder}
                        </td>
                        {fencers.map((_, colIdx) => (
                          <td
                            key={colIdx}
                            className={cn(
                              "p-2 text-center border-r border-white",
                              idx === colIdx && "bg-gray-900",
                              (fencer[`r${colIdx + 1}` as keyof PoolFencer] as string)?.includes("V") &&
                                "bg-green-500 text-white",
                              typeof fencer[`r${colIdx + 1}` as keyof PoolFencer] === "string" &&
                                !(fencer[`r${colIdx + 1}` as keyof PoolFencer] as string)?.includes("V") &&
                                fencer[`r${colIdx + 1}` as keyof PoolFencer] !== "*" &&
                                "bg-red-500 text-white",
                            )}
                          >
                            {fencer[`r${colIdx + 1}` as keyof PoolFencer]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {expandedPool === poolName && poolData && (
                <div className="p-1 border-t space-y-4">
                  <div>
                    <h3 className="font-medium text-base mb-2">组内排名</h3>
                    <table className="w-full text-sm mb-4">
                      <thead>
                        <tr className="bg-blue-500 text-white">
                          <th className="p-2 text-center">No.</th>
                          <th className="p-2 text-nowrap">姓名</th>
                          <th className="p-2 text-nowrap text-center">胜率</th>
                          <th className="p-2 text-nowrap text-center">净胜</th>
                          <th className="p-2 text-nowrap text-center">刺中</th>
                          <th className="p-2 text-nowrap text-center">被刺</th>
                          <th className="p-2 text-nowrap text-center">排名</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const sortedFencers = [...fencers].sort((a, b) => {
                            const aRank =
                              poolRankings.find((r) => r.F_PrintLongName === a.F_PrintLongName)?.matchOrder || 999
                            const bRank =
                              poolRankings.find((r) => r.F_PrintLongName === b.F_PrintLongName)?.matchOrder || 999
                            return aRank - bRank
                          })

                          return sortedFencers.map((fencer) => {
                            const rankData = poolRankings.find((r) => r.F_PrintLongName === fencer.F_PrintLongName)

                            return (
                              <tr key={`rank-${fencer.matchOrder}`} className="border-t">
                                <td className="p-2 text-center">{fencer.matchOrder}</td>
                                <td className="p-2 text-nowrap">{fencer.F_PrintLongName}</td>
                                <td className="p-2 text-center">{fencer.indexWin}</td>
                                <td className="p-2 text-center">{fencer.diff}</td>
                                <td className="p-2 text-center">{fencer.hs}</td>
                                <td className="p-2 text-center">{fencer.hr}</td>
                                <td className="p-2 text-center">{rankData?.interiorRank || "-"}</td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>

                  <h3 className="font-medium text-base mb-2">比赛详情</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-500 text-white">
                        <th className="p-2 text-center">#</th>
                        <th className="p-2">主队1</th>
                        <th className="p-2 text-center">比分</th>
                        <th className="p-2">客队2</th>
                        <th className="p-2 text-center">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poolData.matches
                        .filter(
                          (match) => match.PoolName.replace(/[#\s]/g, "").toLowerCase() === poolName.toLowerCase(),
                        )
                        .sort((a, b) => a.MatchRoundOrder - b.MatchRoundOrder)
                        .map((match, idx) => {
                          return (
                            <tr key={idx} className="border-t">
                              <td className="p-2 text-center">{match.HomePosition}</td>
                              <td className="p-2">
                                <div>{match.HomeAthlete}</div>
                                <div className="text-sm text-gray-500">{match.HomeDelegation}</div>
                              </td>
                              <td className="p-2 text-center text-nowrap">
                                <span
                                  className={cn(
                                    "px-2 text-nowrap",
                                    match.HomeResult.includes("V") ? "bg-green-500" : "bg-red-500",
                                    "text-white rounded",
                                  )}
                                >
                                  {match.HomeResult}
                                </span>
                                {" - "}
                                <span
                                  className={cn(
                                    "px-2",
                                    match.AwayResult.includes("V") ? "bg-green-500" : "bg-red-500",
                                    "text-white rounded",
                                  )}
                                >
                                  {match.AwayResult}
                                </span>
                              </td>
                              <td className="p-2 text-right">
                                <div>{match.AwayAthlete}</div>
                                <div className="text-sm text-gray-500">{match.AwayDelegation}</div>
                              </td>
                              <td className="p-2 text-center">{match.AwayPosition}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-2 border-t">
                <button
                  onClick={() => setExpandedPool(expandedPool === poolName ? null : poolName)}
                  className="text-gray-400"
                >
                  <ChevronDown
                    className={cn(
                      "h-6 w-6 transition-transform duration-200",
                      expandedPool === poolName && "transform rotate-180",
                    )}
                  />
                </button>
                <Button variant="default" onClick={() => setExpandedPool(expandedPool === poolName ? null : poolName)}>
                  场次明细
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "rankings" && poolRankings.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="grid grid-cols-[80px_1fr_80px_40px] bg-gray-50 text-sm p-2">
            <div>排名</div>
            <div>姓名/单位</div>
            <div>状态</div>
            <div></div>
          </div>
          {poolRankings.map((fencer, index) => (
            <div key={index} className="border-t">
              <button
                onClick={() => toggleRowExpansion(index)}
                className="w-full grid grid-cols-[80px_1fr_80px_40px] items-center p-2 text-left hover:bg-gray-50 focus:outline-none"
              >
                <div className="text-center">{fencer.poolRank}</div>
                <div>
                  <div>{fencer.F_PrintLongName}</div>
                  <div className="text-sm text-gray-500">{fencer.F_DelegationShortName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "border rounded px-1 text-sm",
                      fencer.qualify === 1 ? "text-emerald-500 border-emerald-500" : "text-gray-500 border-gray-500",
                    )}
                  >
                    {fencer.qualify === 1 ? "晋级" : "淘汰"}
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      expandedRows.includes(index) && "transform rotate-180",
                    )}
                  />
                </div>
              </button>
              {expandedRows.includes(index) && (
                <div className="bg-orange-50 p-4 text-sm grid grid-cols-6 gap-4 text-center">
                  <div>
                    <div className="text-gray-500">M#</div>
                    <div>{fencer.matchOrder}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">V/M</div>
                    <div>{fencer.indexWin}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">HS</div>
                    <div>{fencer.hs}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">HR</div>
                    <div>{fencer.hr}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Diff</div>
                    <div>{fencer.diff}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
