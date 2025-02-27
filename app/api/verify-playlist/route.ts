import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const playlistId = url.searchParams.get("id");
    
    if (!playlistId) {
      return NextResponse.json({ exists: false, error: "No playlist ID provided" }, { status: 400 });
    }
    
    // Get access token
    const cookieStore = cookies();
    const accessToken = cookieStore.get("spotify_access_token")?.value;
    
    if (!accessToken) {
      return NextResponse.json({ exists: false, error: "Not authenticated" }, { status: 401 });
    }
    
    // Check if the playlist exists by trying to fetch it from Spotify
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    if (response.ok) {
      return NextResponse.json({ exists: true });
    }
    
    return NextResponse.json({ exists: false, status: response.status });
  } catch (error) {
    console.error("Error verifying playlist:", error);
    return NextResponse.json({ exists: false, error: "Failed to verify playlist" }, { status: 500 });
  }
} 