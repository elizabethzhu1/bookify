import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { bookTitle, bookAuthor, bookGenre, bookDescription } = await request.json();
    
    if (!bookTitle) {
      return NextResponse.json(
        { error: "Book title is required" },
        { status: 400 }
      );
    }
    
    const cookieStore = cookies();
    const accessToken = cookieStore.get("spotify_access_token")?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: "Not authenticated with Spotify" },
        { status: 401 }
      );
    }
    
    // 1. Get the user's Spotify ID
    const userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        // Token expired - client should refresh
        return NextResponse.json(
          { error: "Spotify token expired", needsRefresh: true },
          { status: 401 }
        );
      }
      throw new Error("Failed to get user profile");
    }
    
    const userData = await userResponse.json();
    const userId = userData.id;
    
    // 2. Create a new playlist
    const playlistName = `${bookTitle} Soundtrack`;
    const playlistDescription = `A playlist inspired by "${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ""}`;
    
    const createPlaylistResponse = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: playlistName,
          description: playlistDescription,
          public: true,
        }),
      }
    );
    
    if (!createPlaylistResponse.ok) {
      throw new Error("Failed to create playlist");
    }
    
    const playlistData = await createPlaylistResponse.json();
    const playlistId = playlistData.id;
    
    // 3. Search for tracks based on the book's theme
    // In a real app, you would use AI to generate better search terms
    const searchTerms = generateSearchTerms(bookTitle, bookGenre, bookDescription);
    const trackUris = await searchForTracks(accessToken, searchTerms);
    
    // 4. Add tracks to the playlist
    if (trackUris.length > 0) {
      const addTracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
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
        console.error("Failed to add tracks to playlist");
      }
    }
    
    return NextResponse.json({ 
      success: true,
      playlistId,
      playlistUrl: playlistData.external_urls.spotify
    });
  } catch (error) {
    console.error("Error creating playlist:", error);
    return NextResponse.json(
      { error: "Failed to create Spotify playlist" },
      { status: 500 }
    );
  }
}

function generateSearchTerms(
  bookTitle: string,
  bookGenre?: string,
  bookDescription?: string
): string[] {
  // This is a simplified approach - in a real app, you would use AI
  // to generate more relevant search terms based on the book content
  
  const terms: string[] = [];
  
  // Add genre-based terms
  if (bookGenre) {
    if (bookGenre.toLowerCase().includes("romance")) {
      terms.push("love songs", "romantic");
    } else if (bookGenre.toLowerCase().includes("thriller") || bookGenre.toLowerCase().includes("mystery")) {
      terms.push("suspense", "tension", "dark");
    } else if (bookGenre.toLowerCase().includes("fantasy")) {
      terms.push("epic", "magical", "fantasy soundtrack");
    } else if (bookGenre.toLowerCase().includes("sci-fi") || bookGenre.toLowerCase().includes("science fiction")) {
      terms.push("electronic", "futuristic", "space");
    } else {
      terms.push(bookGenre);
    }
  }
  
  // Add some generic terms
  terms.push("soundtrack", "instrumental", bookTitle);
  
  return terms;
}

async function searchForTracks(accessToken: string, searchTerms: string[]): Promise<string[]> {
  const trackUris: string[] = [];
  const tracksPerTerm = 3; // Number of tracks to add per search term
  
  for (const term of searchTerms) {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(term)}&type=track&limit=${tracksPerTerm}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const tracks = data.tracks.items;
        
        for (const track of tracks) {
          if (!trackUris.includes(track.uri)) {
            trackUris.push(track.uri);
          }
        }
      }
    } catch (error) {
      console.error(`Error searching for term "${term}":`, error);
    }
  }
  
  // Limit to 20 tracks maximum
  return trackUris.slice(0, 20);
} 