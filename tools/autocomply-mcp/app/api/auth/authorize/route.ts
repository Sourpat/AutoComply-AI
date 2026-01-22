/**
 * OAuth Authorization Endpoint
 * 
 * Redirects to Auth0 authorization page for ChatGPT MCP Apps
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state');
  const scope = searchParams.get('scope') || 'openid profile email';
  const responseType = searchParams.get('response_type') || 'code';

  const auth0Domain = process.env.AUTH0_DOMAIN;
  const auth0ClientId = process.env.AUTH0_CLIENT_ID;
  const auth0Audience = process.env.AUTH0_AUDIENCE;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';

  if (!auth0Domain || !auth0ClientId) {
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'OAuth not configured on server',
      },
      { status: 500 }
    );
  }

  // Build Auth0 authorization URL
  const params = new URLSearchParams({
    client_id: auth0ClientId,
    response_type: responseType,
    redirect_uri: `${baseUrl}/api/auth/callback`,
    scope,
    ...(state && { state }),
    ...(auth0Audience && { audience: auth0Audience }),
  });

  const authUrl = `https://${auth0Domain}/authorize?${params.toString()}`;

  // Redirect to Auth0
  return NextResponse.redirect(authUrl);
}
