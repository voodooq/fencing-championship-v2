"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"

const navItems = [
  {
    label: "赛程",
    icon: () => (
      <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
        <path
          d="M5 19H43V41C43 42.1046 42.1046 43 41 43H7C5.89543 43 5 42.1046 5 41V19Z"
          fill="currentColor"
          fillOpacity="0.01"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M5 9C5 7.89543 5.89543 7 7 7H41C42.1046 7 43 7.89543 43 9V19H5V9Z"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path d="M16 4V12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 4V12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 32H34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 32H20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 25H34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 25H20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
    href: "/",
  },
  {
    label: "奖牌榜",
    icon: () => (
      <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
        <path
          d="M24 4L29.2533 7.83204L35.7557 7.81966L37.7533 14.0077L43.0211 17.8197L41 24L43.0211 30.1803L37.7533 33.9923L35.7557 40.1803L29.2533 40.168L24 44L18.7467 40.168L12.2443 40.1803L10.2467 33.9923L4.97887 30.1803L7 24L4.97887 17.8197L10.2467 14.0077L12.2443 7.81966L18.7467 7.83204L24 4Z"
          fill="currentColor"
          fillOpacity="0.01"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M17 24L22 29L32 19"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    href: "/medals",
  },
  {
    label: "我的关注",
    icon: () => (
      <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
        <path
          d="M24 44C24 44 40 32 40 20.7059C40 12.0641 33.0459 5 24 5C14.9541 5 8 12.0641 8 20.7059C8 32 24 44 24 44Z"
          fill="currentColor"
          fillOpacity="0.01"
          stroke="currentColor"
          strokeWidth="3"
        />
      </svg>
    ),
    href: "/favorites",
  },
  {
    label: "我的评论",
    icon: () => (
      <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
        <path
          d="M44 24C44 35.0457 35.0457 44 24 44C18.0265 44 4 44 4 44C4 44 4 29.0722 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z"
          fill="currentColor"
          fillOpacity="0.01"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path d="M14 18L32 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 26L32 26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 34L24 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
    href: "/comments",
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 grid grid-cols-4 h-12 border-t bg-white">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href

        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full",
              isActive ? "text-blue-500" : "text-gray-400",
            )}
          >
            <div className={isActive ? "text-blue-500" : "text-gray-400"}>
              <Icon />
            </div>
            <span className="text-xs mt-0.5">{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
