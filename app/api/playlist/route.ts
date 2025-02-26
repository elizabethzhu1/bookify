import { NextResponse } from "next/server"
import { searchSpotifyTracks, createSpotifyPlaylist } from "@/utils/spotify"

export async function POST(request: Request) {
  const bookInfo = await request.json()

  if (!bookInfo.title || !bookInfo.author) {
    return NextResponse.json({ error: "Book title and author are required" }, { status: 400 })
  }

  try {
    console.log("Generating playlist for:", bookInfo.title)
    // Generate search queries based on book information
    const searchQueries = [
      `${bookInfo.title} ${bookInfo.author}`,
      ...bookInfo.categories,
      bookInfo.description
        .split(" ")
        .slice(0, 5)
        .join(" "), // Use first 5 words of description
    ]

    console.log("Search queries:", searchQueries)

    // Search for tracks
    const trackPromises = searchQueries.map((query) => searchSpotifyTracks(query, 5))
    const trackResults = await Promise.all(trackPromises)

    // Flatten and shuffle the results, ensuring we only include songs
    const allTracks = trackResults.flat()
    const shuffledTracks = allTracks
      .filter((track) => track && track.type === "track") // Extra safety check
      .sort(() => Math.random() - 0.5)
      .slice(0, 20)

    console.log("Found tracks:", shuffledTracks.length)

    if (shuffledTracks.length === 0) {
      throw new Error("No tracks found for the given book")
    }

    // Create a playlist
    const playlistName = `Bookify: ${bookInfo.title}`
    const playlist = await createSpotifyPlaylist(
      playlistName,
      `A playlist inspired by "${bookInfo.title}" by ${bookInfo.author}`,
      shuffledTracks.map((track) => track.uri),
    )

    console.log("Playlist created:", playlist.id)

    // Format the response
    const formattedPlaylist = {
      id: playlist.id,
      name: playlistName,
      external_url: playlist.external_url,
      uri: playlist.uri,
      tracks: shuffledTracks.map((track) => ({
        name: track.name,
        artist: track.artists[0].name,
        album: track.album.name,
        image: track.album.images[0]?.url,
        uri: track.uri,
      })),
    }

    return NextResponse.json(formattedPlaylist)
  } catch (error: any) {
    console.error("Error generating playlist:", error)
    return NextResponse.json({ error: error.message || "Failed to generate playlist" }, { status: 500 })
  }
}

