import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Define types for audio features
interface AudioFeatureTarget {
  min?: number;
  max?: number;
  target: number;
}

interface GenreAudioFeatures {
  valence: AudioFeatureTarget;
  energy: AudioFeatureTarget;
}

interface AudioFeaturesMap {
  [genre: string]: GenreAudioFeatures;
}

// Audio feature parameters for different book genres
const GENRE_AUDIO_FEATURES: AudioFeaturesMap = {
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

// Define types for Spotify objects
interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  type: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
}

interface SpotifyAudioFeatures {
  id: string;
  valence: number;
  energy: number;
  danceability: number;
}

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
    const isAuthenticated = !!accessToken;
    
    // Generate search queries based on book information
    const searchQueries = generateSearchQueries(bookTitle, bookAuthor, bookGenre, bookDescription);
    console.log("Search queries:", searchQueries);
    
    if (isAuthenticated) {
      // Authenticated user flow - create actual Spotify playlist
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
      
      // 2. Search for tracks
      const trackPromises = searchQueries.map(query => 
        searchSpotifyTracks(accessToken, query, 5)
      );
      const trackResults = await Promise.all(trackPromises);
      
      // 3. Flatten and filter the results
      let allTracks = trackResults.flat().filter((track): track is SpotifyTrack => track && track.type === "track");
      console.log(`Found ${allTracks.length} initial tracks`);
      
      // 4. Get audio features for the tracks
      const audioFeatures = await getAudioFeatures(accessToken, allTracks.map(track => track.id));
      
      // 5. Filter and rank tracks based on audio features and book genre
      const rankedTracks = rankTracksByRelevance(allTracks, audioFeatures, bookGenre || "");
      
      // 6. Get the top 20 tracks
      const selectedTracks = rankedTracks.slice(0, 20);
      console.log(`Selected ${selectedTracks.length} tracks for the playlist`);
      
      if (selectedTracks.length === 0) {
        throw new Error("No suitable tracks found for the given book");
      }
      
      // 7. Create a playlist
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
      
      // 8. Add tracks to the playlist
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
      
      // 9. Format the response
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
    } else {
      // Non-authenticated user flow - generate mock tracks
      console.log("User not authenticated with Spotify, generating mock tracks");
      
      // Generate mock tracks based on the book information
      const tracks = generateMockTracks(searchQueries, bookGenre || "");
      
      // Make sure tracks is never undefined or null
      const safeTrackList = tracks && tracks.length > 0 ? tracks : [];
      
      // Format the response to match the playlist data structure
      const playlistData = {
        playlistId: null, // No actual playlist ID since we're not creating one
        name: `Bookify: ${bookTitle}`,
        external_url: null,
        uri: null,
        tracks: safeTrackList,
      };
      
      return NextResponse.json(playlistData);
    }
  } catch (error) {
    console.error("Error generating playlist:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate playlist" },
      { status: 500 }
    );
  }
}

