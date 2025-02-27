"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import SpotifyAuth from "@/components/SpotifyAuth"
import { Loader2, Search, Music } from "lucide-react"
import Image from "next/image"

interface BookSuggestion {
  id: string
  title: string
  author: string
  description: string
  genre: string
  thumbnail: string
}

interface Track {
  name: string
  artist: string
  album: string
  image?: string
  uri: string
}

interface PlaylistData {
  playlistId: string
  name: string
  external_url: string
  uri: string
  tracks: Track[]
}

export default function BookForm() {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([])
  const [selectedBook, setSelectedBook] = useState<BookSuggestion | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [error, setError] = useState("")
  
  // Generated content states
  const [bookDescription, setBookDescription] = useState("")
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null)
  const [bookRecommendations, setBookRecommendations] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get the base URL for API calls (works in both production and development)
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  // Check if user is authenticated with Spotify
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${getBaseUrl()}/api/check-auth`)
        const data = await response.json()
        setIsAuthenticated(data.isAuthenticated)
      } catch (error) {
        console.error("Error checking auth status:", error)
        setIsAuthenticated(false)
      }
    }

    checkAuth()
  }, [])

  // Handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Fetch book suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 3 || !isDropdownOpen) {
        return
      }

      setIsSearching(true)
      setError("")
      
      try {
        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`
        )
        
        if (!response.ok) {
          throw new Error("Failed to search books")
        }
        
        const data = await response.json()
        
        if (data.items) {
          const formattedSuggestions: BookSuggestion[] = data.items.map((item: any) => ({
            id: item.id,
            title: item.volumeInfo.title || "Unknown Title",
            author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : "Unknown Author",
            description: item.volumeInfo.description || "",
            genre: item.volumeInfo.categories ? item.volumeInfo.categories[0] : "",
            thumbnail: item.volumeInfo.imageLinks?.thumbnail || ""
          }))
          
          setSuggestions(formattedSuggestions)
        } else {
          setSuggestions([])
        }
      } catch (err) {
        console.error("Search error:", err)
        setError("Failed to search for books")
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(debounce)
  }, [query, isDropdownOpen])

  const handleSelectBook = (book: BookSuggestion) => {
    setSelectedBook(book)
    setQuery(book.title)
    setIsDropdownOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    
    // If user changes the text after selecting a book, clear the selection
    if (selectedBook && newQuery !== selectedBook.title) {
      setSelectedBook(null)
    }
    
    // Only open dropdown if there's enough text and user is actively typing
    if (newQuery.length >= 3) {
      setIsDropdownOpen(true)
    } else {
      setIsDropdownOpen(false)
    }
  }
  
  // Handle input focus to show dropdown
  const handleInputFocus = () => {
    // Only show dropdown if there's enough text to search
    if (query.length >= 3) {
      setIsDropdownOpen(true)
    }
  }

  const handleGenerate = async () => {
    setError("");
    setIsGenerating(true);
    setBookDescription("");
    setPlaylistData(null);
    setBookRecommendations([]);
    
    if (!selectedBook) {
      setError("Please select a book first");
      setIsGenerating(false);
      return;
    }

    try {
      // Use the book description directly from the Google Books API
      setBookDescription(selectedBook.description || "No description available for this book.");
      
      // Call the same endpoint for all users
      try {
        const playlistResponse = await fetch(`${getBaseUrl()}/api/create-playlist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookTitle: selectedBook.title,
            bookAuthor: selectedBook.author,
            bookGenre: selectedBook.genre,
            bookDescription: selectedBook.description,
          }),
        });
        
        if (playlistResponse.ok) {
          const data = await playlistResponse.json();
          // Ensure tracks is always an array even if it's missing from the API response
          const playlistData = {
            ...data,
            tracks: data.tracks || []
          };
          setPlaylistData(playlistData);
        } else {
          const errorData = await playlistResponse.json();
          throw new Error(errorData.error || "Failed to generate playlist");
        }
      } catch (error) {
        console.error("Playlist generation error:", error);
        
        // Fallback if authentication or API has issues
        setPlaylistData({
          playlistId: null,
          name: `Bookify: ${selectedBook.title}`,
          external_url: null,
          uri: null,
          tracks: [] // Always provide at least an empty array
        });
      }
      
      // Generate book recommendations regardless of authentication status
      await generateBookRecommendations();
      
    } catch (error) {
      console.error("Generation error:", error);
      setError("Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBookRecommendations = async () => {
    try {
      const recommendationsResponse = await fetch(`${getBaseUrl()}/api/book-recommendations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: selectedBook?.title,
          author: selectedBook?.author,
          genre: selectedBook?.genre,
        }),
      })

      if (!recommendationsResponse.ok) {
        throw new Error("Failed to generate book recommendations")
      }

      const recommendationsData = await recommendationsResponse.json()
      setBookRecommendations(recommendationsData.recommendations)
    } catch (error) {
      console.error("Error generating recommendations:", error)
      // Fallback to static recommendations
      setBookRecommendations(getStaticRecommendations(selectedBook?.genre || ""))
    }
  }

  const getStaticRecommendations = (genre: string): string[] => {
    const lowerGenre = genre.toLowerCase();
    
    if (lowerGenre.includes("fantasy")) {
      return [
        "The Name of the Wind by Patrick Rothfuss",
        "A Game of Thrones by George R.R. Martin",
        "The Way of Kings by Brandon Sanderson",
        "The Fifth Season by N.K. Jemisin",
        "Mistborn by Brandon Sanderson"
      ];
    } else if (lowerGenre.includes("sci-fi") || lowerGenre.includes("science fiction")) {
      return [
        "Dune by Frank Herbert",
        "The Three-Body Problem by Liu Cixin",
        "Project Hail Mary by Andy Weir",
        "Neuromancer by William Gibson",
        "The Left Hand of Darkness by Ursula K. Le Guin"
      ];
    } else if (lowerGenre.includes("mystery") || lowerGenre.includes("thriller")) {
      return [
        "Gone Girl by Gillian Flynn",
        "The Silent Patient by Alex Michaelides",
        "The Girl with the Dragon Tattoo by Stieg Larsson",
        "And Then There Were None by Agatha Christie",
        "The Thursday Murder Club by Richard Osman"
      ];
    } else if (lowerGenre.includes("romance")) {
      return [
        "Pride and Prejudice by Jane Austen",
        "The Hating Game by Sally Thorne",
        "Red, White & Royal Blue by Casey McQuiston",
        "Beach Read by Emily Henry",
        "The Kiss Quotient by Helen Hoang"
      ];
    } else {
      return [
        "The Night Circus by Erin Morgenstern",
        "The Seven Husbands of Evelyn Hugo by Taylor Jenkins Reid",
        "Where the Crawdads Sing by Delia Owens",
        "Educated by Tara Westover",
        "Circe by Madeline Miller"
      ];
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-8">
      {/* Top section - Book search (full width) */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Find a Book</h2>
        
        {/* Book Search Bar */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center space-x-2">
            <div className="relative flex-grow">
              <div className="relative">
                <Input
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  placeholder="Search for a book..."
                  className="w-full bg-white text-black placeholder-gray-400 border-gray-300 focus:border-[#1DB954] transition-colors duration-200 pl-10"
                  ref={inputRef}
                />
                {selectedBook && selectedBook.thumbnail && (
                  <img
                    src={selectedBook.thumbnail}
                    alt={selectedBook.title}
                    width={24}
                    height={36}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 rounded-sm"
                  />
                )}
              </div>
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedBook}
              className="bg-[#1DB954] hover:bg-[#1ed760] text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
          
          {/* Search Results Dropdown - Only show when dropdown is open */}
          {isDropdownOpen && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
              {suggestions.map((book) => (
                <li
                  key={book.id}
                  className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-200"
                  onClick={() => handleSelectBook(book)}
                >
                  {book.thumbnail && (
                    <img
                      src={book.thumbnail}
                      alt={book.title}
                      width={40}
                      height={60}
                      className="mr-2 rounded-sm shadow-sm"
                    />
                  )}
                  <div>
                    <p className="font-medium text-black dark:text-white">{book.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{book.author}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          
          {/* No results message - Only show when dropdown is open */}
          {isDropdownOpen && suggestions.length === 0 && query.length >= 3 && !isSearching && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-4 text-center">
              <p className="text-gray-600 dark:text-gray-300">No books found. Try a different search.</p>
            </div>
          )}
        </div>
        
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <div className="flex justify-between items-center">
          {selectedBook && (
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-300">Selected: </p>
              <p className="text-sm font-medium">{selectedBook.title} by {selectedBook.author}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom section - Generated content (full width, split into columns) */}
      {(bookDescription || bookRecommendations.length > 0 || playlistData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Book description card */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">Book Description</h3>
            {isGenerating ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : bookDescription ? (
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: bookDescription }} />
              </div>
            ) : (
              <p className="text-gray-500 italic">
                No description available for this book.
              </p>
            )}
          </Card>
          
          {/* Spotify playlist or track list */}
          <Card className="p-4">
            {playlistData ? (
              <>
                <h3 className="text-lg font-semibold mb-2">
                  {isAuthenticated ? "Book Playlist" : "Suggested Tracks"}
                </h3>
                
                {isAuthenticated && playlistData.playlistId ? (
                  // Embedded Spotify player for authenticated users
                  <div className="aspect-video">
                    <iframe
                      src={`https://open.spotify.com/embed/playlist/${playlistData.playlistId}`}
                      width="100%"
                      height="380"
                      frameBorder="0"
                      allowTransparency={true}
                      allow="encrypted-media"
                      className="rounded-md"
                    ></iframe>
                  </div>
                ) : (
                  // Track list for non-authenticated users
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2">
                    {playlistData && playlistData.tracks && playlistData.tracks.length > 0 ? (
                      playlistData.tracks.map((track, index) => (
                        <div key={index} className="flex items-center space-x-3 p-2 rounded-md bg-gray-100 dark:bg-gray-800">
                          {track.image ? (
                            <img 
                              src={track.image} 
                              alt={`${track.album} cover`}
                              className="w-12 h-12 rounded-md object-cover"
                              onError={(e) => {
                                // Fallback image if the album cover is broken
                                e.currentTarget.src = "https://i.scdn.co/image/ab67616d0000b2731e173bb4e0f8ef205d51a987";
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <Music className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">{track.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{track.artist}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{track.album}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        No tracks available for this playlist.
                      </div>
                    )}
                  </div>
                )}
                
                {!isAuthenticated && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-500 mb-2">
                      Connect with Spotify to create this playlist in your account
                    </p>
                  </div>
                )}
              </>
            ) : bookRecommendations.length > 0 ? (
              <>
                <h3 className="text-lg font-semibold mb-2">Book Recommendations</h3>
                {isGenerating ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <ul className="list-disc pl-5 space-y-2">
                    {bookRecommendations.map((book, index) => (
                      <li key={index} className="text-gray-800 dark:text-gray-200">
                        {book}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="text-gray-500 italic text-center py-8">
                Click Generate to create a playlist based on your book selection.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

