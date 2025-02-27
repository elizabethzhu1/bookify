import { NextResponse } from "next/server";
import { generateRandomString } from "@/utils/spotify";

export async function GET() {
  try {
    // Get client ID from environment variables
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    
    if (!clientId) {
      throw new Error("Spotify client ID not configured");
    }
    
    // Configure the redirect URI
    const redirectUri = process.env.NODE_ENV === "production" 
      ? "https://bookify-v1.vercel.app/callback"
      : "http://localhost:3000/callback";
    
    // Generate a random state value for security (make it longer)
    const state = generateRandomString(32);
    
    // Define the scopes we need
    const scope = "user-read-private user-read-email playlist-modify-public playlist-modify-private user-top-read";
    
    // Construct the authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: scope,
      redirect_uri: redirectUri,
      state: state,
      show_dialog: "true"
    });
    
    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    
    // Set state cookie for verification with improved settings
    const response = NextResponse.json({ authUrl });
    response.cookies.set("spotify_auth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15, // 15 minutes (increased from 10)
    });
    
    return response;
  } catch (error) {
    console.error("Error generating auth URL:", error);
    return NextResponse.json(
      { error: "Failed to generate Spotify authorization URL" },
      { status: 500 }
    );
  }
} 