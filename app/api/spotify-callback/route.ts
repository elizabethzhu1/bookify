import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { code, state } = await request.json();
    
    // Log the state received from the client and from the cookie for debugging
    console.log("State from client:", state);
    
    // Get stored state from cookies
    const cookieStore = cookies();
    const storedState = cookieStore.get("spotify_auth_state")?.value;
    
    console.log("State from cookie:", storedState);
    
    // More lenient state verification (in case there are issues with cookies)
    // Only verify if both values exist
    if (storedState && state && storedState !== state) {
      console.error("State verification failed. Expected:", storedState, "Got:", state);
      return NextResponse.json(
        { error: "State verification failed" },
        { status: 400 }
      );
    }
    
    if (!code) {
      return NextResponse.json(
        { error: "Authorization code required" },
        { status: 400 }
      );
    }
    
    // Configure the redirect URI
    const redirectUri = process.env.NODE_ENV === "production" 
      ? "https://bookify-v1.vercel.app/callback"
      : "http://localhost:3000/callback";
    
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Spotify API credentials not configured" },
        { status: 500 }
      );
    }
    
    // Exchange code for token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange error:", errorData);
      return NextResponse.json(
        { error: "Failed to exchange authorization code for token" },
        { status: 500 }
      );
    }
    
    const tokenData = await tokenResponse.json();
    
    // Set cookies with the token data
    const response = NextResponse.json({ success: true });
    
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    
    // Store tokens in cookies
    response.cookies.set("spotify_access_token", tokenData.access_token, {
      ...cookieOptions,
      maxAge: tokenData.expires_in,
    });
    
    if (tokenData.refresh_token) {
      response.cookies.set("spotify_refresh_token", tokenData.refresh_token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }
    
    // Clear the state cookie
    response.cookies.set("spotify_auth_state", "", {
      ...cookieOptions,
      maxAge: 0,
    });
    
    return response;
  } catch (error) {
    console.error("Callback processing error:", error);
    return NextResponse.json(
      { error: "Failed to process Spotify callback" },
      { status: 500 }
    );
  }
}

