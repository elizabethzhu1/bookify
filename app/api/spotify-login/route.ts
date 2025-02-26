import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify-callback`
const SCOPE = "playlist-modify-public playlist-modify-private user-read-private user-read-email"

function generateRandomString(length: number) {
  let text = ""
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

export async function GET() {
  const state = generateRandomString(16)
  const queryParams = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID!,
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    state: state,
  })

  const authUrl = `https://accounts.spotify.com/authorize?${queryParams.toString()}`

  // Set the state in a cookie
  cookies().set("spotify_auth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 5, // 5 minutes
    path: "/",
  })

  return NextResponse.json({ authUrl })
}

