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
  2. An "audioFeatureTargets" object with "valence", "energy", "danceability", "acousticness", "instrumentalness", and "tempo" values
  3. A "themes" array with key themes from the book that informed your song selections
  4. A "moodDescription" string that captures the overall mood you're aiming for
  
  For example:
  {
    "songRecommendations": [
      {
        "title": "Song Title",
        "artist": "Artist Name",
        "reason": "Brief explanation of why this song fits"
      }
    ],
    "audioFeatureTargets": {
      "valence": 0.7,
      "energy": 0.6,
      "danceability": 0.5,
      "acousticness": 0.4,
      "instrumentalness": 0.2,
      "tempo": 120
    },
    "themes": ["love", "war", "redemption"],
    "moodDescription": "Uplifting yet reflective"
  }
  `;

  try {
    // Send request to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo", // or gpt-3.5-turbo if preferred
      messages: [
        {
          role: "system",
          content: "You are a music curator who provides song recommendations and audio feature targets in JSON format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Parse the JSON response
    const content = response.choices[0]?.message?.content || "";
    return JSON.parse(content) as BookPlaylistRecommendation;
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
      moodDescription: ""
    };
  }
} 