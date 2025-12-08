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
    // 设置 5 秒轮询，与数据页面的刷新频率保持一致
    const intervalId = setInterval(() => {
      setTimestamp(Date.now())
    }, 5000)

    return () => clearInterval(intervalId)
  }, [])

  // 添加时间戳参数以绕过浏览器缓存，强制请求新的图片
  // 后端 API (revalidate: 3) 会处理实际的缓存逻辑，确保 OSS 压力可控
  const bannerUrl = sportCode
    ? `${buildApiUrl("/api/getBanner", {}, sportCode)}&t=${timestamp}`
    : "/placeholder.svg"

  return (
    <div className="relative w-full aspect-[2/1] bg-blue-600">
      <Image
        key={timestamp} // 使用 key 强制 React 重新渲染 Image 组件
        src={bannerUrl}
        alt="赛事横幅"
        fill
        className="object-cover"
        priority
        unoptimized // 既然是动态变化的 banner，建议关闭 Next.js 自身的图片优化，直接显示 API 返回的流
      />
    </div>
  )
}
