import { NextResponse } from "next/server"

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify-callback`

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: "Authorization code is required" }, { status: 400 })
    }

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error("Spotify token error:", error)
      return NextResponse.json({ error: "Failed to exchange code for tokens" }, { status: 500 })
    }

    const data = await tokenResponse.json()
    return NextResponse.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    })
  } catch (error) {
    console.error("Error in token exchange:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

