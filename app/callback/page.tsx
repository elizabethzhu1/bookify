"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

// Use the exact same redirect URI as in SpotifyAuth.tsx
const REDIRECT_URI = "https://bookify-v1.vercel.app/callback"

export default function CallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [debug, setDebug] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get("code")
      const state = urlParams.get("state")
      const storedState = localStorage.getItem("spotify_auth_state")
      const codeVerifier = localStorage.getItem("code_verifier")
      
      // Add debugging info
      setDebug(`Code: ${code ? "✓" : "✗"}, State Match: ${state === storedState ? "✓" : "✗"}, Verifier: ${codeVerifier ? "✓" : "✗"}`)
      
      // Clear stored values immediately to prevent reuse
      localStorage.removeItem("code_verifier")
      localStorage.removeItem("spotify_auth_state")

      // Validate state to prevent CSRF attacks
      if (!state || state !== storedState) {
        console.error("State validation failed")
        setError("Security validation failed. Please try again.")
        setTimeout(() => router.push("/?error=invalid_state"), 3000)
        return
      }

      if (code && codeVerifier) {
        try {
          // Show loading state
          setError(null)
          
          const response = await fetch("/api/spotify-callback", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              code, 
              codeVerifier,
              redirectUri: REDIRECT_URI
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error("Token exchange error details:", errorData)
            setDebug(prev => `${prev}\nError details: ${JSON.stringify(errorData)}`)
            throw new Error(errorData.message || "Failed to exchange code for tokens")
          }

          // Successfully authenticated
          console.log("Authentication successful, redirecting...")
          router.push("/")
        } catch (error) {
          console.error("Error during token exchange:", error)
          setError(`Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`)
          // Don't redirect automatically on error to allow reading the error message
        }
      } else {
        setError("Missing authentication data")
        setTimeout(() => router.push("/?error=no_code"), 3000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Processing Authentication</h1>
        {error ? (
          <>
            <p className="text-red-500 mb-4">{error}</p>
            <button 
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Return to Home
            </button>
            {debug && (
              <div className="mt-4 p-4 bg-gray-100 text-left text-xs overflow-auto max-w-lg">
                <pre>{debug}</pre>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mb-4">Completing your Spotify login...</p>
            <div className="w-8 h-8 border-t-2 border-b-2 border-green-500 rounded-full animate-spin"></div>
          </>
        )}
      </div>
    </div>
  )
}

