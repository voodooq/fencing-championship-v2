"use client"

import { useState } from "react"
import Image from "next/image"

interface BannerProps {
  sportCode?: string
}

/**
 * 赛事横幅图片组件
 *
 * 优化设计：
 * - 直接使用 OSS URL 加载图片，通过 getBanner API 代理
 * - 移除了之前每 5 秒刷新的 setInterval（Banner 图片极少变化，无需频繁刷新）
 * - 加载失败时显示 CSS 渐变占位图，不再发额外请求
 * - 图片自带浏览器缓存（getBanner API 返回 Cache-Control 头）
 */
export default function Banner({ sportCode }: BannerProps) {
  const [hasError, setHasError] = useState(false)

  if (!sportCode) return null

  // NOTE: 不再附加 timestamp 参数，让浏览器和 CDN 正常缓存
  const bannerUrl = `/api/getBanner?sportCode=${sportCode}`

  if (hasError) {
    // 加载失败时显示 CSS 占位图，不再请求 SVG
    return (
      <div className="relative w-full aspect-[2/1] bg-gradient-to-r from-blue-500 to-blue-700 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold">{sportCode}</div>
          <div className="text-sm mt-1 opacity-80">运动项目横幅</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-[2/1] bg-blue-600">
      <Image
        src={bannerUrl}
        alt="赛事横幅"
        fill
        className="object-cover"
        priority
        unoptimized
        onError={() => setHasError(true)}
      />
    </div>
  )
}
