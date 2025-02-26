import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ isAuthenticated: false });
  }
  
  try {
    // Verify the token is still valid by making a request to Spotify
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (response.ok) {
      return NextResponse.json({ isAuthenticated: true });
    }
    
    // If token is invalid, check if we have a refresh token
    const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
    if (refreshToken) {
      return NextResponse.json({ 
        isAuthenticated: false,
        needsRefresh: true 
      });
    }
    
    return NextResponse.json({ isAuthenticated: false });
  } catch (error) {
    console.error('Error checking authentication:', error);
    return NextResponse.json({ 
      isAuthenticated: false,
      error: 'Failed to verify authentication'
    });
  }
}

