/**
 * OAuth 2.0 Authorization Server Metadata
 * 
 * Provides discovery endpoint for OAuth clients (ChatGPT)
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';
  const auth0Domain = process.env.AUTH0_DOMAIN;

  if (!auth0Domain) {
    return NextResponse.json(
      { error: 'OAuth not configured' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    issuer: `${baseUrl}`,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/api/auth/token`,
    jwks_uri: `https://${auth0Domain}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: ['openid', 'profile', 'email', 'read:tasks', 'write:tasks'],
  });
}
