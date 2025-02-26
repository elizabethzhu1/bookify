"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import SpotifyAuth from "@/components/SpotifyAuth"
import { Loader2, Search } from "lucide-react"
import Image from "next/image"

interface BookSuggestion {
  id: string
  title: string
  author: string
  description: string
  genre: string
  thumbnail: string
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
  const [playlistId, setPlaylistId] = useState("")
  const [bookRecommendations, setBookRecommendations] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if user is authenticated with Spotify
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/check-auth")
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
      if (query.length < 3) {
        setSuggestions([])
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
          setIsDropdownOpen(true)
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
  }, [query])

  const handleSelectBook = (book: BookSuggestion) => {
    setSelectedBook(book)
    setQuery(book.title)
    setIsDropdownOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    if (selectedBook && newQuery !== selectedBook.title) {
      setSelectedBook(null)
    }
    setIsDropdownOpen(newQuery.length >= 3)
  }

  const handleGenerate = async () => {
    if (!selectedBook) {
      setError("Please select a book first")
      return
    }

    try {
      setError("")
      setIsGenerating(true)
      setBookRecommendations([])
      setPlaylistId("")
      
      // Generate the book description
      const descriptionResponse = await fetch("/api/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: selectedBook.title,
          author: selectedBook.author,
          genre: selectedBook.genre,
          additionalInfo: selectedBook.description,
        }),
      })

      if (!descriptionResponse.ok) {
        throw new Error("Failed to generate book description")
      }

      const descriptionData = await descriptionResponse.json()
      setBookDescription(descriptionData.description)

      // If authenticated with Spotify, create a playlist
      if (isAuthenticated) {
        try {
          const playlistResponse = await fetch("/api/create-playlist", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              bookTitle: selectedBook.title,
              bookAuthor: selectedBook.author,
              bookGenre: selectedBook.genre,
              bookDescription: descriptionData.description,
            }),
          })

          if (playlistResponse.ok) {
            const playlistData = await playlistResponse.json()
            setPlaylistId(playlistData.playlistId)
          } else {
            // If playlist creation fails, fall back to book recommendations
            await generateBookRecommendations()
          }
        } catch (playlistError) {
          console.error("Playlist creation error:", playlistError)
          // Fall back to book recommendations
          await generateBookRecommendations()
        }
      } else {
        // Not authenticated, generate book recommendations
        await generateBookRecommendations()
      }
    } catch (err) {
      console.error("Generation error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsGenerating(false)
    }
  }

  const generateBookRecommendations = async () => {
    try {
      const recommendationsResponse = await fetch("/api/book-recommendations", {
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

      if (recommendationsResponse.ok) {
        const data = await recommendationsResponse.json()
        setBookRecommendations(data.recommendations)
      } else {
        // Fallback to static recommendations if API fails
        setBookRecommendations(getStaticRecommendations(selectedBook?.genre))
      }
    } catch (error) {
      console.error("Error generating recommendations:", error)
      // Fallback to static recommendations
      setBookRecommendations(getStaticRecommendations(selectedBook?.genre))
    }
  }

  // Fallback static recommendations based on genre
  const getStaticRecommendations = (genre?: string) => {
    const lowerGenre = genre?.toLowerCase() || ""
    
    if (lowerGenre.includes("fantasy")) {
      return [
        "The Name of the Wind by Patrick Rothfuss",
        "A Game of Thrones by George R.R. Martin",
        "The Way of Kings by Brandon Sanderson",
        "The Fifth Season by N.K. Jemisin",
        "Mistborn by Brandon Sanderson"
      ]
    } else if (lowerGenre.includes("sci-fi") || lowerGenre.includes("science fiction")) {
      return [
        "Dune by Frank Herbert",
        "The Three-Body Problem by Liu Cixin",
        "Project Hail Mary by Andy Weir",
        "Neuromancer by William Gibson",
        "The Left Hand of Darkness by Ursula K. Le Guin"
      ]
    } else if (lowerGenre.includes("mystery") || lowerGenre.includes("thriller")) {
      return [
        "Gone Girl by Gillian Flynn",
        "The Silent Patient by Alex Michaelides",
        "The Girl with the Dragon Tattoo by Stieg Larsson",
        "And Then There Were None by Agatha Christie",
        "The Thursday Murder Club by Richard Osman"
      ]
    } else if (lowerGenre.includes("romance")) {
      return [
        "Pride and Prejudice by Jane Austen",
        "The Hating Game by Sally Thorne",
        "Red, White & Royal Blue by Casey McQuiston",
        "Beach Read by Emily Henry",
        "The Kiss Quotient by Helen Hoang"
      ]
    } else {
      return [
        "The Midnight Library by Matt Haig",
        "Where the Crawdads Sing by Delia Owens",
        "The Seven Husbands of Evelyn Hugo by Taylor Jenkins Reid",
        "Educated by Tara Westover",
        "Circe by Madeline Miller"
      ]
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-6xl mx-auto p-4">
      {/* Left column - Book search */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Find a Book</h2>
        
        {/* Book Search Bar */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center space-x-2">
            <div className="relative flex-grow">
              <Input
                type="text"
                value={query}
                onChange={handleInputChange}
                placeholder="Search for a book..."
                className="w-full bg-white text-black placeholder-gray-400 border-gray-300 focus:border-[#1DB954] transition-colors duration-200 pl-10"
                ref={inputRef}
              />
              {selectedBook && selectedBook.thumbnail && (
                <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                  <img
                    src={selectedBook.thumbnail}
                    alt={selectedBook.title}
                    width={24}
                    height={36}
                    className="rounded-sm"
                  />
                </div>
              )}
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
          
          {/* Search Results Dropdown */}
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
          
          {isDropdownOpen && suggestions.length === 0 && query.length >= 3 && !isSearching && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-4 text-center">
              <p className="text-gray-600 dark:text-gray-300">No books found. Try a different search.</p>
            </div>
          )}
        </div>
        
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <div className="mt-4">
          <SpotifyAuth />
        </div>
      </div>
      
      {/* Right column - Generated content */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Generated Content</h2>
        
        {/* Book description card */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-2">Book Description</h3>
          {isGenerating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : bookDescription ? (
            <div className="prose max-w-none">
              {bookDescription.split('\n').map((paragraph, i) => (
                <p key={i} className="mb-4">{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">
              Your generated book description will appear here.
            </p>
          )}
        </Card>
        
        {/* Spotify playlist or book recommendations */}
        <Card className="p-4">
          {isAuthenticated && playlistId ? (
            <>
              <h3 className="text-lg font-semibold mb-2">Book Playlist</h3>
              <div className="aspect-video">
                <iframe
                  src={`https://open.spotify.com/embed/playlist/${playlistId}`}
                  width="100%"
                  height="380"
                  frameBorder="0"
                  allowTransparency={true}
                  allow="encrypted-media"
                  className="rounded-md"
                ></iframe>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold mb-2">Book Recommendations</h3>
              {isGenerating ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : bookRecommendations.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2">
                  {bookRecommendations.map((book, index) => (
                    <li key={index} className="text-gray-800 dark:text-gray-200">
                      {book}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-500 italic">
                  {isAuthenticated ? (
                    "Connect with Spotify and click Generate to create a custom playlist for your book."
                  ) : (
                    "Click Generate to see book recommendations based on your selection."
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

