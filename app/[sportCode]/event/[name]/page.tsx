"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import LoadingOverlay from "@/components/loading"

export default function EventPage({ params }: { params: { sportCode: string; name: string } }) {
  const router = useRouter()

  useEffect(() => {
    if (params?.sportCode && params?.name) {
      router.replace(`/${params.sportCode}/event/${params.name}/rounds`)
    }
  }, [params, router])

  if (!params?.sportCode || !params?.name) {
    return <LoadingOverlay />
  }

  return null
}
