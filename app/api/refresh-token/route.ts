import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  
  if (!refreshToken) {
    return NextResponse.json(
      { error: 'No refresh token available' },
      { status: 401 }
    );
  }
  
  try {
    console.log("Attempting to refresh token");
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    
    const responseText = await response.text();
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
    
    if (!response.ok) {
      // If refresh fails, clear cookies and require re-authentication
      cookieStore.delete('spotify_access_token');
      cookieStore.delete('spotify_refresh_token');
      cookieStore.delete('spotify_user');
      
      console.error('Token refresh failed:', tokenData);
      return NextResponse.json(
        { error: 'Failed to refresh token', details: tokenData },
        { status: response.status }
      );
    }
    
    console.log("Token refresh successful");
    
    // Update the access token
    cookieStore.set('spotify_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/',
    });
    
    // Update the refresh token if a new one was provided
    if (tokenData.refresh_token) {
      cookieStore.set('spotify_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Please use POST method for token refresh' },
    { status: 405 }
  );
}

