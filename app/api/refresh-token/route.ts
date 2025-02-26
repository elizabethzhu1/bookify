import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  
  if (!refreshToken) {
    return NextResponse.json(
      { error: 'No refresh token found' },
      { status: 401 }
    );
  }
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Missing Spotify credentials' },
      { status: 500 }
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
    
    const data = await response.json();
    
    if (!response.ok) {
      // If refresh fails, clear cookies and require re-authentication
      cookieStore.delete('spotify_access_token');
      cookieStore.delete('spotify_refresh_token');
      cookieStore.delete('spotify_user');
      
      console.error('Token refresh failed:', data);
      return NextResponse.json(
        { error: 'Failed to refresh token', details: data },
        { status: response.status }
      );
    }
    
    console.log("Token refresh successful");
    
    // Set the new access token as a cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: data.expires_in,
      path: '/',
    };
    
    const newResponse = NextResponse.json({ success: true });
    
    // Set cookies with the new tokens
    newResponse.cookies.set('spotify_access_token', data.access_token, cookieOptions);
    
    // If a new refresh token was provided, update it
    if (data.refresh_token) {
      newResponse.cookies.set('spotify_refresh_token', data.refresh_token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    return newResponse;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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

