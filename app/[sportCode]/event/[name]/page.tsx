"use client"

import { redirect } from "next/navigation"
import { useEffect } from "react"
import LoadingOverlay from "@/components/loading"

export default function EventPage({ params }: { params: { sportCode: string; name: string } }) {
  useEffect(() => {
    if (params?.sportCode && params?.name) {
      redirect(`/${params.sportCode}/event/${params.name}/rounds`)
    }
  }, [params])

  if (!params?.sportCode || !params?.name) {
    return <LoadingOverlay />
  }

  return null
}
