import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { title, author, genre } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "Book title is required" },
        { status: 400 }
      );
    }

    // Generate recommendations based on the book details
    // In a real app, you might use an AI service or a book recommendation API
    const recommendations = generateBookRecommendations(title, author, genre);

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error generating book recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate book recommendations" },
      { status: 500 }
    );
  }
}

function generateBookRecommendations(
  title: string,
  author?: string,
  genre?: string
): string[] {
  const lowerGenre = genre?.toLowerCase() || "";
  
  // Generate recommendations based on genre
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
      "The Midnight Library by Matt Haig",
      "Where the Crawdads Sing by Delia Owens",
      "The Seven Husbands of Evelyn Hugo by Taylor Jenkins Reid",
      "Educated by Tara Westover",
      "Circe by Madeline Miller"
    ];
  }
} 