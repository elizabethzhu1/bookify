import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { searchSpotifyTracks, createSpotifyPlaylist, getAudioFeatures } from "@/utils/spotify";
import { generateBookPlaylistRecommendations } from "@/utils/openai";

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
  classic: { valence: { target: 0.5 }, energy: { max: 0.5, target: 0.4 } },
  literary: { valence: { target: 0.5 }, energy: { target: 0.4 } },
  contemporary: { valence: { target: 0.6 }, energy: { target: 0.6 } },
  default: { valence: { target: 0.5 }, energy: { target: 0.5 } }
};

// Genre mapping for Spotify search enhancement
const GENRE_MUSIC_MAPPING: Record<string, string[]> = {
  romance: ["love songs", "romantic", "ballad"],
  thriller: ["suspense", "cinematic", "dark"],
  horror: ["dark ambient", "suspense", "soundtrack"],
  mystery: ["soundtrack", "instrumental", "suspense"],
  fantasy: ["soundtrack", "celtic", "epic"],
  "sci-fi": ["electronic", "synthwave", "ambient"],
  adventure: ["soundtrack", "epic", "orchestral"],
  historical: ["classical", "orchestral", "period"],
  biography: ["reflective", "acoustic", "calm"],
  children: ["playful", "happy", "disney"],
  classic: ["classical", "orchestral", "chamber"],
  literary: ["acoustic", "folk", "reflective"],
  poetry: ["acoustic", "ambient", "minimalist"],
  fiction: ["indie", "alternative", "contemporary"],
  nonfiction: ["instrumental", "jazz", "classical"]
};

