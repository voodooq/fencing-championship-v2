import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { buildSportPath } from "../lib/sport-config"

interface HeaderProps {
  sportCode?: string
}

export default function Header({ sportCode }: HeaderProps) {
  const homeLink = sportCode ? buildSportPath(sportCode) : "/"

  return (
    <header className="flex items-center h-12 px-4 border-b">
      <Link href={homeLink} className="p-1.5 -ml-1.5">
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <h1 className="flex-1 text-center text-base font-medium">赛事成绩</h1>
    </header>
  )
}
