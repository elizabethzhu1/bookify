"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

// Separate component that uses useSearchParams
import CallbackHandler from "@/components/CallbackHandler"

export default function CallbackPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <Suspense fallback={
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#1DB954] mb-4" />
          <p className="text-xl">Processing Spotify authorization...</p>
        </div>
      }>
        <CallbackHandler />
      </Suspense>
    </div>
  )
}

