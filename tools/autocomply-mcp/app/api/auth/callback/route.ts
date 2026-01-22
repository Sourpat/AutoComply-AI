/**
 * OAuth Callback Handler
 * 
 * Handles OAuth authorization code exchange for ChatGPT MCP Apps
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    return NextResponse.json(
      {
        error,
        error_description: errorDescription || 'OAuth authorization failed',
      },
      { status: 400 }
    );
  }

  // Validate authorization code
  if (!code) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        error_description: 'Missing authorization code',
      },
      { status: 400 }
    );
  }

  // Exchange code for access token
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';

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
    const tokenResponse = await fetch(`https://${auth0Domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${baseUrl}/api/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error_description || 'Token exchange failed');
    }

    const tokens = await tokenResponse.json();

    // Return success page with tokens (ChatGPT will capture these)
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authorization Successful</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            .success {
              color: #22c55e;
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            h1 {
              margin: 0 0 0.5rem;
              font-size: 1.5rem;
            }
            p {
              color: #666;
              margin: 0.5rem 0;
            }
            .token-info {
              background: #f9fafb;
              padding: 1rem;
              border-radius: 4px;
              margin-top: 1rem;
              font-size: 0.875rem;
              color: #374151;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓</div>
            <h1>Authorization Successful</h1>
            <p>You can now close this window and return to ChatGPT.</p>
            <div class="token-info">
              <strong>Access Token Issued</strong><br/>
              Expires in: ${tokens.expires_in} seconds
            </div>
          </div>
          <script>
            // Send token data to opener (ChatGPT)
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth_callback',
                tokens: ${JSON.stringify(tokens)},
                state: ${JSON.stringify(state)}
              }, '*');
            }
          </script>
        </body>
      </html>
      `,
      {
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
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
