"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppContext } from "@/context/AppContext"
import Image from "next/image"

interface BookSuggestion {
  id: string
  title: string
  author: string
  description: string
  categories: string[]
  thumbnail: string
}

export default function BookForm() {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([])
  const [selectedBook, setSelectedBook] = useState<BookSuggestion | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const { setBookInfo, setPlaylistInfo } = useAppContext()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 3) {
        setSuggestions([])
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/book?query=${encodeURIComponent(query)}`)
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`)
        }
        const data = await response.json()
        setSuggestions(data)
      } catch (error: any) {
        console.error("Error fetching suggestions:", error)
        setError("Failed to fetch book suggestions. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    const debounce = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(debounce)
  }, [query])

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

  const handleSelectBook = (book: BookSuggestion) => {
    setSelectedBook(book)
    setQuery(book.title)
    setIsDropdownOpen(false)
  }

  const handleGeneratePlaylist = async () => {
    if (!selectedBook) return

    setError(null)
    setIsLoading(true)
    setIsDropdownOpen(false)

    try {
      const playlistResponse = await fetch("/api/playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selectedBook),
      })
      const playlistData = await playlistResponse.json()

      if (!playlistResponse.ok) {
        throw new Error(playlistData.error || "Failed to generate playlist")
      }

      setBookInfo(selectedBook)
      setPlaylistInfo(playlistData)
    } catch (error: any) {
      console.error("Error generating playlist:", error)
      setError(error.message || "Failed to generate playlist. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    if (selectedBook && newQuery !== selectedBook.title) {
      setSelectedBook(null)
    }
    setIsDropdownOpen(newQuery.length >= 3)
  }

  return (
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
            <Image
              src={selectedBook.thumbnail || "/placeholder.svg"}
              alt={selectedBook.title}
              width={24}
              height={36}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 rounded-sm"
            />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className="bg-green-400 hover:bg-green-500 text-white border-none transition-colors duration-200"
          onClick={handleGeneratePlaylist}
          disabled={!selectedBook || isLoading}
        >
          {isLoading ? "Generating..." : "Generate"}
        </Button>
      </div>
      {isLoading && <p className="mt-2 text-[#B3B3B3]">Loading...</p>}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {isDropdownOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-[#282828] border border-[#404040] rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((book) => (
            <li
              key={book.id}
              className="flex items-center p-2 hover:bg-[#404040] cursor-pointer transition-colors duration-200"
              onClick={() => handleSelectBook(book)}
            >
              {book.thumbnail && (
                <Image
                  src={book.thumbnail || "/placeholder.svg"}
                  alt={book.title}
                  width={40}
                  height={60}
                  className="mr-2 rounded-sm shadow-sm"
                />
              )}
              <div>
                <p className="font-semibold text-white">{book.title}</p>
                <p className="text-sm text-[#B3B3B3]">{book.author}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!isLoading && !error && suggestions.length === 0 && query.length >= 3 && (
        <p className="mt-2 text-sm text-[#B3B3B3]">No books found. Try a different search.</p>
      )}
    </div>
  )
}

