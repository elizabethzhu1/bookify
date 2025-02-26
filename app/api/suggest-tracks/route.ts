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
    
    // Generate search queries based on book information
    const searchQueries = generateSearchQueries(bookTitle, bookAuthor, bookGenre, bookDescription);
    
    // Generate mock tracks based on the book information
    const tracks = generateMockTracks(searchQueries);
    
    // Format the response to match the playlist data structure
    const playlistData = {
      playlistId: null, // No actual playlist ID since we're not creating one
      name: `Bookify: ${bookTitle}`,
      external_url: null,
      uri: null,
      tracks: tracks
    };
    
    return NextResponse.json(playlistData);
  } catch (error) {
    console.error("Error suggesting tracks:", error);
    return NextResponse.json(
      { error: "Failed to suggest tracks for the book" },
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

// Generate mock tracks based on search queries
function generateMockTracks(searchQueries: string[]): any[] {
  // A collection of mock tracks to choose from
  const mockTrackPool = [
    {
      name: "Dreamscape",
      artist: "Ambient Collective",
      album: "Ethereal Journeys",
      image: "https://i.scdn.co/image/ab67616d0000b273b52a0f7a26cf2a4c45c15bea",
      uri: "spotify:track:1"
    },
    {
      name: "Midnight Reflection",
      artist: "Luna Waves",
      album: "Silent Hours",
      image: "https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a",
      uri: "spotify:track:2"
    },
    {
      name: "Epic Journey",
      artist: "Orchestral Adventures",
      album: "Heroes & Legends",
      image: "https://i.scdn.co/image/ab67616d0000b273b1c4b76e23414c9f20242268",
      uri: "spotify:track:3"
    },
    {
      name: "Suspense",
      artist: "Thriller Sounds",
      album: "Edge of Your Seat",
      image: "https://i.scdn.co/image/ab67616d0000b2735eb139846beb6b08c8752f0c",
      uri: "spotify:track:4"
    },
    {
      name: "Love Theme",
      artist: "Romantic Strings",
      album: "Eternal Love",
      image: "https://i.scdn.co/image/ab67616d0000b273d5e5ac9fca861307a2e00f64",
      uri: "spotify:track:5"
    },
    {
      name: "Space Odyssey",
      artist: "Cosmic Synth",
      album: "Interstellar Dreams",
      image: "https://i.scdn.co/image/ab67616d0000b273d8f5ab5cbdaef3c6f1f5c456",
      uri: "spotify:track:6"
    },
    {
      name: "Medieval Fantasy",
      artist: "Ancient Lore",
      album: "Kingdoms of Old",
      image: "https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f",
      uri: "spotify:track:7"
    },
    {
      name: "Cyberpunk Streets",
      artist: "Digital Noise",
      album: "Neon Future",
      image: "https://i.scdn.co/image/ab67616d0000b2738a3f0a3ca7929dea23cd274c",
      uri: "spotify:track:8"
    },
    {
      name: "Western Frontier",
      artist: "Dusty Roads",
      album: "Outlaws & Legends",
      image: "https://i.scdn.co/image/ab67616d0000b273c559a84d5a843f4c596f254a",
      uri: "spotify:track:9"
    },
    {
      name: "Haunted Mansion",
      artist: "Ghostly Echoes",
      album: "Supernatural",
      image: "https://i.scdn.co/image/ab67616d0000b273b6d4566db0d12894a1a3b7a2",
      uri: "spotify:track:10"
    },
    // Add more mock tracks as needed
  ];
  
  // Create a set of tracks based on the search queries
  const selectedTracks = [];
  const usedIndices = new Set();
  
  // First, select tracks that might match our queries
  for (const query of searchQueries) {
    const lowerQuery = query.toLowerCase();
    
    // Find tracks that might match this query
    for (let i = 0; i < mockTrackPool.length; i++) {
      if (usedIndices.has(i)) continue;
      
      const track = mockTrackPool[i];
      const trackString = `${track.name} ${track.artist} ${track.album}`.toLowerCase();
      
      // Simple matching logic - in a real app, this would be more sophisticated
      if (
        trackString.includes(lowerQuery) || 
        lowerQuery.includes("love") && trackString.includes("love") ||
        lowerQuery.includes("epic") && trackString.includes("epic") ||
        lowerQuery.includes("suspense") && trackString.includes("suspense") ||
        lowerQuery.includes("space") && trackString.includes("space") ||
        lowerQuery.includes("fantasy") && trackString.includes("fantasy")
      ) {
        selectedTracks.push(track);
        usedIndices.add(i);
        break;
      }
    }
  }
  
  // Fill up to 20 tracks with random selections
  while (selectedTracks.length < 20 && selectedTracks.length < mockTrackPool.length) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * mockTrackPool.length);
    } while (usedIndices.has(randomIndex));
    
    selectedTracks.push(mockTrackPool[randomIndex]);
    usedIndices.add(randomIndex);
  }
  
  // Shuffle the tracks for variety
  return selectedTracks.sort(() => Math.random() - 0.5);
} 