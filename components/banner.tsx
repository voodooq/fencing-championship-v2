import Image from "next/image"
import { buildApiUrl } from "../lib/sport-config"

interface BannerProps {
  sportCode?: string
}

export default function Banner({ sportCode }: BannerProps) {
  const bannerUrl = sportCode ? buildApiUrl("/api/getBanner", {}, sportCode) : "/placeholder.svg"

  return (
    <div className="relative w-full aspect-[2/1] bg-blue-600">
      <Image src={bannerUrl || "/placeholder.svg"} alt="赛事横幅" fill className="object-cover" priority />
    </div>
  )
}