// Literary period mappings
const LITERARY_PERIODS: Record<string, [number, number, string[]]> = {
  // Period name: [start year, end year, associated music genres/terms]
  medieval: [500, 1400, ["medieval", "chant", "ancient"]],
  renaissance: [1400, 1660, ["renaissance", "baroque", "classical"]],
  enlightenment: [1660, 1790, ["classical", "baroque", "chamber"]],
  romantic: [1790, 1850, ["classical", "romantic", "orchestra"]],
  victorian: [1830, 1900, ["classical", "romantic", "orchestral"]],
  modernist: [1900, 1945, ["jazz", "classical", "instrumental"]],
  postmodern: [1945, 2000, ["experimental", "contemporary", "jazz"]],
  contemporary: [2000, 2024, ["indie", "modern", "alternative"]]
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

// Define the Track interface
interface Track {
  name: string;
  artist: string;
  album: string;
  image?: string;
  uri: string;
}

interface MockTrack {
  name: string;
  artist: string;
  album: string;
  image?: string;
  uri: string;
}

// At the top of the file, add these constants:
const AVG_READING_SPEED_WPM = 250; // Average adult reading speed (words per minute)
const AVG_WORDS_PER_PAGE = 300; // Average words per page in a standard book
const MIN_PLAYLIST_DURATION_MS = 15 * 60 * 1000; // 15 minutes minimum
const MAX_PLAYLIST_DURATION_MS = 180 * 60 * 1000; // 3 hours maximum

export async function POST(request: Request) {
  try {
    const { bookTitle, bookAuthor, bookGenre, bookDescription, pageCount } = await request.json();
    
    if (!bookTitle || !bookAuthor) {
      return NextResponse.json(
        { error: "Book title and author are required" },
        { status: 400 }
      );
    }
    
    // Get the user's Spotify access token
    const cookieStore = cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;
    const isAuthenticated = !!accessToken;
    
    console.log(`Creating playlist for "${bookTitle}" - Authenticated: ${isAuthenticated}`);
    
    // Generate playlist data
    let playlistId = null;
    let external_url = null;
    let uri = null;
    let tracks = [];
    
    if (isAuthenticated) {
      // Create a real Spotify playlist for authenticated users
      try {
        console.log("Creating Spotify playlist with user token");
        
        // Get AI recommendations first
        const aiRecommendations = await generateBookPlaylistRecommendations(
          bookTitle,
          bookAuthor,
          bookGenre || "",
          bookDescription || "",
          ""
        );
        
        // Generate search queries and get tracks
        const searchQueries = generateSearchQueries(bookTitle, bookAuthor, bookGenre);
        const allTracks = [];
        
        // Search for each query to build a pool of potential tracks
        for (const query of searchQueries) {
          const results = await searchSpotifyTracks(query, 15, accessToken);
          if (results && results.length > 0) {
            allTracks.push(...results);
          }
        }
        
        // Remove duplicates
        const uniqueTracks = removeDuplicateTracks(allTracks);
        
        // Enhance track selection with audio features
        const targetFeatures = aiRecommendations.audioFeatureTargets;
        const enhancedTracks = await enhanceTrackSelectionWithAIFeatures(
          uniqueTracks, 
          targetFeatures,
          accessToken
        );
        
        // Match duration to reading time
        const targetDurationMs = calculateReadingTime(pageCount);
        console.log(`Target duration: ${Math.round(targetDurationMs/60000)} minutes`);
        
        const selectedTracks = await matchPlaylistDurationToReadingTime(
          enhancedTracks,
          targetDurationMs,
          accessToken
        );
        
        // Create the playlist in Spotify
        const playlistName = `Bookify: ${bookTitle}`;
        const playlistDescription = `A playlist inspired by "${bookTitle}" by ${bookAuthor}. Generated by Bookify.`;
        
        // Get track URIs for the selected tracks
        const trackUris = selectedTracks
          .filter(track => track && track.uri && track.uri.startsWith('spotify:track:'))
          .map(track => track.uri);
        
        console.log(`Creating playlist with ${trackUris.length} tracks`);
        
        // Create the playlist in Spotify
        const playlist = await createSpotifyPlaylist(
          playlistName,
          playlistDescription,
          trackUris,
          accessToken
        );
        
        console.log("Playlist created:", playlist);
        
        // Format tracks for the response
        tracks = selectedTracks.map(track => ({
          name: track.name,
          artist: track.artists && track.artists[0] ? track.artists[0].name : "Unknown",
          album: track.album ? track.album.name : "Unknown",
          image: track.album && track.album.images && track.album.images[0] ? track.album.images[0].url : null,
          uri: track.uri
        }));
        
        // Set the playlist info
        playlistId = playlist.id;
        external_url = playlist.external_urls.spotify;
        uri = playlist.uri;
      } catch (error) {
        console.error("Error creating authenticated playlist:", error);
        // Fall back to non-authenticated approach if playlist creation fails
      }
    }
    
    // If no tracks were added (either not authenticated or creation failed),
    // generate mock tracks
    if (tracks.length === 0) {
      console.log("Generating non-authenticated playlist");
      const searchQueries = generateSearchQueries(bookTitle, bookAuthor, bookGenre);
      tracks = generateMockTracks(searchQueries);
    }
    
    return NextResponse.json({
      playlistId,
      name: `Bookify: ${bookTitle}`,
      external_url,
      uri,
      tracks
    });
  } catch (error) {
    console.error("Error processing playlist request:", error);
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}

// Normalize a genre string to match our known genres
function normalizeGenre(genre: string): string {
  const lowerGenre = genre.toLowerCase();
  
  if (lowerGenre.includes("romance") || lowerGenre.includes("love")) return "romance";
  if (lowerGenre.includes("thriller")) return "thriller";
  if (lowerGenre.includes("horror")) return "horror";
  if (lowerGenre.includes("mystery")) return "mystery";
  if (lowerGenre.includes("fantasy")) return "fantasy";
  if (lowerGenre.includes("sci-fi") || lowerGenre.includes("science fiction")) return "sci-fi";
  if (lowerGenre.includes("adventure")) return "adventure";
  if (lowerGenre.includes("histor")) return "historical";
  if (lowerGenre.includes("biograph")) return "biography";
  if (lowerGenre.includes("children") || lowerGenre.includes("kids")) return "children";
  if (lowerGenre.includes("classic")) return "classic";
  if (lowerGenre.includes("literary") || lowerGenre.includes("literature")) return "literary";
  if (lowerGenre.includes("poetry")) return "poetry";
  if (lowerGenre.includes("fiction") && !lowerGenre.includes("non")) return "fiction";
  if (lowerGenre.includes("non-fiction") || lowerGenre.includes("nonfiction")) return "nonfiction";
  
  return "default";
}

// Determine literary period based on year
function getLiteraryPeriod(year: number): string | null {
  for (const [period, [start, end, _]] of Object.entries(LITERARY_PERIODS)) {
    if (year >= start && year <= end) {
      return period;
    }
  }
  return null;
}

// Generate enhanced search queries
function generateSearchQueries(
  title: string, 
  author: string, 
  genre: string, 
  description: string,
  literaryPeriod: string | null
): string[] {
  const queries: string[] = [
    `${title} ${author}`, // Basic query with title and author
  ];
  
  // Add genre-based music queries
  const genreTerms = GENRE_MUSIC_MAPPING[genre] || [];
  if (genreTerms.length > 0) {
    queries.push(`${title} ${genreTerms[0]}`);
    genreTerms.forEach(term => {
      queries.push(`${term} music`);
    });
  }
  
  // Add literary period based queries if available
  if (literaryPeriod) {
    const periodTerms = LITERARY_PERIODS[literaryPeriod]?.[2] || [];
    periodTerms.forEach(term => {
      queries.push(`${term} music`);
    });
  }
  
  // Add descriptive query based on book description
  if (description) {
    const words = description
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 7);
    
    if (words.length > 0) {
      queries.push(words.join(" "));
    }
  }
  
  // Special case for classic literature
  if (genre === "classic" || genre === "literary") {
    queries.push("classical music");
    queries.push("orchestral");
    queries.push(`${author} era music`);
  }
  
  return queries.filter(q => q.trim().length > 0);
}

// Search tracks with our enhanced queries
async function searchTracksWithQueries(queries: string[], accessToken?: string) {
  if (!accessToken) {
    return [];
  }
  
  const trackPromises = queries.map(query => 
    searchSpotifyTracks(query, 5, accessToken)
  );
  
  const results = await Promise.all(trackPromises);
  const allTracks = results.flat();
  
  // Deduplicate tracks by URI
  const uniqueTracks = Array.from(
    new Map(allTracks.map(track => [track.uri, track]))
  ).map(([_, track]) => track);
  
  // Filter to ensure we only get actual songs (not podcasts, audiobooks, etc.)
  const filteredTracks = uniqueTracks.filter(track => {
    // Basic null check
    if (!track) return false;
    
    // Must be a track type (not episode, audiobook, etc)
    if (track.type !== "track") return false;
    
    // Skip tracks without proper artist info
    if (!track.artists || !track.artists.length) return false;
    
    // Skip tracks without proper album info
    if (!track.album || !track.album.name) return false;
    
    // Skip if the URI doesn't start with spotify:track:
    if (!track.uri || !track.uri.startsWith('spotify:track:')) return false;
    
    // Skip tracks that might be podcast episodes (optional)
    const lowerName = track.name.toLowerCase();
    if (
      lowerName.includes('podcast') || 
      lowerName.includes('episode') || 
      lowerName.includes('interview') ||
      track.album.name.toLowerCase().includes('podcast')
    ) {
      return false;
    }
    
    return true;
  });
  
  // Shuffle tracks
  return filteredTracks.sort(() => Math.random() - 0.5);
}

// Enhance track selection using AI-recommended audio features
async function enhanceTrackSelectionWithAIFeatures(
  tracks: any[],
  targetFeatures: any,
  accessToken: string
): Promise<any[]> {
  if (!accessToken || tracks.length === 0) {
    return tracks;
  }
  
  try {
    // Get audio features for all tracks
    const trackIds = tracks.map(track => track.id);
    const audioFeatures = await getAudioFeatures(trackIds, accessToken);
    
    if (!audioFeatures || audioFeatures.length === 0) {
      return tracks;
    }
    
    // Create a map of track ID to audio features
    const featuresMap = new Map();
    audioFeatures.forEach(feature => {
      if (feature && feature.id) {
        featuresMap.set(feature.id, feature);
      }
    });
    
    // Score each track based on how well it matches the AI-suggested targets
    const scoredTracks = tracks.map(track => {
      const features = featuresMap.get(track.id);
      let score = 0;
      
      if (features) {
        // Calculate score based on closeness to target values
        if (targetFeatures.valence !== undefined) {
          score += 10 - Math.abs(features.valence - targetFeatures.valence) * 10;
        }
        
        if (targetFeatures.energy !== undefined) {
          score += 10 - Math.abs(features.energy - targetFeatures.energy) * 10;
        }
        
        if (targetFeatures.danceability !== undefined) {
          score += 10 - Math.abs(features.danceability - targetFeatures.danceability) * 10;
        }
        
        // Add bonus for exact matches of AI-recommended songs
        if (track.name && track.artists && track.artists.length > 0) {
          const trackNameArtist = `${track.name} ${track.artists[0].name}`.toLowerCase();
          
          // Check if this is one of the AI-recommended songs
          const isRecommended = aiRecommendations?.songRecommendations?.some(rec => {
            if (!rec || !rec.title || !rec.artist) return false;
            const recString = `${rec.title} ${rec.artist}`.toLowerCase();
            return trackNameArtist.includes(recString) || recString.includes(trackNameArtist);
          }) || false;
          
          if (isRecommended) {
            score += 20; // Big bonus for AI-recommended songs
          }
        }
      }
      
      return { track, score };
    });
    
    // Sort by score (descending) and return tracks
    return scoredTracks
      .sort((a, b) => b.score - a.score)
      .map(item => item.track);
    
  } catch (error) {
    console.error("Error enhancing tracks with AI features:", error);
    return tracks;
  }
}

// Generate a descriptive playlist description
function generatePlaylistDescription(
  title: string,
  author: string,
  genre: string,
  literaryPeriod: string | null
): string {
  let description = `A playlist inspired by "${title}" by ${author}`;
  
  if (genre !== "default") {
    description += `, crafted to match the ${genre} genre`;
  }
  
  if (literaryPeriod) {
    description += ` from the ${literaryPeriod} literary period`;
  }
  
  description += ". Created with Bookify.";
  
  return description;
}

// Define fallback tracks to ensure we always have something to display
const FALLBACK_TRACKS = [
  {
    name: "Bohemian Rhapsody",
    artist: "Queen",
    album: "A Night at the Opera",
    image: "https://i.scdn.co/image/ab67616d0000b273c0a3f56023c52c21b6ec4d16",
    uri: "spotify:track:7tFiyTwD0nx5a1eklYtX2J"
  },
  {
    name: "Billie Jean",
    artist: "Michael Jackson",
    album: "Thriller",
    image: "https://i.scdn.co/image/ab67616d0000b2734121faee8df82c526cbab2be",
    uri: "spotify:track:5ChkMS8OtdzJeqyybCc9R5"
  },
  {
    name: "Imagine",
    artist: "John Lennon",
    album: "Imagine",
    image: "https://i.scdn.co/image/ab67616d0000b273299caa997d9e9b921b9a9a59",
    uri: "spotify:track:7pKfPomDEeI4TPT6EOYjn9"
  }
];

// Generate tracks based on search queries and genre
function generateMockTracks(searchQueries: string[], genre: string) {
  // Mock track pool with real Spotify track IDs
  const mockTrackPool = [
    // Romance themed tracks
    {
      name: "Can't Help Falling in Love",
      artist: "Elvis Presley",
      album: "Blue Hawaii",
      image: "https://i.scdn.co/image/ab67616d0000b273f947f3521c3a2f64747b0d12",
      uri: "spotify:track:44AyOl4qVkzS48vBsbNXaC"
    },
    {
      name: "At Last",
      artist: "Etta James",
      album: "At Last!",
      image: "https://i.scdn.co/image/ab67616d0000b273053c9b7e40c66d2505b8e398",
      uri: "spotify:track:5PeMCRKI0wGPCsrcDZLof1"
    },
    
    // Mystery/Thriller tracks
    {
      name: "Thriller",
      artist: "Michael Jackson",
      album: "Thriller",
      image: "https://i.scdn.co/image/ab67616d0000b2734121faee8df82c526cbab2be",
      uri: "spotify:track:7azo4rpSUh8nXgtonC6Pkq"
    },
    {
      name: "Bad Guy",
      artist: "Billie Eilish",
      album: "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
      image: "https://i.scdn.co/image/ab67616d0000b273d55326e912165c6f4e42aa8e",
      uri: "spotify:track:2Fxmhks0bxGSBdJ92vM42m"
    },
    
    // Fantasy/Adventure tracks
    {
      name: "Immigrant Song",
      artist: "Led Zeppelin",
      album: "Led Zeppelin III",
      image: "https://i.scdn.co/image/ab67616d0000b273a1995d8c79c87d6e889ef2a3",
      uri: "spotify:track:78lgmZwycJ3nzsdgmPPGNx"
    },
    {
      name: "The Dragonborn Comes",
      artist: "Malukah",
      album: "Skyrim",
      image: "https://i.scdn.co/image/ab67616d0000b27336c5417732e53e23cb219246",
      uri: "spotify:track:6uUg2PAAcJBlKhZxC5NeKn"
    },
    
    // Sci-Fi tracks
    {
      name: "Starman",
      artist: "David Bowie",
      album: "The Rise and Fall of Ziggy Stardust",
      image: "https://i.scdn.co/image/ab67616d0000b2730ca902776ffe78a3f92adc61",
      uri: "spotify:track:0pQskrTITgmCMyr85tb9qq"
    },
    {
      name: "Space Oddity",
      artist: "David Bowie",
      album: "Space Oddity",
      image: "https://i.scdn.co/image/ab67616d0000b2731e173bb4e0f8ef205d51a987",
      uri: "spotify:track:72Z17vmmeQKAg8bptWvpVG"
    },
    
    // Historical tracks
    {
      name: "The Times They Are A-Changin'",
      artist: "Bob Dylan",
      album: "The Times They Are A-Changin'",
      image: "https://i.scdn.co/image/ab67616d0000b273e8dd3c6b63d23c905e71d196",
      uri: "spotify:track:52vA3CYKZqZVdQnzRrdZt6"
    },
    {
      name: "Ohio",
      artist: "Crosby, Stills, Nash & Young",
      album: "4 Way Street",
      image: "https://i.scdn.co/image/ab67616d0000b273e40f9b671dda4f6ef8f83d80", 
      uri: "spotify:track:2sSGN41nD0wHF9PmYhes7z"
    },
    
    // Children's tracks
    {
      name: "How Far I'll Go",
      artist: "Auli'i Cravalho",
      album: "Moana",
      image: "https://i.scdn.co/image/ab67616d0000b2738ead30d906aca7bd5447ca2c",
      uri: "spotify:track:5hYTyyh2odQKphUbMqc5gN"
    },
    {
      name: "Let It Go",
      artist: "Idina Menzel",
      album: "Frozen",
      image: "https://i.scdn.co/image/ab67616d0000b2735b8397363f8f0f4041ae1ea0",
      uri: "spotify:track:0qcr5FMsEO85NAQjrlDRKo"
    },
    
    // General/Classic tracks
    {
      name: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      image: "https://i.scdn.co/image/ab67616d0000b273c0a3f56023c52c21b6ec4d16", 
      uri: "spotify:track:7tFiyTwD0nx5a1eklYtX2J"
    },
    {
      name: "Smells Like Teen Spirit",
      artist: "Nirvana",
      album: "Nevermind",
      image: "https://i.scdn.co/image/ab67616d0000b27336adad5054e9302b364a05b4",
      uri: "spotify:track:5ghIJDpPoe3CfHMGu71E6T"
    }
  ];

  // Select genre-appropriate tracks based on book genre
  const genreSpecificTracks = [];
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
  const selectedTracks = [...genreSpecificTracks];
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
  
  return selectedTracks.length > 0 ? selectedTracks : FALLBACK_TRACKS;
}

// Add these new functions for calculating reading time and matching durations

// Calculate estimated reading time based on page count
function calculateReadingTime(pageCount: number): number {
  if (!pageCount || pageCount <= 0) {
    // Default to a 30-minute playlist for unknown book length
    return 30 * 60 * 1000; 
  }
  
  // Calculate estimated words in the book
  const totalWords = pageCount * AVG_WORDS_PER_PAGE;
  
  // Calculate reading time in milliseconds
  let readingTimeMs = (totalWords / AVG_READING_SPEED_WPM) * 60 * 1000;
  
  // Apply limits to keep playlist length reasonable
  readingTimeMs = Math.max(MIN_PLAYLIST_DURATION_MS, readingTimeMs);
  readingTimeMs = Math.min(MAX_PLAYLIST_DURATION_MS, readingTimeMs);
  
  return readingTimeMs;
}

// Match the playlist duration to the estimated reading time
async function matchPlaylistDurationToReadingTime(
  tracks: any[],
  targetDurationMs: number,
  accessToken?: string
): Promise<any[]> {
  if (!accessToken || tracks.length === 0) {
    return tracks.slice(0, 20); // Default behavior without token
  }
  
  try {
    // Get track durations
    const trackIds = tracks.map(track => track.id);
    const audioFeatures = await getAudioFeatures(trackIds, accessToken);
    
    // Get full track details for duration
    const tracksWithDuration = await getTracksDetails(trackIds, accessToken);
    
    // Create a map of track ID to duration
    const durationMap = new Map();
    tracksWithDuration.forEach(track => {
      if (track && track.id && track.duration_ms) {
        durationMap.set(track.id, track.duration_ms);
      }
    });
    
    // Sort tracks by score (from audio features) if available
    const sortedTracks = [...tracks].sort((a, b) => {
      const scoreA = (a.score !== undefined) ? a.score : 0;
      const scoreB = (b.score !== undefined) ? b.score : 0;
      return scoreB - scoreA; // Higher scores first
    });
    
    // Select tracks until we reach the target duration
    const selectedTracks = [];
    let currentDuration = 0;
    
    for (const track of sortedTracks) {
      const trackDuration = durationMap.get(track.id) || 0;
      
      // Always include at least 5 tracks regardless of duration
      if (selectedTracks.length < 5 || currentDuration < targetDurationMs) {
        selectedTracks.push(track);
        currentDuration += trackDuration;
      } else {
        break;
      }
      
      // Cap at 50 tracks max for reasonable playlist size
      if (selectedTracks.length >= 50) {
        break;
      }
    }
    
    console.log(`Target duration: ${Math.round(targetDurationMs/60000)} minutes, actual: ${Math.round(currentDuration/60000)} minutes`);
    return selectedTracks;
    
  } catch (error) {
    console.error("Error matching playlist duration:", error);
    return tracks.slice(0, 20); // Fallback
  }
} 