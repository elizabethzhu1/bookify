import { OpenAI } from 'openai';

// Define interfaces for OpenAI responses
interface SongRecommendation {
  title: string;
  artist: string;
  reason: string;
}

interface AudioFeatureTargets {
  valence: number;       // 0.0 to 1.0 (sad to happy)
  energy: number;        // 0.0 to 1.0 (slow/quiet to fast/loud)
  danceability: number;  // 0.0 to 1.0 (least to most danceable)
  acousticness?: number; // 0.0 to 1.0 (electronic to acoustic)
  instrumentalness?: number; // 0.0 to 1.0 (vocal to instrumental)
  tempo?: number;        // BPM
}

interface BookPlaylistRecommendation {
  songRecommendations: SongRecommendation[];
  audioFeatureTargets: AudioFeatureTargets;
  themes: string[];
  moodDescription: string;
}

export async function generateBookPlaylistRecommendations(
  title: string,
  author: string,
  genre: string,
  description: string,
  year?: string
): Promise<BookPlaylistRecommendation> {
  // Create OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Build the prompt
  const prompt = `
  You are an expert music curator who specializes in creating playlists that match the mood, themes, and style of books. 
  
  For the following book, please recommend 10-15 specific songs that would make an excellent accompanying playlist, and suggest target audio feature values (from 0.0 to 1.0) that would best match the book's mood:
  
  Book Title: ${title}
  Author: ${author}
  Genre: ${genre}
  ${year ? `Published: ${year}` : ''}
  Description: ${description}
  
  Please format your response as a JSON object with:
  1. A "songRecommendations" array containing objects with "title", "artist", and "reason" fields
  2. An "audioFeatureTargets" object with "valence", "energy", "danceability" values between 0.0 and 1.0
  3. A "themes" array with key themes from the book that informed your song selections
  4. A "moodDescription" string that captures the overall mood you're aiming for
  `;

  try {
    // Send request to OpenAI with explicit response format
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using 3.5-turbo which may be more reliable for JSON formatting
      messages: [
        {
          role: "system",
          content: "You are a music curator who provides song recommendations and audio feature targets in valid JSON format. Always use double quotes for all keys and string values. Use numbers without quotes for numeric values."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5, // Lower temperature for more consistent formatting
    });

    // Get the content from the response
    const content = response.choices[0]?.message?.content || "";
    
    // Handle potential formatting issues
    try {
      return JSON.parse(content) as BookPlaylistRecommendation;
    } catch (parseError) {
      console.error("Error parsing OpenAI response as JSON:", parseError);
      console.log("Raw response:", content);
      
      // Return fallback values if parsing fails
      return {
        songRecommendations: [],
        audioFeatureTargets: {
          valence: 0.5,
          energy: 0.5,
          danceability: 0.5,
        },
        themes: [],
        moodDescription: "Balanced and neutral"
      };
    }
  } catch (error) {
    console.error("Error generating playlist recommendations with OpenAI:", error);
    
    // Return fallback values if OpenAI call fails
    return {
      songRecommendations: [],
      audioFeatureTargets: {
        valence: 0.5,
        energy: 0.5,
        danceability: 0.5,
      },
      themes: [],
      moodDescription: "Balanced and neutral"
    };
  }
} 