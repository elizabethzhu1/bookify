import { NextResponse } from "next/server"
import { getSpotifyAccessToken, savePlaylistToUserAccount } from "@/utils/spotify"

export async function POST(request: Request) {
  const { playlistId } = await request.json()

  if (!playlistId) {
    return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 })
  }

  try {
    const accessToken = await getSpotifyAccessToken()
    await savePlaylistToUserAccount(accessToken, playlistId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving playlist:", error)
    return NextResponse.json({ error: "Failed to save playlist" }, { status: 500 })
  }
}

