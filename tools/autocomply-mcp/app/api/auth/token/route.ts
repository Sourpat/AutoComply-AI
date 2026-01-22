/**
 * OAuth Token Endpoint (Proxy to Auth0)
 * 
 * Proxies token requests to Auth0 for ChatGPT MCP Apps
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!auth0Domain || !clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'OAuth not configured on server',
      },
      { status: 500 }
    );
  }

  try {
    // Get request body
    const body = await request.json();

    // Proxy to Auth0 token endpoint
    const tokenResponse = await fetch(`https://${auth0Domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.json(data, { status: tokenResponse.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: message,
      },
      { status: 500 }
    );
  }
}
