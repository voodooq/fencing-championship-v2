"use client"

import React from "react"

import type { FC } from "react"
import { useCallback, useEffect, useState, useMemo, useRef } from "react"
import { ChevronLeft, ChevronRight, Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import LoadingOverlay from "@/components/loading"
import { buildApiUrl } from "@/lib/sport-config"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface Match {
  phaseId: number
  matchOrder: number
  matchCode: string
  startTime: string
  piste: string
  referee: string
  videoReferee: string
  homeRegId: number | null
  homeAthName: string | null
  homeOrgName: string | null
  homwPoints: number | null
  homeWinSets: number | null
  homePosition: number | null
  awayRegId: number | null
  awayAthName: string | null
  awayOrgName: string | null
  awayPoints: number | null
  awayWinSets: number | null
  awayPosition: number | null
  winerAthName: string | null
  winerOrgName: string | null
  winerResult: string | null
}

interface BracketData {
  eventId: number
  eventCode: string
  eventName: string
  phaseId: number
  phaseOrder: number
  phaseCode: string
  phaseName: string
  phaseLevel: number
  phaseType: number
  matchCount: number
  nextPhaseId: number
  matches: Match[]
}

const getColor = (phaseOrder: number, totalPhases: number, matchIndex: number, totalMatches: number) => {
  if (totalMatches <= 2) return "#4B9EF9"
  const colorIndex = Math.floor((matchIndex / totalMatches) * 4)
  const colors = ["#00CED1", "#FFA500", "#32CD32", "#FF6347"]
  return colors[colorIndex]
}

const PlayerCard: FC<{
  name: string | null
  organization: string | null
  color: string
  isWinner: boolean
  initialRanking?: number | null
  score?: number | null
  regId?: number | null
  isPlacementMatch?: boolean
  showPlacementLabel?: boolean
  showScore?: boolean
}> = ({
  name,
  organization,
  color,
  isWinner,
  initialRanking,
  score,
  regId,
  isPlacementMatch = false,
  showPlacementLabel = true,
  showScore = true,
}) => (
    <div
      className={`rounded-lg overflow-hidden text-white relative ${isWinner ? "border-4 border-yellow-400 shadow-lg shadow-yellow-300/50" : ""
        } ${isPlacementMatch && showPlacementLabel ? "border-l-4 border-l-purple-500" : ""}`}
      style={{
        backgroundColor: color ? (isWinner ? (color.startsWith("#") ? color : `#${color}`) : color) : "#4B9EF9",
        filter: isWinner ? "brightness(1.2)" : "none",
      }}
    >
      <div className="flex items-center">
        <div className="w-10 py-2 text-center font-bold border-r border-white/20">
          {initialRanking !== undefined && initialRanking !== null ? initialRanking : "-"}
        </div>
        <div className={`flex-1 flex flex-col justify-center px-3 py-2 ${!showScore ? "pr-3" : ""}`}>
          <span className={`text-nowrap ${isWinner ? "font-semibold" : "font-semibold"}`}>
            {!regId ? "待定" : regId > 0 ? name || "" : "轮空"}
          </span>
          <span className="text-sm font-light">{regId && regId > 0 ? organization || "" : "-"}</span>
        </div>
        {showScore && (
          <div className="w-10 py-2 text-center font-bold border-l border-white/20">
            {score !== undefined && score !== null ? score : "-"}
          </div>
        )}
      </div>
    </div>
  )

const NextPlayerCard: FC<{
  name: string | null
  organization: string | null
  result: string | null
  color: string
  isWinner: boolean
  isChampion?: boolean
  isPlacementMatch?: boolean
  isThirdPlace?: boolean
  showPlacementLabel?: boolean
  isPlacementWinner?: boolean
}> = ({
  name,
  organization,
  result,
  color,
  isWinner,
  isChampion = false,
  isPlacementMatch = false,
  isThirdPlace = false,
  showPlacementLabel = true,
  isPlacementWinner = false,
}) => (
    <div
      className={`rounded-lg overflow-hidden text-white relative ${isPlacementMatch && showPlacementLabel ? "border-l-4 border-l-purple-500" : ""
        }`}
      style={{
        backgroundColor: color ? (color.startsWith("#") ? color : `#${color}`) : "#4B9EF9",
      }}
    >
      <div className="flex items-center">
        <div className="flex-1 flex items-center justify-between px-2 py-2">
          <div className="flex items-center">
            <span className={`text-nowrap ${isWinner || isPlacementWinner ? "font-semibold" : "font-semibold"}`}>
              {name || "待定"}
              <span className="text-sm font-light text-right"> {organization || ""}</span>
            </span>
          </div>
        </div>
      </div>
      {result && (
        <div
          className={`bg-black/30 py-1 px-3 text-center ${isChampion ? "text-yellow-300" : isThirdPlace ? "text-white" : "text-white"
            } font-bold`}
        >
          {result}
        </div>
      )}
    </div>
  )

const ChampionCard: FC<{
  name: string | null
  organization: string | null
  result: string | null
}> = ({ name, organization, result }) => {
  if (!name) return null

  return (
    <div className="w-full">
      <div className="relative bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg p-[4px] shadow-xl">
        <div className="bg-gradient-to-r from-yellow-600 to-amber-600 rounded-lg p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-yellow-300 fill-current flex-shrink-0" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <div className="text-yellow-300 font-bold text-lg">冠军</div>
            </div>
            <div>
              <div className="text-white font-bold text-xl text-nowrap">{name}</div>
              <div className="text-yellow-200">{organization}</div>
            </div>
            <div className="flex justify-between items-center mt-1">
              <div className="text-white font-bold">{result}</div>
            </div>
          </div>
          <div className="absolute -top-4 -right-4">
            <svg className="w-10 h-10 text-yellow-300 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

const BracketModal: FC<{
  isOpen: boolean
  onClose: () => void
  bracketData: BracketData[]
  currentPhaseId: number
  setCurrentPhaseId: (id: number) => void
  showReferees: boolean
  onPlayerClick: (phaseId: number, matchIndex: number, matchInfo: any) => void
}> = ({ isOpen, onClose, bracketData, currentPhaseId, setCurrentPhaseId, showReferees, onPlayerClick }) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [dragDistance, setDragDistance] = useState(0)
  let initialDistance = 0
  let initialScale = scale

  const CARD_WIDTH = 300
  const HORIZONTAL_SPACING = 50
  const CARD_HEIGHT = 120
  const VERTICAL_OFFSET = CARD_HEIGHT / 2
  const placementMatchSpacing = 350

  // Reset position and scale when modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
      setLastPos({ x: 0, y: 0 })
      setDragDistance(0)
    }
  }, [isOpen])

  // Enhanced touch and drag functionality
  useEffect(() => {
    const modal = modalRef.current
    if (!modal || !isOpen) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        initialScale = scale
        if (isDragging) {
          setIsDragging(false)
          setLastPos(position)
        }
      } else if (e.touches.length === 1) {
        setIsDragging(true)
        setStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY })
        setDragDistance(0)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()

      if (e.touches.length === 2) {
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )

        if (initialDistance > 0) {
          const ratio = currentDistance / initialDistance
          const sensitivity = 1.5
          const enhancedRatio = ratio < 1 ? 1 - Math.pow(1 - ratio, sensitivity) : Math.pow(ratio, sensitivity)
          const newScale = Math.max(0.3, Math.min(8, initialScale * enhancedRatio))
          setScale(newScale)
        }
      } else if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - startPos.x
        const dy = e.touches[0].clientY - startPos.y

        const distance = Math.sqrt(dx * dx + dy * dy)
        setDragDistance(distance)

        setPosition({
          x: lastPos.x + dx / scale,
          y: lastPos.y + dy / scale,
        })
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (isDragging) {
          setIsDragging(false)
          setLastPos(position)
          setDragDistance(0)
        }
        initialDistance = 0
      } else if (e.touches.length === 1) {
        initialDistance = 0
        setStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY })
        setDragDistance(0)
      }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = -e.deltaY
      const zoomIntensity = 0.15
      const newScale = delta > 0 ? Math.min(8, scale * (1 + zoomIntensity)) : Math.max(0.3, scale * (1 - zoomIntensity))
      setScale(newScale)
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return

      const target = e.target as HTMLElement
      if (target.tagName === "BUTTON" || target.closest("button")) {
        return
      }

      setIsDragging(true)
      setStartPos({ x: e.clientX, y: e.clientY })
      setDragDistance(0)
      e.preventDefault()
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const dx = e.clientX - startPos.x
      const dy = e.clientY - startPos.y

      const distance = Math.sqrt(dx * dx + dy * dy)
      setDragDistance(distance)

      setPosition({
        x: lastPos.x + dx / scale,
        y: lastPos.y + dy / scale,
      })
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        setLastPos(position)
        setDragDistance(0)
      }
    }

    modal.addEventListener("touchstart", handleTouchStart, { passive: false })
    modal.addEventListener("touchmove", handleTouchMove, { passive: false })
    modal.addEventListener("touchend", handleTouchEnd)
    modal.addEventListener("wheel", handleWheel, { passive: false })
    modal.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      modal.removeEventListener("touchstart", handleTouchStart)
      modal.removeEventListener("touchmove", handleTouchMove)
      modal.removeEventListener("touchend", handleTouchEnd)
      modal.removeEventListener("wheel", handleWheel)
      modal.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isOpen, scale, position, isDragging, startPos, lastPos, dragDistance])

  const handleCardClick = (phaseId: number, matchIndex: number, match: Match) => {
    if (dragDistance < 10) {
      onPlayerClick(phaseId, matchIndex, match)
    }
  }

  if (!isOpen) return null

  // Calculate positions for all matches in all phases
  const matchPositions: Record<number, number[]> = {}
  const cardWidth = 300
  const horizontalSpacing = 50
  const verticalSpacing = 220
  const headerOffset = 60

  // Calculate horizontal positions for each phase
  const phaseHorizontalPositions: number[] = []
  const finalPhaseIndex = bracketData.findIndex((phase) => phase.phaseType === 3 && phase.nextPhaseId === 0)
  let finalPhaseCenterY = 0

  bracketData.forEach((phase, index) => {
    if (index === 0) {
      phaseHorizontalPositions[index] = 0
    } else {
      const isPlacementPhase = phase.phaseType === 4
      const prevPhaseIsFinal =
        index > 0 && bracketData[index - 1].phaseType === 3 && bracketData[index - 1].nextPhaseId === 0
      const extraLeftMargin = isPlacementPhase && prevPhaseIsFinal ? placementMatchSpacing : 0
      phaseHorizontalPositions[index] =
        phaseHorizontalPositions[index - 1] + cardWidth + horizontalSpacing + extraLeftMargin
    }
  })

  // Calculate match positions
  if (bracketData.length > 0) {
    const firstPhase = bracketData[0]
    matchPositions[firstPhase.phaseId] = firstPhase.matches.map((_, index) => index * verticalSpacing + headerOffset)

    for (let i = 1; i < bracketData.length; i++) {
      const currentPhase = bracketData[i]
      const previousPhase = bracketData[i - 1]
      matchPositions[currentPhase.phaseId] = []

      if (currentPhase.phaseType === 4 && finalPhaseIndex !== -1) {
        if (finalPhaseCenterY === 0 && bracketData[finalPhaseIndex].matches.length > 0) {
          const finalPhaseMatches = bracketData[finalPhaseIndex].matches
          const firstMatchPos = matchPositions[bracketData[finalPhaseIndex].phaseId][0] + 120

          if (finalPhaseMatches.length === 1) {
            finalPhaseCenterY = firstMatchPos
          } else {
            finalPhaseCenterY = firstMatchPos
          }
        }

        for (let j = 0; j < currentPhase.matches.length; j++) {
          const offset = (j - (currentPhase.matches.length - 1) / 2) * verticalSpacing
          matchPositions[currentPhase.phaseId][j] = finalPhaseCenterY + offset
        }
      } else {
        for (let j = 0; j < currentPhase.matches.length; j++) {
          const prevMatchIndex1 = j * 2
          const prevMatchIndex2 = j * 2 + 1

          if (prevMatchIndex2 < previousPhase.matches.length) {
            const pos1 = matchPositions[previousPhase.phaseId][prevMatchIndex1]
            const pos2 = matchPositions[previousPhase.phaseId][prevMatchIndex2]
            matchPositions[currentPhase.phaseId][j] = (pos1 + pos2) / 2
          } else if (prevMatchIndex1 < previousPhase.matches.length) {
            matchPositions[currentPhase.phaseId][j] =
              matchPositions[previousPhase.phaseId][prevMatchIndex1] + verticalSpacing / 2
          } else {
            matchPositions[currentPhase.phaseId][j] = j * verticalSpacing + headerOffset
          }
        }
      }
    }

    // Special handling for final phase matches
    bracketData.forEach((phase) => {
      if (phase.phaseType === 3 && phase.nextPhaseId === 0 && phase.matches.length === 2) {
        matchPositions[phase.phaseId][1] = matchPositions[phase.phaseId][0] + 300
      }
      if (phase.phaseType === 4 && phase.phaseName.indexOf("5-6名决赛") !== -1) {
        matchPositions[phase.phaseId][0] += -110
      }
      if (phase.phaseType === 4 && phase.phaseName.indexOf("7-8名决赛") !== -1) {
        matchPositions[phase.phaseId][0] += 110
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 border-0">
        {/* 关闭按钮 - 固定在右上角 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 bg-white/90 hover:bg-white text-black rounded-full shadow-lg"
        >
          <X className="h-6 w-6" />
        </Button>

        <div
          ref={modalRef}
          className="w-full h-full overflow-hidden relative bg-gray-50"
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
        >
          <div
            ref={contentRef}
            className="absolute inset-0 origin-top-left transition-transform duration-100"
            style={{
              transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            }}
          >
            <div className="p-4 min-w-max">
              {/* 连接线容器 */}
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
                {bracketData.map((phase, phaseIndex) => {
                  const nextPhase = bracketData[phaseIndex + 1]
                  if (!nextPhase || phase.nextPhaseId === 0) return null

                  return phase.matches.map((match, matchIndex) => {
                    const currentTop = matchPositions[phase.phaseId][matchIndex]
                    const currentLeft = phaseHorizontalPositions[phaseIndex] + CARD_WIDTH

                    const isEvenGroup = matchIndex % 2 === 1
                    let verticalOffset = VERTICAL_OFFSET

                    if (isEvenGroup) {
                      verticalOffset += 80
                    }

                    let nextMatchIndex = Math.floor(matchIndex / 2)
                    if (match.homeRegId === -1 || match.awayRegId === -1) {
                      nextMatchIndex = nextPhase.matches.length - 1
                    }
                    if (nextMatchIndex >= nextPhase.matches.length) return null

                    const nextTop = matchPositions[nextPhase.phaseId][nextMatchIndex]
                    const nextLeft = phaseHorizontalPositions[phaseIndex + 1]

                    const startY = currentTop + verticalOffset
                    const endY = nextTop + VERTICAL_OFFSET
                    const midX = currentLeft + HORIZONTAL_SPACING * 0.4

                    const horizontalOffset = isEvenGroup ? 25 : 25
                    const color = getColor(phase.phaseOrder, bracketData.length, matchIndex, phase.matches.length)

                    return (
                      <React.Fragment key={`connector-${phase.phaseId}-${matchIndex}`}>
                        <div
                          style={{
                            position: "absolute",
                            left: currentLeft,
                            top: startY,
                            width: HORIZONTAL_SPACING,
                            height: 2,
                            backgroundColor: color,
                            transform: "translateY(-1px)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: midX + horizontalOffset + 5,
                            top: phaseIndex == 0 ? (isEvenGroup ? startY - 150 : startY) : Math.min(startY, endY),
                            height: phaseIndex == 0 ? 150 : Math.abs(startY - endY),
                            width: 2,
                            backgroundColor: color,
                            transform: "translateX(-1px)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: midX + horizontalOffset + 5,
                            top: phaseIndex == 0 ? (isEvenGroup ? 999999 : startY + 150) : endY + 40,
                            width: nextLeft - midX,
                            height: 2,
                            backgroundColor: color,
                            transform: "translateY(-1px)",
                          }}
                        />
                      </React.Fragment>
                    )
                  })
                })}
              </div>

              {/* 阶段容器 */}
              <div className="relative flex" style={{ zIndex: 10, position: "relative" }}>
                {bracketData.map((phase, phaseIndex) => {
                  const isPlacementPhase = phase.phaseType === 4
                  const prevPhaseIsFinal =
                    phaseIndex > 0 &&
                    bracketData[phaseIndex - 1].phaseType === 3 &&
                    bracketData[phaseIndex - 1].nextPhaseId === 0
                  const extraLeftMargin = isPlacementPhase && prevPhaseIsFinal ? placementMatchSpacing : 0

                  return (
                    <div
                      key={phase.phaseId}
                      className="relative"
                      style={{
                        marginLeft:
                          phaseIndex > 0
                            ? phase.phaseName.indexOf("5-6名决赛") > -1
                              ? `${horizontalSpacing + extraLeftMargin - 350}px`
                              : `${horizontalSpacing + extraLeftMargin}px`
                            : "0",
                        width: `${cardWidth}px`,
                      }}
                      data-phase-id={phase.phaseId}
                    >
                      <div className="text-center text-nowrap font-medium mb-4 bg-blue-500 text-white py-2 px-4 rounded">
                        {isPlacementPhase && phase.nextPhaseId === 0 ? "最终成绩" : phase.phaseName}
                      </div>
                      <div
                        className="relative"
                        style={{ height: `${Math.max(800, bracketData[0]?.matches.length * 220 || 800)}px` }}
                      >
                        {phase.matches.map((match, matchIndex) => {
                          const homeWinner = match.homeWinSets === 1
                          const awayWinner = match.awayWinSets === 1
                          const color = getColor(phase.phaseOrder, bracketData.length, matchIndex, phase.matches.length)
                          const isFinalPhase = phaseIndex === bracketData.length - 1 && phase.matches.length === 1
                          const isChampionshipPhase = phase.phaseType === 3 && phase.nextPhaseId === 0
                          const isPlacementPhase = phase.phaseType === 4
                          const topPosition = matchPositions[phase.phaseId][matchIndex]
                          const matchCardHeight = 140

                          return (
                            <div
                              key={match.matchCode}
                              className="absolute w-[300px]"
                              style={{
                                top: `${topPosition - matchCardHeight / 2}px`,
                                zIndex: 15,
                              }}
                            >
                              {/* Home player card */}
                              <div className="relative player-card-wrapper">
                                <PlayerCard
                                  name={match.homeAthName}
                                  organization={match.homeOrgName}
                                  color={color}
                                  isWinner={homeWinner}
                                  initialRanking={match.homePosition}
                                  score={match.homwPoints}
                                  regId={match.homeRegId}
                                  isPlacementMatch={isPlacementPhase}
                                  showPlacementLabel={!isPlacementPhase || !isFinalPhase}
                                  showScore={false}
                                />
                                <button
                                  className="absolute inset-0 w-full h-full bg-transparent hover:bg-white/30 active:bg-white/50 transition-colors duration-150 cursor-pointer pointer-events-auto z-50 hover:border-4 hover:border-white"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onClose()
                                    setTimeout(() => {
                                      onPlayerClick(phase.phaseId, matchIndex, match)
                                    }, 100)
                                  }}
                                  style={{ cursor: "pointer !important" }}
                                >
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
                                    <div className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                      点击关闭并跳转
                                    </div>
                                  </div>
                                </button>
                              </div>

                              {showReferees && (
                                <div className="text-xs text-gray-600 my-1 pl-4">
                                  <div>Time: {match.startTime}</div>
                                  <div>Piste: {match.piste}</div>
                                  <div>Ref: {match.referee}</div>
                                </div>
                              )}

                              {/* Away player card */}
                              <div className="relative player-card-wrapper">
                                <PlayerCard
                                  name={match.awayAthName}
                                  organization={match.awayOrgName}
                                  color={color}
                                  isWinner={awayWinner}
                                  initialRanking={match.awayPosition}
                                  score={match.awayPoints}
                                  regId={match.awayRegId}
                                  isPlacementMatch={isPlacementPhase}
                                  showPlacementLabel={!isPlacementPhase || !isFinalPhase}
                                  showScore={false}
                                />
                                <button
                                  className="absolute inset-0 w-full h-full bg-transparent hover:bg-white/30 active:bg-white/50 transition-colors duration-150 cursor-pointer pointer-events-auto z-50 hover:border-4 hover:border-white"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onClose()
                                    setTimeout(() => {
                                      onPlayerClick(phase.phaseId, matchIndex, match)
                                    }, 100)
                                  }}
                                  style={{ cursor: "pointer !important" }}
                                >
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
                                    <div className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                      点击关闭并跳转
                                    </div>
                                  </div>
                                </button>
                              </div>

                              {/* Champion card */}
                              {isChampionshipPhase && match.winerAthName && matchIndex === 0 && (
                                <div
                                  className="absolute"
                                  style={{
                                    left: "calc(100% + 40px)",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: "280px",
                                  }}
                                >
                                  <div
                                    className="absolute"
                                    style={{
                                      right: "100%",
                                      top: "50%",
                                      width: "40px",
                                      height: "2px",
                                      transform: "translateY(-50%)",
                                      backgroundColor: color,
                                    }}
                                  ></div>
                                  <ChampionCard
                                    name={match.winerAthName}
                                    organization={match.winerOrgName}
                                    result={`${match.winerResult}`}
                                  />
                                </div>
                              )}

                              {/* Third place card */}
                              {isChampionshipPhase && match.winerAthName && matchIndex === 1 && (
                                <div
                                  className="absolute"
                                  style={{
                                    left: "calc(100% + 40px)",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: "300px",
                                    position: "absolute",
                                  }}
                                >
                                  <div
                                    className="absolute"
                                    style={{
                                      right: "100%",
                                      top: "50%",
                                      width: "40px",
                                      height: "2px",
                                      transform: "translateY(-50%)",
                                      backgroundColor: color,
                                    }}
                                  ></div>
                                  <div className="w-full">
                                    <NextPlayerCard
                                      name={match.winerAthName}
                                      organization={match.winerOrgName}
                                      result={match.winerResult}
                                      color={color}
                                      isWinner={true}
                                      isChampion={false}
                                      isThirdPlace={true}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Placement winner card */}
                              {isPlacementPhase && phase.nextPhaseId === 0 && match.winerAthName && (
                                <div
                                  className="absolute"
                                  style={{
                                    left: "calc(100% + 40px)",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: "300px",
                                  }}
                                >
                                  <div
                                    className="absolute"
                                    style={{
                                      right: "100%",
                                      top: "50%",
                                      width: "40px",
                                      height: "2px",
                                      transform: "translateY(-50%)",
                                      backgroundColor: color,
                                    }}
                                  ></div>
                                  <div className="w-full">
                                    <NextPlayerCard
                                      name={match.winerAthName}
                                      organization={match.winerOrgName}
                                      result={match.winerResult}
                                      color={color}
                                      isWinner={true}
                                      isPlacementMatch={false}
                                      isPlacementWinner={true}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface BracketsPageProps {
  params: { sportCode: string; name: string }
}

const BracketsPage: FC<BracketsPageProps> = ({ params }) => {
  const [bracketData, setBracketData] = useState<BracketData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ type: "no_data" | "other"; message: string } | null>(null)
  const [currentPhaseId, setCurrentPhaseId] = useState<number>(0)
  const [showReferees, setShowReferees] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [targetMatchIndex, setTargetMatchIndex] = useState<number | null>(null)
  const [pendingPhaseChange, setPendingPhaseChange] = useState<number | null>(null)

  const matchRefs = useRef<(HTMLDivElement | null)[]>([])

  const fetchBracketData = useCallback(async (isPolling = false) => {
    if (!params?.sportCode || !params?.name) return

    try {
      if (!isPolling) setLoading(true)
      setError(null)
      console.log("Fetching bracket data...")
      const response = await fetch(
        buildApiUrl(
          "/api/getBracketData",
          {
            eventCode: params.name,
            timestamp: Date.now().toString(),
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
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      // console.log("Bracket data received:", data)
      if (!Array.isArray(data)) {
        throw new Error("Invalid data format received")
      }

      setBracketData(data)
      if (!isPolling) {
        setCurrentPhaseId(data[0]?.phaseId || 0)
      }
    } catch (error) {
      console.error("Error fetching bracket data:", error)
      setError({ type: "other", message: "暂无对阵数据" })
    } finally {
      if (!isPolling) setLoading(false)
    }
  }, [params])

  useEffect(() => {
    if (params?.sportCode && params?.name) {
      fetchBracketData().catch((error) => {
        console.error("Unhandled error in fetchBracketData:", error)
        setLoading(false)
      })

    }
  }, [fetchBracketData, params])

  useEffect(() => {
    if (targetMatchIndex !== null && !isModalOpen) {
      console.log("Target match index set:", targetMatchIndex)
      const timer = setTimeout(() => {
        console.log("Attempting to scroll to match:", targetMatchIndex)
        if (matchRefs.current[targetMatchIndex]) {
          console.log("Match ref found, scrolling to:", targetMatchIndex)
          try {
            matchRefs.current[targetMatchIndex]?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            })
          } catch (error) {
            console.error("Error scrolling to element:", error)
            const element = matchRefs.current[targetMatchIndex]
            if (element) {
              const rect = element.getBoundingClientRect()
              const scrollTop = window.pageYOffset || document.documentElement.scrollTop
              const targetTop = rect.top + scrollTop - window.innerHeight / 2
              window.scrollTo({
                top: targetTop,
                behavior: "smooth",
              })
            }
          }
          setTargetMatchIndex(null)
        } else {
          console.log("Match ref not found for index:", targetMatchIndex)
          setTimeout(() => {
            if (matchRefs.current[targetMatchIndex]) {
              matchRefs.current[targetMatchIndex]?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              })
              setTargetMatchIndex(null)
            }
          }, 500)
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [targetMatchIndex, isModalOpen, currentPhaseId])

  useEffect(() => {
    if (pendingPhaseChange !== null) {
      console.log("Handling pending phase change to:", pendingPhaseChange)
      setCurrentPhaseId(pendingPhaseChange)
      setPendingPhaseChange(null)
    }
  }, [pendingPhaseChange])

  const rounds = useMemo(() => {
    return bracketData.map((phase) => ({
      order: phase.phaseOrder,
      name: phase.phaseName,
      code: phase.phaseCode,
      phaseId: phase.phaseId,
    }))
  }, [bracketData])

  const currentPhase = useMemo(() => {
    return bracketData.find((phase) => phase.phaseId === currentPhaseId)
  }, [bracketData, currentPhaseId])

  const nextPhase = useMemo(() => {
    const current = bracketData.find((phase) => phase.phaseId === currentPhaseId)
    if (!current) return null

    if (current.nextPhaseId === 0) return null

    return bracketData.find((phase) => phase.phaseId === current.nextPhaseId) || null
  }, [bracketData, currentPhaseId])

  const handleRefresh = () => {
    setLoading(true)
    setError(null)
    fetchBracketData().catch((error) => {
      console.error("Error refreshing data:", error)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (currentPhase) {
      matchRefs.current = Array(currentPhase.matches.length).fill(null)
    }
  }, [currentPhase])

  const handleModalClose = () => {
    setIsModalOpen(false)
  }

  const handlePlayerClick = (phaseId: number, matchIndex: number, matchInfo: any) => {
    setIsModalOpen(false)

    window.requestAnimationFrame(() => {
      if (phaseId !== currentPhaseId) {
        console.log("Changing phase from", currentPhaseId, "to", phaseId)
        setCurrentPhaseId(phaseId)
        window.requestAnimationFrame(() => {
          setTimeout(() => {
            console.log("Setting target match index after phase change:", matchIndex)
            setTargetMatchIndex(matchIndex)
          }, 300)
        })
      } else {
        console.log("Setting target match index directly:", matchIndex)
        setTargetMatchIndex(matchIndex)
      }
    })
  }

  const getNextRoundPlayerInfo = (match: Match, index: number) => {
    if (match.homeWinSets === null && match.awayWinSets === null) {
      if (match.homeRegId === -1) {
        return {
          name: match.awayAthName || "待定",
          organization: match.awayOrgName || "",
          result: match.winerResult || "",
        }
      } else if (match.awayRegId === -1) {
        return {
          name: match.homeAthName || "待定",
          organization: match.homeOrgName || "",
          result: match.winerResult || "",
        }
      } else {
        return {
          name: "待定",
          organization: "",
          result: "",
        }
      }
    } else {
      return {
        name: match.winerAthName,
        organization: match.winerOrgName,
        result: match.winerResult,
      }
    }
  }

  // 删除这个 useEffect
  // useEffect(() => {
  //   if (setModalOpen) {
  //     setModalOpen(isModalOpen)
  //   }
  // }, [isModalOpen, setModalOpen])

  if (!params?.sportCode || !params?.name || loading) {
    return <LoadingOverlay />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="text-gray-500">暂无对阵数据</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex-1 overflow-auto">
        <div className="space-y-4 p-2 sm:p-4">
          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-[#4B9EF9] text-white hover:bg-blue-600"
                  onClick={() => {
                    const currentIndex = rounds.findIndex((r) => r.phaseId === currentPhaseId)
                    if (currentIndex > 0) {
                      setCurrentPhaseId(rounds[currentIndex - 1].phaseId)
                    }
                  }}
                  disabled={currentPhaseId === rounds[0]?.phaseId}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={currentPhaseId.toString()}
                  onValueChange={(value) => setCurrentPhaseId(Number.parseInt(value, 10))}
                >
                  <SelectTrigger className="w-28 sm:w-24 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rounds.map((round) => (
                      <SelectItem key={round.phaseId} value={round.phaseId.toString()}>
                        {round.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-[#4B9EF9] text-white hover:bg-blue-600"
                  onClick={() => {
                    const currentIndex = rounds.findIndex((r) => r.phaseId === currentPhaseId)
                    if (currentIndex < rounds.length - 1) {
                      setCurrentPhaseId(rounds[currentIndex + 1].phaseId)
                    }
                  }}
                  disabled={currentPhaseId === rounds[rounds.length - 1]?.phaseId}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1"
                >
                  <Eye className="h-4 w-4" />
                  <span>查看全图</span>
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch id="show-referees" checked={showReferees} onCheckedChange={setShowReferees} />
                <Label htmlFor="show-referees" className="text-sm">
                  裁判信息
                </Label>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                {loading ? "刷新中..." : "刷新数据"}
              </Button>
            </div>
          </div>

          <div className="flex text-sm font-medium px-2 sm:px-4 gap-8">
            <div className="w-[calc(50%-0.5rem)] sm:w-[320px] py-2 px-4 rounded text-center font-medium mb-4 bg-blue-500 text-white">
              {currentPhase?.phaseName || ""}
            </div>
            <div className="w-[calc(50%-0.5rem)] sm:w-[320px] py-2 px-4 rounded text-center font-medium mb-4 bg-blue-500 text-white">
              {nextPhase?.phaseName ||
                (currentPhase?.phaseType === 4 && currentPhase?.nextPhaseId === 0 ? "最终成绩" : "最终成绩")}
            </div>
          </div>

          <div className="relative px-2 sm:px-4 py-4">
            <div className="flex flex-col gap-16">
              {currentPhase?.matches.map((match, index) => {
                const homeWinner = match.homeWinSets === 1
                const awayWinner = match.awayWinSets === 1
                const color = getColor(currentPhase.phaseOrder, rounds.length, index, currentPhase.matches.length)
                const nextPlayerInfo = getNextRoundPlayerInfo(match, index)
                const isPlacementPhase = currentPhase.phaseType === 4
                const isFinalPhase = currentPhase.nextPhaseId === 0

                const currentIsFinal = currentPhase.phaseType === 3 && currentPhase.nextPhaseId === 0
                const nextIsPlacement = nextPhase?.phaseType === 4
                const needsExtraSpace = currentIsFinal && nextIsPlacement

                return (
                  <div
                    key={match.matchCode}
                    className="flex items-center gap-4"
                    ref={(el) => {
                      matchRefs.current[index] = el;
                    }}
                  >
                    <div className="w-[calc(50%-0.5rem)] sm:w-[330px] relative">
                      <PlayerCard
                        name={match.homeAthName}
                        organization={match.homeOrgName}
                        color={color}
                        isWinner={homeWinner}
                        initialRanking={match.homePosition}
                        score={match.homwPoints}
                        regId={match.homeRegId}
                        isPlacementMatch={isPlacementPhase}
                        showPlacementLabel={!isPlacementPhase || !isFinalPhase}
                        showScore={false}
                      />

                      <div className="text-sm text-gray-600 my-1 pl-4 space-y-0.5">
                        <div className="flex flex-col">
                          <span>Time: {match.startTime}</span>
                          <span>Piste: {match.piste}</span>
                        </div>
                        {showReferees && (
                          <div className="flex flex-col">
                            <span>Ref: {match.referee}</span>
                            <span>Video: {match.videoReferee}</span>
                          </div>
                        )}
                      </div>

                      <PlayerCard
                        name={match.awayAthName}
                        organization={match.awayOrgName}
                        color={color}
                        isWinner={awayWinner}
                        initialRanking={match.awayPosition}
                        score={match.awayPoints}
                        regId={match.awayRegId}
                        isPlacementMatch={isPlacementPhase}
                        showPlacementLabel={!isPlacementPhase || !isFinalPhase}
                        showScore={false}
                      />
                      <div className="absolute inset-0 pointer-events-none" style={{ width: "calc(100% + 60px)" }}>
                        <div
                          className="absolute"
                          style={{
                            top: "24px",
                            right: "0",
                            width: "60px",
                            height: "2px",
                            transform: "translateY(-50%)",
                            backgroundColor: color,
                          }}
                        />
                        <div
                          className="absolute"
                          style={{
                            bottom: "24px",
                            right: "0",
                            width: "60px",
                            height: "2px",
                            transform: "translateY(50%)",
                            backgroundColor: color,
                          }}
                        />
                        <div
                          className="absolute"
                          style={{
                            top: "24px",
                            right: "0",
                            width: "2px",
                            height: "calc(100% - 48px)",
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>

                    {nextPhase && (
                      <div
                        className={`w-[calc(50%-0.5rem)] sm:w-[330px] relative ${needsExtraSpace ? "ml-32" : "-left-[20px]"
                          }`}
                      >
                        <NextPlayerCard
                          name={nextPlayerInfo.name}
                          organization={nextPlayerInfo.organization}
                          result={nextPlayerInfo.result}
                          color={getColor(
                            nextPhase.phaseOrder,
                            rounds.length,
                            Math.floor(index / 2),
                            nextPhase.matches.length,
                          )}
                          isWinner={false}
                          isPlacementMatch={nextPhase?.phaseType === 4}
                          showPlacementLabel={!(nextPhase?.phaseType === 4 && nextPhase?.nextPhaseId === 0)}
                        />
                        <div className="absolute inset-0 pointer-events-none" style={{ width: "calc(100% + 10px)" }}>
                          <div
                            className="absolute"
                            style={{
                              top: "50%",
                              right: "0",
                              width: "20px",
                              height: "2px",
                              transform: "translateY(-50%)",
                              backgroundColor: getColor(
                                nextPhase.phaseOrder,
                                rounds.length,
                                Math.floor(index / 2),
                                nextPhase.matches.length,
                              ),
                            }}
                          />
                          <div
                            className="absolute"
                            style={{
                              top: index % 2 === 0 ? "50%" : "-250%",
                              right: "0",
                              width: "2px",
                              height: "300%",
                              backgroundColor: getColor(
                                nextPhase.phaseOrder,
                                rounds.length,
                                Math.floor(index / 2),
                                nextPhase.matches.length,
                              ),
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {!nextPhase && currentPhase?.phaseType === 3 && currentPhase.nextPhaseId === 0 && (
                      <>
                        {index === 0 && match.winerAthName && (
                          <div className="w-[calc(50%-0.5rem)] sm:w-[330px] relative -left-[20px] flex items-center">
                            <div className="ml-10">
                              <ChampionCard
                                name={match.winerAthName}
                                organization={match.winerOrgName}
                                result={match.winerResult}
                              />
                            </div>
                          </div>
                        )}

                        {index === 1 && match.winerAthName && (
                          <div className="w-[calc(50%-0.5rem)] sm:w-[330px] relative -left-[20px] flex items-center">
                            <div className="ml-10 w-full">
                              <NextPlayerCard
                                name={match.winerAthName}
                                organization={match.winerOrgName}
                                result={match.winerResult}
                                color={color}
                                isWinner={true}
                                isChampion={false}
                                isThirdPlace={true}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {!nextPhase &&
                      currentPhase?.phaseType === 4 &&
                      currentPhase.nextPhaseId === 0 &&
                      match.winerAthName && (
                        <div className="w-[calc(50%-0.5rem)] sm:w-[330px] relative -left-[20px] flex items-center">
                          <div className="ml-10 w-full">
                            <NextPlayerCard
                              name={match.winerAthName}
                              organization={match.winerOrgName}
                              result={match.winerResult}
                              color={color}
                              isWinner={true}
                              isPlacementMatch={false}
                              isPlacementWinner={true}
                            />
                          </div>
                        </div>
                      )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <BracketModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        bracketData={bracketData}
        currentPhaseId={currentPhaseId}
        setCurrentPhaseId={setCurrentPhaseId}
        showReferees={showReferees}
        onPlayerClick={handlePlayerClick}
      />
    </div>
  )
}

export default BracketsPage
