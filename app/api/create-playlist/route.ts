import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { searchSpotifyTracks, createSpotifyPlaylist } from "@/utils/spotify";

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
    const searchQueries = [
      `${bookTitle} ${bookAuthor || ""}`,
      bookGenre || "",
      ...bookDescription?.split(/\s+/).slice(0, 10) || []
    ].filter(query => query.trim().length > 0);
    
    console.log("Search queries:", searchQueries);
    
    // Generate tracks using mock data (for all users)
    const mockTracks = generateMockTracks(searchQueries, bookGenre || "");
    console.log(`Generated ${mockTracks.length} tracks`);
    
    if (isAuthenticated) {
      // Authenticated user flow - create actual Spotify playlist from the same tracks
      console.log("Creating Spotify playlist for authenticated user");
      
      try {
        // Create a playlist with the mock tracks
        const playlistName = `Bookify: ${bookTitle}`;
        const playlist = await createSpotifyPlaylist(
          playlistName,
          `A playlist inspired by "${bookTitle}" ${bookAuthor ? `by ${bookAuthor}` : ""}`,
          mockTracks.map((track) => track.uri),
          accessToken
        );

        console.log("Playlist created:", playlist.id);

        // Format the response - using the exact same mock tracks for consistency
        const formattedPlaylist = {
          playlistId: playlist.id,
          name: playlistName,
          external_url: playlist.external_urls.spotify,
          uri: playlist.uri,
          tracks: mockTracks
        };

        return NextResponse.json(formattedPlaylist);
      } catch (error: any) {
        console.error("Error creating Spotify playlist:", error);
        // Fall back to non-authenticated flow if playlist creation fails
        console.log("Falling back to non-authenticated flow");
      }
    }
    
    // Non-authenticated user flow (or fallback if authenticated creation failed)
    console.log("Returning tracks for display only");
    
    // Format the response to match the playlist data structure
    const playlistData = {
      playlistId: null,
      name: `Bookify: ${bookTitle}`,
      external_url: "https://open.spotify.com/",
      uri: null,
      tracks: mockTracks
    };
    
    console.log(`Returning playlist with ${playlistData.tracks.length} tracks`);
    return NextResponse.json(playlistData);
    
  } catch (error) {
    console.error("Error generating playlist:", error);
    return NextResponse.json(
      { error: "Failed to generate playlist" },
      { status: 500 }
    );
  }
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