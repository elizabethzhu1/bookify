"use client"

import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { generateCodeVerifier, generateCodeChallenge } from "@/utils/pkce"

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
// Use the exact production URL for Vercel deployment
const REDIRECT_URI = "https://bookify-v1.vercel.app/callback"
const SCOPE = "user-read-private user-read-email playlist-modify-public playlist-modify-private user-top-read"

export default function SpotifyAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/check-auth")
        const data = await response.json()
        setIsAuthenticated(data.isAuthenticated)
        
        // If token needs refresh, handle it
        if (data.needsRefresh) {
          try {
            const refreshResponse = await fetch("/api/refresh-token", {
              method: "POST" // Change to POST method
            })
            
            if (refreshResponse.ok) {
              // Check auth again after refresh
              const refreshCheckResponse = await fetch("/api/check-auth")
              const refreshData = await refreshCheckResponse.json()
              setIsAuthenticated(refreshData.isAuthenticated)
            } else {
              // If refresh fails, user needs to re-authenticate
              setIsAuthenticated(false)
            }
          } catch (refreshError) {
            console.error("Error refreshing token:", refreshError)
            setIsAuthenticated(false)
          }
        }
      } catch (error) {
        console.error("Error checking auth status:", error)
        setIsAuthenticated(false)
        setAuthError("Failed to check authentication status")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleLogin = async () => {
    try {
      setIsLoading(true)
      setAuthError(null)

      const codeVerifier = generateCodeVerifier(128)
      const codeChallenge = await generateCodeChallenge(codeVerifier)

      localStorage.setItem("code_verifier", codeVerifier)

      const authUrl = new URL("https://accounts.spotify.com/authorize")
      const params = {
        response_type: "code",
        client_id: CLIENT_ID!,
        scope: SCOPE,
        code_challenge_method: "S256",
        code_challenge: codeChallenge,
        redirect_uri: REDIRECT_URI,
        state: crypto.randomUUID(),
      }

      localStorage.setItem("spotify_auth_state", params.state)
      console.log("Starting auth with redirect URI:", REDIRECT_URI)

      authUrl.search = new URLSearchParams(params).toString()
      window.location.href = authUrl.toString()
    } catch (error) {
      console.error("Error initiating login:", error)
      setAuthError("Failed to initiate Spotify login")
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/logout", { method: "POST" })
      if (response.ok) {
        setIsAuthenticated(false)
      } else {
        throw new Error("Logout failed")
      }
    } catch (error) {
      console.error("Error logging out:", error)
      setAuthError("Failed to log out")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {authError && <p className="text-red-500 text-sm">{authError}</p>}
      
      {isAuthenticated ? (
        <Button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white"
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Disconnect from Spotify"}
        </Button>
      ) : (
        <Button
          onClick={handleLogin}
          className="bg-[#1DB954] hover:bg-[#1ed760] text-white"
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Connect with Spotify"}
        </Button>
      )}
    </div>
  )
}

