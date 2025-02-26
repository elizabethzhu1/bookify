import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  
  // If we have no tokens at all, user is not authenticated
  if (!accessToken && !refreshToken) {
    return NextResponse.json({ isAuthenticated: false, needsRefresh: false });
  }
  
  // If we have a refresh token but no access token, we need to refresh
  if (!accessToken && refreshToken) {
    return NextResponse.json({ isAuthenticated: false, needsRefresh: true });
  }
  
  // Check if the access token is still valid by making a request to Spotify
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    // If the token is valid, the user is authenticated
    if (response.ok) {
      return NextResponse.json({ isAuthenticated: true, needsRefresh: false });
    }
    
    // If we get a 401, the token is expired and we need to refresh
    if (response.status === 401 && refreshToken) {
      return NextResponse.json({ isAuthenticated: false, needsRefresh: true });
    }
    
    // Any other error means the user is not authenticated
    return NextResponse.json({ isAuthenticated: false, needsRefresh: false });
  } catch (error) {
    console.error('Error checking authentication status:', error);
    
    // If we have a refresh token, try refreshing
    if (refreshToken) {
      return NextResponse.json({ isAuthenticated: false, needsRefresh: true });
    }
    
    return NextResponse.json({ isAuthenticated: false, needsRefresh: false });
  }
}

