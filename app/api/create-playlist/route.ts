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
    const playlistName = `Bookify: ${bookTitle}`;
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
    
    // 3. Generate search queries based on book information
    const searchQueries = generateSearchQueries(bookTitle, bookAuthor, bookGenre, bookDescription);
    
    // 4. Search for tracks using multiple queries
    const allTracks = [];
    const tracksPerQuery = 5;
    
    for (const query of searchQueries) {
      try {
        const searchResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${tracksPerQuery}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const tracks = searchData.tracks.items;
          
          // Add tracks to our collection, avoiding duplicates
          for (const track of tracks) {
            if (!allTracks.some(t => t.uri === track.uri)) {
              allTracks.push(track);
            }
          }
        }
      } catch (error) {
        console.error(`Error searching for term "${query}":`, error);
      }
    }
    
    // Shuffle and limit tracks
    const shuffledTracks = allTracks
      .sort(() => Math.random() - 0.5)
      .slice(0, 20);
    
    if (shuffledTracks.length === 0) {
      throw new Error("No tracks found for the given book");
    }
    
    // 5. Add tracks to the playlist
    const trackUris = shuffledTracks.map(track => track.uri);
    
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
      throw new Error("Failed to add tracks to playlist");
    }
    
    // 6. Format the response with track details
    const formattedTracks = shuffledTracks.map(track => ({
      name: track.name,
      artist: track.artists[0].name,
      album: track.album.name,
      image: track.album.images[0]?.url,
      uri: track.uri,
    }));
    
    return NextResponse.json({
      playlistId,
      name: playlistName,
      external_url: playlistData.external_urls.spotify,
      uri: playlistData.uri,
      tracks: formattedTracks
    });
  } catch (error) {
    console.error("Error creating playlist:", error);
    return NextResponse.json(
      { error: "Failed to create Spotify playlist" },
      { status: 500 }
    );
  }
}

function generateSearchQueries(
  title: string,
  author?: string,
  genre?: string,
  description?: string
): string[] {
  const queries = [];
  
  // Add title and author combination
  if (author) {
    queries.push(`${title} ${author}`);
  }
  
  // Add genre-based queries
  if (genre) {
    const lowerGenre = genre.toLowerCase();
    
    if (lowerGenre.includes("romance")) {
      queries.push("love songs", "romantic", `${genre} music`);
    } else if (lowerGenre.includes("thriller") || lowerGenre.includes("mystery")) {
      queries.push("suspense", "tension", "dark", `${genre} soundtrack`);
    } else if (lowerGenre.includes("fantasy")) {
      queries.push("epic", "magical", "fantasy soundtrack", `${genre} theme`);
    } else if (lowerGenre.includes("sci-fi") || lowerGenre.includes("science fiction")) {
      queries.push("electronic", "futuristic", "space", `${genre} soundtrack`);
    } else {
      queries.push(genre);
    }
  }
  
  // Add description-based queries if available
  if (description) {
    // Extract key themes from description
    const words = description
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => 
        word.length > 4 && 
        !["about", "which", "there", "their", "other", "another"].includes(word)
      );
    
    // Get unique words
    const uniqueWords = [...new Set(words)];
    
    // Take up to 3 significant words from description
    const significantWords = uniqueWords.slice(0, 3);
    
    if (significantWords.length > 0) {
      queries.push(significantWords.join(" "));
    }
  }
  
  // Add some generic queries based on title
  queries.push(`${title} soundtrack`, `${title} theme`, "instrumental");
  
  // Remove duplicates and return
  return [...new Set(queries)];
} 