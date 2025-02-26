"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AuthSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to home page after a short delay
    const timeout = setTimeout(() => {
      router.push("/")
    }, 2000)

    return () => clearTimeout(timeout)
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#06402B]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Successfully connected to Spotify!</h1>
        <p className="text-white">Redirecting you back to the app...</p>
      </div>
    </div>
  )
}

