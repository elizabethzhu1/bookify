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
  pageCount?: number
  publishedDate?: string
}

interface Track {
  name: string
  artist: string
  album: string
  image?: string
  uri: string
}

interface PlaylistData {
  playlistId: string | null
  name: string
  external_url: string | null
  uri: string | null
  tracks: Track[]
  verified: boolean
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

  // Update the state management section at the top of the component
  const [isDescriptionLoading, setIsDescriptionLoading] = useState(false)
  const [isPlaylistLoading, setIsPlaylistLoading] = useState(false)

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
            thumbnail: item.volumeInfo.imageLinks?.thumbnail || "",
            pageCount: item.volumeInfo.pageCount,
            publishedDate: item.volumeInfo.publishedDate
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
    setBookRecommendations([]);
    setPlaylistData(null);
    
    if (!selectedBook) {
      setError("Please select a book first");
      return;
    }

    // Immediately set the book description - no waiting
    setBookDescription(selectedBook.description || "No description available for this book.");

    // Start playlist generation
    setIsPlaylistLoading(true);
    
    try {
      // Create the playlist
      console.log("Creating playlist for:", selectedBook.title);
      const playlistResponse = await fetch(`${getBaseUrl()}/api/create-playlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookTitle: selectedBook.title,
          bookAuthor: selectedBook.author,
          bookGenre: selectedBook.genre,
          bookDescription: selectedBook.description,
          pageCount: selectedBook.pageCount || 0,
          bookYear: selectedBook.publishedDate
        }),
      });
      
      if (!playlistResponse.ok) {
        throw new Error(`Failed to create playlist: ${playlistResponse.status}`);
      }
      
      const responseData = await playlistResponse.json();
      console.log("Playlist API response:", responseData);
      
      // If authenticated and we have a playlist ID, verify the playlist with a delay
      if (isAuthenticated && responseData.playlistId) {
        // Add a short delay to allow Spotify to process the playlist
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now verify the playlist exists by trying to fetch it
        console.log("Verifying playlist with ID:", responseData.playlistId);
        try {
          const verifyResponse = await fetch(`${getBaseUrl()}/api/verify-playlist?id=${responseData.playlistId}`);
          const verifyData = await verifyResponse.json();
          
          if (!verifyResponse.ok || !verifyData.exists) {
            console.warn("Playlist verification failed, using fallback display");
            // Still set the playlist data but we'll handle display differently
            setPlaylistData({
              ...responseData,
              verified: false
            });
          } else {
            // Playlist verified successfully
            setPlaylistData({
              ...responseData,
              verified: true
            });
          }
        } catch (verifyError) {
          console.error("Error verifying playlist:", verifyError);
          // Still set the data, but mark as unverified
          setPlaylistData({
            ...responseData,
            verified: false
          });
        }
      } else {
        // No playlist ID or not authenticated, just use the data directly
        setPlaylistData(responseData);
      }
    } catch (error) {
      console.error("Playlist generation error:", error);
      setError("Failed to create playlist. Please try again.");
      
      // Provide fallback playlist data
      if (selectedBook) {
        setPlaylistData({
          playlistId: null,
          name: `Bookify: ${selectedBook.title}`,
          external_url: null,
          uri: null,
          tracks: [],
          verified: false
        });
      }
    } finally {
      setIsPlaylistLoading(false);
    }
  };

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
                  className="w-full bg-white text-black placeholder-gray-400 border-gray-300 focus:border-[#1DB954] transition-colors duration-200 pl-10 py-5 text-lg"
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
                  <Loader2 className="mr-2 h-5 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Playlist"
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
            {bookDescription ? (
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
            {isPlaylistLoading ? (
              // Show loading state for playlist generation
              <>
                <h3 className="text-lg font-semibold mb-2">
                  {isAuthenticated ? "Book Playlist" : "Suggested Tracks"}
                </h3>
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[#1DB954] mb-4" />
                  <p className="text-gray-600">Generating your playlist...</p>
                </div>
              </>
            ) : playlistData ? (
              // Show playlist when data is available
              <>
                <h3 className="text-lg font-semibold mb-2">
                  Book Playlist
                </h3>
                
                {isAuthenticated && playlistData.playlistId ? (
                  <div className="w-full">
                    {playlistData.verified !== false ? (
                      <div className="w-full h-[380px]">
                        <iframe
                          src={`https://open.spotify.com/embed/playlist/${playlistData.playlistId}`}
                          width="100%" 
                          height="380"
                          frameBorder="0"
                          allowFullScreen={false}
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          className="rounded-md"
                          style={{ border: 'none' }}
                          onError={(e) => {
                            console.error("Iframe loading error", e);
                          }}
                        ></iframe>
                      </div>
                    ) : (
                      <div>
                        <p className="text-amber-600 mb-3">Your playlist has been created! Open it in Spotify:</p>
                        <a 
                          href={playlistData.external_url || `https://open.spotify.com/playlist/${playlistData.playlistId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mb-4 py-2 px-4 bg-[#1DB954] text-white rounded-md hover:bg-[#1ed760] text-center"
                        >
                          Open in Spotify
                        </a>
                        
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                          {playlistData && Array.isArray(playlistData.tracks) && playlistData.tracks.length > 0 ? (
                            playlistData.tracks.map((track, index) => (
                              <div 
                                key={index} 
                                className="flex items-center space-x-3 p-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                              >
                                {track && track.image ? (
                                  <img 
                                    src={track.image} 
                                    alt={`${track.album || 'Album'} cover`}
                                    className="w-12 h-12 rounded-md object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = "https://i.scdn.co/image/ab67616d0000b2731e173bb4e0f8ef205d51a987";
                                    }}
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                    <Music className="w-6 h-6 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 dark:text-white truncate">{track?.name || 'Unknown Track'}</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{track?.artist || 'Unknown Artist'}</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{track?.album || 'Unknown Album'}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-2 text-gray-500">
                              Connect with Spotify to generate a playlist.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 italic text-center py-8">
                    Click Generate to create a playlist based on your book selection.
                  </div>
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
  );
}
