"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

// Use the exact same redirect URI as in SpotifyAuth.tsx
const REDIRECT_URI = "https://bookify-v1.vercel.app/callback"

export default function CallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState("Processing authentication...")

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code and state from URL
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get("code")
        const state = urlParams.get("state")
        const error = urlParams.get("error")

        // Check for errors
        if (error) {
          setStatus(`Authentication error: ${error}`)
          setTimeout(() => router.push("/"), 3000)
          return
        }

        // Verify state matches what we stored
        const storedState = localStorage.getItem("spotify_auth_state")
        if (state !== storedState) {
          setStatus("State verification failed. Possible CSRF attack.")
          setTimeout(() => router.push("/"), 3000)
          return
        }

        // Get code verifier from localStorage
        const codeVerifier = localStorage.getItem("code_verifier")
        if (!code || !codeVerifier) {
          setStatus("Missing authentication parameters.")
          setTimeout(() => router.push("/"), 3000)
          return
        }

        // Exchange code for tokens
        const response = await fetch(`${window.location.origin}/api/spotify-callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            codeVerifier,
            redirectUri: REDIRECT_URI, // Must match the one used in authorization
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to exchange code for tokens")
        }

        // Clean up localStorage
        localStorage.removeItem("code_verifier")
        localStorage.removeItem("spotify_auth_state")

        setStatus("Authentication successful! Redirecting...")
        
        // Redirect to home or dashboard
        setTimeout(() => router.push("/"), 1500)
      } catch (error) {
        console.error("Callback error:", error)
        setStatus(`Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`)
        setTimeout(() => router.push("/"), 3000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
          Spotify Authentication
        </h1>
        <p className="text-gray-700 dark:text-gray-300">{status}</p>
      </div>
    </div>
  )
}

