const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
const SPOTIFY_API_URL = "https://api.spotify.com/v1"

export function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  
  return text;
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getSpotifyAccessToken() {
  const response = await fetch("/api/refresh-token")
  if (!response.ok) {
    throw new Error("Failed to refresh access token")
  }
  return response.json()
}

export async function searchSpotifyTracks(query: string, limit = 10, accessToken?: string) {
  if (!accessToken) {
    // Mock response for non-authenticated users
    return [];
  }
  
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!response.ok) {
    console.error("Search failed:", await response.text());
    return [];
  }
  
  const data = await response.json();
  return data.tracks.items;
}

export async function createSpotifyPlaylist(
  name: string,
  description: string,
  trackUris: string[],
  accessToken: string
) {
  // Get user ID
  const userResponse = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!userResponse.ok) {
    throw new Error("Failed to get user profile");
  }
  
  const userData = await userResponse.json();
  const userId = userData.id;
  
  // Create playlist
  const createResponse = await fetch(
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
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
    }
  );
  
  if (!createResponse.ok) {
    throw new Error("Failed to create playlist");
  }
  
  const playlist = await createResponse.json();
  
  // Add tracks to playlist
  if (trackUris.length > 0) {
    const addTracksResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: trackUris,
        }),
      }
    );
    
    if (!addTracksResponse.ok) {
      throw new Error("Failed to add tracks to playlist");
    }
  }
  
  return playlist;
}

async function savePlaylistToUserAccount(accessToken: string, playlistId: string) {
  // Placeholder implementation - replace with actual logic if needed
  console.log(`Saving playlist ${playlistId} to user account with token ${accessToken.substring(0, 10)}...`)
}

export { getSpotifyAccessToken, savePlaylistToUserAccount }

export async function getAudioFeatures(trackIds: string[], accessToken: string) {
  if (!trackIds.length) return [];
  
  // Spotify API limits to 100 IDs per request
  const batchSize = 100;
  const results = [];
  
  for (let i = 0; i < trackIds.length; i += batchSize) {
    const batch = trackIds.slice(i, i + batchSize);
    const idsString = batch.join(',');
    
    const response = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${idsString}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.audio_features) {
        results.push(...data.audio_features);
      }
    } else {
      console.error("Failed to fetch audio features:", await response.text());
    }
  }
  
  return results;
}

