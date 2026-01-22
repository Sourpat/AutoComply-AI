/**
 * Health Check Endpoint
 * 
 * Returns server status and configuration info
 * Publicly accessible (no auth required)
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';
  const oauthConfigured = !!(
    process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_AUDIENCE &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET
  );

  return NextResponse.json(
    {
      ok: true,
      status: 'healthy',
      baseUrl,
      oauthConfigured,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      endpoints: {
        mcp: `${baseUrl}/api/mcp`,
        oauthDiscovery: `${baseUrl}/.well-known/oauth-authorization-server`,
        oidcDiscovery: `${baseUrl}/.well-known/openid-configuration`,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
