/**
 * OpenID Connect Discovery Endpoint
 * 
 * Provides OpenID configuration metadata for OAuth clients
 * Must be publicly accessible (no auth required)
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';
  const auth0Domain = process.env.AUTH0_DOMAIN || 'auth0.example.com';
  const isConfigured = !!process.env.AUTH0_DOMAIN;

  const metadata = {
    _notice: isConfigured ? undefined : 'OAuth not fully configured - using placeholder values. Set AUTH0_DOMAIN to enable.',
    configured: isConfigured,
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/api/auth/token`,
    jwks_uri: `https://${auth0Domain}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    scopes_supported: ['openid', 'profile', 'email', 'read:tasks', 'write:tasks'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'scope'],
    code_challenge_methods_supported: ['S256'],
  };

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
