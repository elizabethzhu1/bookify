"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import Image from "next/image"

export default function SpotifyAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Get the base URL for API calls (works in both production and development)
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${getBaseUrl()}/api/check-auth`)
        const data = await response.json()
        setIsAuthenticated(data.isAuthenticated)
      } catch (error) {
        console.error("Error checking auth status:", error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleConnect = async () => {
    try {
      // Get the authorization URL from the server
      const response = await fetch(`${getBaseUrl()}/api/spotify-auth-url`)
      const data = await response.json()
      
      if (data.authUrl) {
        // Redirect to Spotify authorization page
        window.location.href = data.authUrl
      } else {
        console.error("No auth URL returned")
      }
    } catch (error) {
      console.error("Error initiating Spotify auth:", error)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await fetch(`${getBaseUrl()}/api/logout`, { method: "POST" })
      setIsAuthenticated(false)
    } catch (error) {
      console.error("Error logging out:", error)
    } finally {
      setIsDisconnecting(false)
    }
  }

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="bg-gray-700 text-gray-300">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Checking...
      </Button>
    )
  }

  if (isAuthenticated) {
    return (
      <Button 
        variant="outline" 
        onClick={handleDisconnect}
        disabled={isDisconnecting}
        className="bg-red-600 hover:bg-red-700 text-white border-none"
      >
        {isDisconnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Disconnecting...
          </>
        ) : (
          "Disconnect from Spotify"
        )}
      </Button>
    )
  }

  return (
    <Button 
      variant="outline" 
      onClick={handleConnect}
      className="bg-[#118e3c] hover:bg-[#1ed760] text-white border-none flex items-center"
    >
      <Image 
        src="/spotify.png" 
        alt="Spotify logo" 
        width={25} 
        height={25} 
        className="mr-2" 
      />
      Connect with Spotify
    </Button>
  )
}

