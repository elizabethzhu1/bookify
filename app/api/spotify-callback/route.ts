import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export async function POST(request: NextRequest) {
  try {
    const { code, codeVerifier, redirectUri } = await request.json();

    if (!code || !codeVerifier) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log("Attempting token exchange with:", {
      code: code.substring(0, 5) + "...", // Log only part of the code for security
      codeVerifierLength: codeVerifier.length,
      redirectUri
    });

    // Exchange the authorization code for access and refresh tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        client_id: CLIENT_ID!,
      }),
    });

    const responseText = await tokenResponse.text();
    let tokenData;
    
    try {
      tokenData = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse token response:", responseText);
      return NextResponse.json(
        { error: 'Invalid response from Spotify', rawResponse: responseText },
        { status: 500 }
      );
    }

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      return NextResponse.json(
        { error: 'Failed to exchange code for tokens', details: tokenData },
        { status: tokenResponse.status }
      );
    }
    
    // Store tokens securely in HTTP-only cookies
    const cookieStore = cookies();
    
    // Set access token with short expiry
    cookieStore.set('spotify_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/',
    });
    
    // Set refresh token with longer expiry
    cookieStore.set('spotify_refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    // Fetch user profile to confirm authentication
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const userError = await userResponse.json();
      console.error('User profile fetch error:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: userError },
        { status: userResponse.status }
      );
    }

    const userData = await userResponse.json();
    
    // Store basic user info in a cookie that can be read by the client
    cookieStore.set('spotify_user', JSON.stringify({
      id: userData.id,
      display_name: userData.display_name,
      email: userData.email,
      images: userData.images,
    }), {
      httpOnly: false, // Client-readable
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in Spotify callback:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

