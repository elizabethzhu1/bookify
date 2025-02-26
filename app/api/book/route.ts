import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")

  if (!query) {
    return NextResponse.json({ error: "Search query is required" }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  if (!apiKey) {
    console.error("Google Books API key is missing")
    return NextResponse.json({ error: "API key configuration error" }, { status: 500 })
  }

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`
    console.log("Fetching from URL:", url) // Log the URL (remove in production)

    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      console.error("Google Books API error:", data)
      return NextResponse.json({ error: "Failed to fetch book information" }, { status: response.status })
    }

    if (data.items && data.items.length > 0) {
      const books = data.items.map((item: any) => ({
        id: item.id,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : "Unknown",
        description: item.volumeInfo.description || "",
        categories: item.volumeInfo.categories || [],
        thumbnail: item.volumeInfo.imageLinks?.thumbnail || "",
      }))
      return NextResponse.json(books)
    } else {
      console.log("No books found for query:", query)
      return NextResponse.json([])
    }
  } catch (error) {
    console.error("Error fetching book information:", error)
    return NextResponse.json({ error: "Failed to fetch book information" }, { status: 500 })
  }
}

