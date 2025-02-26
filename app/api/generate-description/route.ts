import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { title, author, genre, additionalInfo } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "Book title is required" },
        { status: 400 }
      );
    }

    // In a real application, you would call an AI service here
    // For now, we'll generate a simple description
    const description = generateBookDescription(title, author, genre, additionalInfo);

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Error generating description:", error);
    return NextResponse.json(
      { error: "Failed to generate book description" },
      { status: 500 }
    );
  }
}

function generateBookDescription(
  title: string,
  author?: string,
  genre?: string,
  additionalInfo?: string
): string {
  // This is a placeholder. In a real app, you would use an AI service
  // like OpenAI's API to generate a more sophisticated description
  
  const authorText = author ? ` by ${author}` : "";
  const genreText = genre ? ` in the ${genre} genre` : "";
  
  return `"${title}"${authorText} is a captivating work${genreText} that takes readers on an unforgettable journey. 
  
The story unfolds with rich character development and immersive world-building that keeps readers engaged from the first page to the last. The narrative explores themes of identity, connection, and transformation.

${additionalInfo ? `Additional context: ${additionalInfo}` : ""}

This book is perfect for readers who enjoy thoughtful storytelling with emotional depth and memorable characters.`;
} 