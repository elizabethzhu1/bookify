"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function CallbackHandler() {
  const [status, setStatus] = useState("Processing your Spotify authorization...")
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get the base URL for API calls
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  useEffect(() => {
    const processAuth = async () => {
      try {
        const code = searchParams.get("code")
        const state = searchParams.get("state")
        const error = searchParams.get("error")

        if (error) {
          setError(`Spotify authorization error: ${error}`)
          return
        }

        if (!code) {
          setError("No authorization code received from Spotify")
          return
        }

        // Exchange the code for tokens
        const response = await fetch(`${getBaseUrl()}/api/spotify-callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, state }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to authenticate with Spotify")
        }

        setStatus("Successfully connected with Spotify! Redirecting...")
        
        // Redirect back to the main page
        setTimeout(() => {
          router.push("/")
        }, 1500)
      } catch (err) {
        console.error("Callback error:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      }
    }

    processAuth()
  }, [searchParams, router])

  if (error) {
    return (
      <div className="text-red-500 mb-4">
        <p className="text-xl font-bold">Error</p>
        <p>{error}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 bg-[#1DB954] text-white rounded-md hover:bg-[#1ed760] transition-colors"
        >
          Return to Home
        </button>
      </div>
    )
  }

  return (
    <>
      <Loader2 className="h-12 w-12 animate-spin text-[#1DB954] mb-4" />
      <p className="text-xl">{status}</p>
    </>
  )
} 