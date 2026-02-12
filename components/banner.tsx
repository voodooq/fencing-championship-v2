"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { buildApiUrl } from "../lib/sport-config"

interface BannerProps {
  sportCode?: string
}

export default function Banner({ sportCode }: BannerProps) {
  const [timestamp, setTimestamp] = useState(Date.now())

  useEffect(() => {
    if (!sportCode) return

    const intervalId = setInterval(() => {
      // 这里的更新是"静默"的，因为 Image 组件在 src 改变时会自动处理
      // 实际上对于 Image 组件，改变 src 可能会导致短暂闪烁
      // 但由于 Next.js Image 的优化，如果新旧图片相同，通常感知不强
      // 或者我们可以依赖 Next.js 的缓存机制，这里主要为了触发重新请求
      setTimestamp(Date.now())
    }, 5000)

    return () => clearInterval(intervalId)
  }, [sportCode])

  const bannerUrl = sportCode
    ? buildApiUrl("/api/getBanner", { timestamp: timestamp.toString() }, sportCode)
    : "/placeholder.svg"

  return (
    <div className="relative w-full aspect-[2/1] bg-blue-600">
      <Image
        src={bannerUrl}
        alt="赛事横幅"
        fill
        className="object-cover"
        priority
        unoptimized // 保持 unoptimized 以确保直接使用 API URL
      />
    </div>
  )
}
