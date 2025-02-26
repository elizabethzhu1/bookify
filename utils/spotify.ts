const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
const SPOTIFY_API_URL = "https://api.spotify.com/v1"

export function generateRandomString(length: number) {
  let text = ""
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

async function getSpotifyAccessToken() {
  const response = await fetch("/api/refresh-token")
  if (!response.ok) {
    throw new Error("Failed to refresh access token")
  }
  return response.json()
}

export async function searchSpotifyTracks(query: string, limit = 10) {
  try {
    await getSpotifyAccessToken()

    const response = await fetch(
      `${SPOTIFY_API_URL}/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&market=US`,
      {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)spotify_access_token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Failed to search tracks: ${errorData}`)
    }

    const data = await response.json()
    return data.tracks.items.filter((item: any) => item.type === "track")
  } catch (error) {
    console.error("Error in searchSpotifyTracks:", error)
    throw error
  }
}

export async function createSpotifyPlaylist(name: string, description: string, trackUris: string[]) {
  try {
    await getSpotifyAccessToken()

    const accessToken = document.cookie.replace(/(?:(?:^|.*;\s*)spotify_access_token\s*=\s*([^;]*).*$)|^.*$/, "$1")

    // Get the current user's profile
    const userResponse = await fetch(`${SPOTIFY_API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      throw new Error("Failed to get user profile")
    }

    const userData = await userResponse.json()
    const userId = userData.id

    // Create a new playlist
    const createResponse = await fetch(`${SPOTIFY_API_URL}/users/${userId}/playlists`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        public: true,
      }),
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.text()
      throw new Error(`Failed to create playlist: ${errorData}`)
    }

    const playlist = await createResponse.json()

    // Add tracks to the playlist
    if (trackUris.length > 0) {
      const addTracksResponse = await fetch(`${SPOTIFY_API_URL}/playlists/${playlist.id}/tracks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: trackUris,
        }),
      })

      if (!addTracksResponse.ok) {
        const errorData = await addTracksResponse.text()
        throw new Error(`Failed to add tracks to playlist: ${errorData}`)
      }
    }

    return {
      id: playlist.id,
      name: playlist.name,
      external_url: playlist.external_urls.spotify,
      uri: playlist.uri,
    }
  } catch (error) {
    console.error("Error in createSpotifyPlaylist:", error)
    throw error
  }
}

async function savePlaylistToUserAccount(accessToken: string, playlistId: string) {
  // Placeholder implementation - replace with actual logic if needed
  console.log(`Saving playlist ${playlistId} to user account with token ${accessToken.substring(0, 10)}...`)
}

export { getSpotifyAccessToken, savePlaylistToUserAccount }

