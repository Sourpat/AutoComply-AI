/**
 * OAuth Authentication for MCP Server
 * 
 * Validates access tokens from Auth0 or other OAuth providers
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

// OAuth configuration from environment
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

// Cache JWKS for token validation
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!AUTH0_DOMAIN) {
    throw new Error('AUTH0_DOMAIN not configured');
  }

  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(
      new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`)
    );
  }

  return jwksCache;
}

/**
 * Validate OAuth access token
 * 
 * @param token - JWT access token from Authorization header
 * @returns Decoded token payload if valid
 * @throws Error if token is invalid or expired
 */
export async function validateAccessToken(token: string) {
  if (!AUTH0_DOMAIN || !AUTH0_AUDIENCE) {
    throw new Error('OAuth not configured (missing AUTH0_DOMAIN or AUTH0_AUDIENCE)');
  }

  try {
    const jwks = getJWKS();
    
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
    });

    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid access token: ${message}`);
  }
}

/**
 * Extract bearer token from Authorization header
 * 
 * @param authHeader - Authorization header value
 * @returns Token string without "Bearer " prefix
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Check if OAuth is configured
 */
export function isOAuthConfigured(): boolean {
  return !!(AUTH0_DOMAIN && AUTH0_AUDIENCE);
}