// Helper function to search Spotify tracks
async function searchSpotifyTracks(accessToken: string, query: string, limit = 10): Promise<SpotifyTrack[]> {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&market=US`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error("Failed to search tracks");
  }
  
  const data = await response.json();
  return data.tracks.items || [];
}

// Get audio features for multiple tracks
async function getAudioFeatures(accessToken: string, trackIds: string[]): Promise<SpotifyAudioFeatures[]> {
  if (trackIds.length === 0) return [];
  
  // Spotify's API only allows 100 IDs per request
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
      throw new Error("Failed to get audio features");
    }
    
    const data = await response.json();
    return data.audio_features || [];
  });
  
  const results = await Promise.all(featuresPromises);
  return results.flat().filter(Boolean);
}

// Helper function to rank tracks by relevance to the book
function rankTracksByRelevance(tracks: SpotifyTrack[], audioFeatures: SpotifyAudioFeatures[], bookGenre: string): SpotifyTrack[] {
  // Create a map of track ID to audio features
  const featuresMap = new Map<string, SpotifyAudioFeatures>();
  audioFeatures.forEach(feature => {
    if (feature && feature.id) {
      featuresMap.set(feature.id, feature);
    }
  });
  
  // Determine target features based on book genre
  let targetFeatures = GENRE_AUDIO_FEATURES.default;
  const lowerGenre = bookGenre.toLowerCase();
  
  // Try to match the genre to one of our predefined genre features
  Object.keys(GENRE_AUDIO_FEATURES).forEach(genre => {
    if (lowerGenre.includes(genre)) {
      targetFeatures = GENRE_AUDIO_FEATURES[genre];
    }
  });
  
  // Add a score to each track based on how well it matches the target features
  const scoredTracks = tracks.map(track => {
    const features = featuresMap.get(track.id);
    
    // If we don't have features for this track, give it a neutral score
    if (!features) {
      return { track, score: 0.5 };
    }
    
    // Start with a base score of 1
    let score = 1;
    
    // Calculate valence score (how positive/negative the track is)
    if (features.valence !== undefined) {
      const valenceScore = calculateFeatureScore(
        features.valence,
        targetFeatures.valence.min,
        targetFeatures.valence.max,
        targetFeatures.valence.target
      );
      score *= valenceScore;
    }
    
    // Calculate energy score
    if (features.energy !== undefined) {
      const energyScore = calculateFeatureScore(
        features.energy,
        targetFeatures.energy.min,
        targetFeatures.energy.max,
        targetFeatures.energy.target
      );
      score *= energyScore;
    }
    
    return { track, score };
  });
  
  // Sort by score (highest first) and return just the tracks
  return scoredTracks
    .sort((a, b) => b.score - a.score)
    .map(item => item.track);
}

// Calculate a score for how well a feature matches the target
function calculateFeatureScore(
  value: number, 
  min?: number, 
  max?: number, 
  target?: number
): number {
  // If there's a target value, score based on proximity
  if (target !== undefined) {
    const distance = Math.abs(value - target);
    return Math.max(0.1, 1 - distance); // Ensure a minimum score of 0.1
  }
  
  // If there's a min value but no max, score based on how much above min
  if (min !== undefined && max === undefined) {
    if (value < min) return 0.2; // Below minimum gets a low score
    const scoreAboveMin = 0.5 + (value - min) * 0.5; // Higher values get better scores
    return Math.min(1, scoreAboveMin); // Cap at 1
  }
  
  // If there's a max value but no min, score based on how much below max
  if (max !== undefined && min === undefined) {
    if (value > max) return 0.2; // Above maximum gets a low score
    const scoreBelowMax = 0.5 + (max - value) * 0.5; // Lower values get better scores
    return Math.min(1, scoreBelowMax); // Cap at 1
  }
  
  // If there's both a min and max, score based on being in range
  if (min !== undefined && max !== undefined) {
    if (value < min || value > max) return 0.2; // Outside range gets a low score
    
    // Inside range gets a score between 0.5 and 1 based on position in the range
    const position = (value - min) / (max - min);
    const adjustedPosition = Math.abs(position - 0.5) * 2; // 0 at the center, 1 at the edges
    return 0.5 + (1 - adjustedPosition) * 0.5; // 1 at the center, 0.5 at the edges
  }
  
  // Default score if no constraints were provided
  return 0.5;
}

// Helper function to generate search queries based on book information
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

// Define track interface for mock tracks
interface MockTrack {
  name: string;
  artist: string;
  album: string;
  image: string;
  uri: string;
}

// Generate mock tracks based on search queries and genre
function generateMockTracks(searchQueries: string[], genre: string): MockTrack[] {
  // Enhanced mock track pool with more varied songs and valid image URLs
  const mockTrackPool: MockTrack[] = [
    // Romance themed tracks
    {
      name: "Can't Help Falling in Love",
      artist: "Elvis Presley",
      album: "Blue Hawaii",
      image: "https://i.scdn.co/image/ab67616d0000b273f947f3521c3a2f64747b0d12",
      uri: "spotify:track:romance1"
    },
    {
      name: "At Last",
      artist: "Etta James",
      album: "At Last!",
      image: "https://i.scdn.co/image/ab67616d0000b273053c9b7e40c66d2505b8e398",
      uri: "spotify:track:romance2"
    },
    
    // Mystery/Thriller tracks
    {
      name: "Thriller",
      artist: "Michael Jackson",
      album: "Thriller",
      image: "https://i.scdn.co/image/ab67616d0000b2734121faee8df82c526cbab2be",
      uri: "spotify:track:thriller1"
    },
    {
      name: "Bad Guy",
      artist: "Billie Eilish",
      album: "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
      image: "https://i.scdn.co/image/ab67616d0000b273d55326e912165c6f4e42aa8e",
      uri: "spotify:track:thriller2"
    },
    
    // Fantasy/Adventure tracks
    {
      name: "Immigrant Song",
      artist: "Led Zeppelin",
      album: "Led Zeppelin III",
      image: "https://i.scdn.co/image/ab67616d0000b273a1995d8c79c87d6e889ef2a3",
      uri: "spotify:track:fantasy1"
    },
    {
      name: "The Dragonborn Comes",
      artist: "Malukah",
      album: "Skyrim",
      image: "https://i.scdn.co/image/ab67616d0000b27336c5417732e53e23cb219246",
      uri: "spotify:track:fantasy2"
    },
    
    // Sci-Fi tracks
    {
      name: "Starman",
      artist: "David Bowie",
      album: "The Rise and Fall of Ziggy Stardust",
      image: "https://i.scdn.co/image/ab67616d0000b2730ca902776ffe78a3f92adc61",
      uri: "spotify:track:scifi1"
    },
    {
      name: "Space Oddity",
      artist: "David Bowie",
      album: "Space Oddity",
      image: "https://i.scdn.co/image/ab67616d0000b2731e173bb4e0f8ef205d51a987",
      uri: "spotify:track:scifi2"
    },
    
    // Historical tracks
    {
      name: "The Times They Are A-Changin'",
      artist: "Bob Dylan",
      album: "The Times They Are A-Changin'",
      image: "https://i.scdn.co/image/ab67616d0000b273e8dd3c6b63d23c905e71d196",
      uri: "spotify:track:historical1"
    },
    {
      name: "Ohio",
      artist: "Crosby, Stills, Nash & Young",
      album: "4 Way Street",
      image: "https://i.scdn.co/image/ab67616d0000b273e40f9b671dda4f6ef8f83d80",
      uri: "spotify:track:historical2"
    },
    
    // Children's tracks
    {
      name: "How Far I'll Go",
      artist: "Auli'i Cravalho",
      album: "Moana",
      image: "https://i.scdn.co/image/ab67616d0000b2738ead30d906aca7bd5447ca2c",
      uri: "spotify:track:children1"
    },
    {
      name: "Let It Go",
      artist: "Idina Menzel",
      album: "Frozen",
      image: "https://i.scdn.co/image/ab67616d0000b2735b8397363f8f0f4041ae1ea0",
      uri: "spotify:track:children2"
    },
    
    // General/Classic tracks
    {
      name: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      image: "https://i.scdn.co/image/ab67616d0000b273c0a3f56023c52c21b6ec4d16", 
      uri: "spotify:track:classic1"
    },
    {
      name: "Smells Like Teen Spirit",
      artist: "Nirvana",
      album: "Nevermind",
      image: "https://i.scdn.co/image/ab67616d0000b27336adad5054e9302b364a05b4",
      uri: "spotify:track:classic2"
    }
  ];

  // Select genre-appropriate tracks based on book genre
  const genreSpecificTracks: MockTrack[] = [];
  const lowerGenre = genre.toLowerCase();
  
  // First pass: select genre-specific tracks
  if (lowerGenre.includes('romance') || lowerGenre.includes('love')) {
    genreSpecificTracks.push(...mockTrackPool.slice(0, 2));
  } else if (lowerGenre.includes('thriller') || lowerGenre.includes('mystery') || lowerGenre.includes('horror')) {
    genreSpecificTracks.push(...mockTrackPool.slice(2, 4));
  } else if (lowerGenre.includes('fantasy') || lowerGenre.includes('adventure')) {
    genreSpecificTracks.push(...mockTrackPool.slice(4, 6));
  } else if (lowerGenre.includes('sci-fi') || lowerGenre.includes('science fiction')) {
    genreSpecificTracks.push(...mockTrackPool.slice(6, 8));
  } else if (lowerGenre.includes('history') || lowerGenre.includes('historical')) {
    genreSpecificTracks.push(...mockTrackPool.slice(8, 10));
  } else if (lowerGenre.includes('children') || lowerGenre.includes('kids')) {
    genreSpecificTracks.push(...mockTrackPool.slice(10, 12));
  }
  
  // Create a selection of tracks based on book information
  const selectedTracks: MockTrack[] = [...genreSpecificTracks];
  const usedTrackIndices = new Set(genreSpecificTracks.map((_, i) => i));
  
  // Second pass: add tracks based on search queries
  for (const query of searchQueries) {
    if (selectedTracks.length >= 10) break;
    
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/).filter(word => word.length > 3);
    
    for (let i = 0; i < mockTrackPool.length; i++) {
      if (usedTrackIndices.has(i) || selectedTracks.length >= 10) continue;
      
      const track = mockTrackPool[i];
      const trackString = `${track.name} ${track.artist} ${track.album}`.toLowerCase();
      
      // Check if any significant word from the query is in the track info
      const matchesQuery = words.some(word => trackString.includes(word));
      
      if (matchesQuery) {
        selectedTracks.push(track);
        usedTrackIndices.add(i);
      }
    }
  }
  
  // Fill remaining spots with random tracks
  while (selectedTracks.length < 10) {
    const remainingTracks = mockTrackPool.filter((_, i) => !usedTrackIndices.has(i));
    if (remainingTracks.length === 0) break;
    
    const randomTrack = remainingTracks[Math.floor(Math.random() * remainingTracks.length)];
    const randomIndex = mockTrackPool.indexOf(randomTrack);
    
    selectedTracks.push(randomTrack);
    usedTrackIndices.add(randomIndex);
  }
  
  return selectedTracks;
} 