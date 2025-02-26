import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Audio feature parameters for different book genres
const GENRE_AUDIO_FEATURES = {
  romance: { valence: { min: 0.5, target: 0.7 }, energy: { min: 0.4, target: 0.6 } },
  thriller: { valence: { max: 0.5, target: 0.3 }, energy: { min: 0.6, target: 0.8 } },
  horror: { valence: { max: 0.4, target: 0.2 }, energy: { min: 0.5, target: 0.7 } },
  mystery: { valence: { max: 0.5, target: 0.4 }, energy: { min: 0.5, target: 0.6 } },
  fantasy: { valence: { min: 0.4, target: 0.6 }, energy: { min: 0.6, target: 0.7 } },
  "sci-fi": { valence: { min: 0.3, target: 0.5 }, energy: { min: 0.5, target: 0.7 } },
  adventure: { valence: { min: 0.5, target: 0.7 }, energy: { min: 0.7, target: 0.8 } },
  historical: { valence: { target: 0.5 }, energy: { target: 0.5 } },
  biography: { valence: { target: 0.5 }, energy: { target: 0.4 } },
  children: { valence: { min: 0.6, target: 0.8 }, energy: { min: 0.5, target: 0.7 } },
  default: { valence: { target: 0.5 }, energy: { target: 0.5 } }
};

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
    
    console.log("Generating playlist for:", bookTitle);
    
    // 1. Get the user's Spotify ID
    const userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        return NextResponse.json(
          { error: "Spotify token expired", needsRefresh: true },
          { status: 401 }
        );
      }
      throw new Error("Failed to get user profile");
    }
    
    const userData = await userResponse.json();
    const userId = userData.id;
    
    // 2. Generate search queries based on book information
    const searchQueries = generateSearchQueries(bookTitle, bookAuthor, bookGenre, bookDescription);
    console.log("Search queries:", searchQueries);
    
    // 3. Search for tracks
    const trackPromises = searchQueries.map(query => 
      searchSpotifyTracks(accessToken, query, 5)
    );
    const trackResults = await Promise.all(trackPromises);
    
    // 4. Flatten and filter the results
    let allTracks = trackResults.flat().filter(track => track && track.type === "track");
    console.log(`Found ${allTracks.length} initial tracks`);
    
    // 5. Get audio features for the tracks
    const audioFeatures = await getAudioFeatures(accessToken, allTracks.map(track => track.id));
    
    // 6. Filter and rank tracks based on audio features and book genre
    const rankedTracks = rankTracksByRelevance(allTracks, audioFeatures, bookGenre);
    
    // 7. Get the top 20 tracks
    const selectedTracks = rankedTracks.slice(0, 20);
    console.log(`Selected ${selectedTracks.length} tracks for the playlist`);
    
    if (selectedTracks.length === 0) {
      throw new Error("No suitable tracks found for the given book");
    }
    
    // 8. Create a playlist
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
    
    const playlist = await createPlaylistResponse.json();
    
    // 9. Add tracks to the playlist
    if (selectedTracks.length > 0) {
      const addTracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: selectedTracks.map(track => track.uri),
          }),
        }
      );
      
      if (!addTracksResponse.ok) {
        throw new Error("Failed to add tracks to playlist");
      }
    }
    
    // 10. Format the response
    const formattedPlaylist = {
      playlistId: playlist.id,
      name: playlistName,
      external_url: playlist.external_urls.spotify,
      uri: playlist.uri,
      tracks: selectedTracks.map(track => ({
        name: track.name,
        artist: track.artists[0].name,
        album: track.album.name,
        image: track.album.images[0]?.url,
        uri: track.uri,
      })),
    };
    
    return NextResponse.json(formattedPlaylist);
  } catch (error) {
    console.error("Error generating playlist:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate playlist" },
      { status: 500 }
    );
  }
}

// Helper function to search Spotify tracks
async function searchSpotifyTracks(accessToken: string, query: string, limit = 10) {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&market=US`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!response.ok) {
    console.error(`Failed to search for "${query}": ${response.status}`);
    return [];
  }
  
  const data = await response.json();
  return data.tracks.items;
}

// Helper function to get audio features for multiple tracks
async function getAudioFeatures(accessToken: string, trackIds: string[]) {
  if (trackIds.length === 0) return [];
  
  // Spotify API limits to 100 IDs per request
  const chunks = [];
  for (let i = 0; i < trackIds.length; i += 100) {
    chunks.push(trackIds.slice(i, i + 100));
  }
  
  const featuresPromises = chunks.map(async chunk => {
    const response = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${chunk.join(",")}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      console.error(`Failed to get audio features: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return data.audio_features;
  });
  
  const results = await Promise.all(featuresPromises);
  return results.flat();
}

// Helper function to rank tracks by relevance to the book
function rankTracksByRelevance(tracks, audioFeatures, bookGenre) {
  // Create a map of track ID to audio features
  const featuresMap = new Map();
  audioFeatures.forEach(features => {
    if (features) featuresMap.set(features.id, features);
  });
  
  // Determine which audio feature targets to use based on genre
  const lowerGenre = bookGenre?.toLowerCase() || "";
  let targetFeatures = GENRE_AUDIO_FEATURES.default;
  
  // Find the best matching genre
  Object.keys(GENRE_AUDIO_FEATURES).forEach(genre => {
    if (lowerGenre.includes(genre)) {
      targetFeatures = GENRE_AUDIO_FEATURES[genre];
    }
  });
  
  // Score each track based on how well its features match the target
  return tracks
    .map(track => {
      const features = featuresMap.get(track.id);
      if (!features) return { track, score: 0 };
      
      // Calculate score based on distance from target values
      let score = 1.0;
      
      // Valence score (positivity/negativity)
      if (targetFeatures.valence) {
        const valenceScore = calculateFeatureScore(
          features.valence,
          targetFeatures.valence.min,
          targetFeatures.valence.max,
          targetFeatures.valence.target
        );
        score *= valenceScore;
      }
      
      // Energy score
      if (targetFeatures.energy) {
        const energyScore = calculateFeatureScore(
          features.energy,
          targetFeatures.energy.min,
          targetFeatures.energy.max,
          targetFeatures.energy.target
        );
        score *= energyScore;
      }
      
      return { track, score };
    })
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .map(item => item.track); // Return just the tracks
}

// Calculate a score for how well a feature matches the target
function calculateFeatureScore(value, min, max, target) {
  // If there's a target value, score based on proximity
  if (target !== undefined) {
    const distance = Math.abs(value - target);
    return Math.max(0, 1 - distance);
  }
  
  // If there's a min value, check if it's above
  if (min !== undefined && value < min) {
    return Math.max(0, value / min);
  }
  
  // If there's a max value, check if it's below
  if (max !== undefined && value > max) {
    return Math.max(0, 1 - ((value - max) / (1 - max)));
  }
  
  // If we get here, the value is within range
  return 1.0;
}

// Generate search queries based on book information
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