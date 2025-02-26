"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import SpotifyAuth from "@/components/SpotifyAuth"
import { Loader2 } from "lucide-react"

export default function BookForm() {
  const [bookTitle, setBookTitle] = useState("")
  const [bookAuthor, setBookAuthor] = useState("")
  const [bookGenre, setBookGenre] = useState("")
  const [additionalInfo, setAdditionalInfo] = useState("")
  
  const [bookDescription, setBookDescription] = useState("")
  const [playlistId, setPlaylistId] = useState("")
  const [bookRecommendations, setBookRecommendations] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)

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

  const handleGenerate = async () => {
    if (!bookTitle) {
      setError("Please enter a book title")
      return
    }

    try {
      setError("")
      setIsGenerating(true)
      setBookRecommendations([])
      setPlaylistId("")
      
      // First, generate the book description
      const descriptionResponse = await fetch("/api/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: bookTitle,
          author: bookAuthor,
          genre: bookGenre,
          additionalInfo: additionalInfo,
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
              bookTitle,
              bookAuthor,
              bookGenre,
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
          title: bookTitle,
          author: bookAuthor,
          genre: bookGenre,
        }),
      })

      if (recommendationsResponse.ok) {
        const data = await recommendationsResponse.json()
        setBookRecommendations(data.recommendations)
      } else {
        // Fallback to static recommendations if API fails
        setBookRecommendations(getStaticRecommendations(bookGenre))
      }
    } catch (error) {
      console.error("Error generating recommendations:", error)
      // Fallback to static recommendations
      setBookRecommendations(getStaticRecommendations(bookGenre))
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
      {/* Left column - Book input form */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Book Details</h2>
        
        <div className="space-y-2">
          <label htmlFor="bookTitle" className="text-sm font-medium">
            Book Title <span className="text-red-500">*</span>
          </label>
          <Input
            id="bookTitle"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            placeholder="Enter book title"
            required
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="bookAuthor" className="text-sm font-medium">
            Author
          </label>
          <Input
            id="bookAuthor"
            value={bookAuthor}
            onChange={(e) => setBookAuthor(e.target.value)}
            placeholder="Enter author name"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="bookGenre" className="text-sm font-medium">
            Genre
          </label>
          <Input
            id="bookGenre"
            value={bookGenre}
            onChange={(e) => setBookGenre(e.target.value)}
            placeholder="Enter book genre"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="additionalInfo" className="text-sm font-medium">
            Additional Information
          </label>
          <Textarea
            id="additionalInfo"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="Enter any additional details about the book"
            rows={4}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !bookTitle}
            className="w-full"
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

