import { NextResponse } from "next/server";
import { generateRandomString } from "@/utils/spotify";

export async function GET() {
  try {
    // Get client ID from environment variables
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    
    if (!clientId) {
      throw new Error("Spotify client ID not configured");
    }
    
    // Always use the production redirect URI
    const redirectUri = "https://bookify-v1.vercel.app/callback";
    
    // Generate a random state value for security
    const state = generateRandomString(16);
    
    // Generate a code verifier and challenge for PKCE
    const codeVerifier = generateRandomString(64);
    
    // Store the code verifier in a cookie for later use
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    };
    
    // Define the scopes we need
    const scope = "user-read-private user-read-email playlist-modify-public playlist-modify-private user-top-read";
    
    // Construct the authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: scope,
      redirect_uri: redirectUri,
      state: state,
      code_challenge_method: "S256",
      code_challenge: codeVerifier, // Simplified for this example
    });
    
    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    
    // Set cookies and return the auth URL
    const response = NextResponse.json({ authUrl });
    response.cookies.set("spotify_auth_state", state, cookieOptions);
    response.cookies.set("spotify_code_verifier", codeVerifier, cookieOptions);
    
    return response;
  } catch (error) {
    console.error("Error generating auth URL:", error);
    return NextResponse.json(
      { error: "Failed to generate Spotify authorization URL" },
      { status: 500 }
    );
  }
} 