/**
 * Shared OAuth/OIDC metadata builder
 * 
 * Generates consistent discovery metadata for both root and /api/mcp paths
 */

export interface OAuthMetadata {
  _notice?: string;
  configured: boolean;
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  scopes_supported: string[];
  code_challenge_methods_supported: string[];
}

export interface OIDCMetadata extends OAuthMetadata {
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  claims_supported: string[];
}

export function buildOAuthMetadata(): OAuthMetadata {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';
  const auth0Domain = process.env.AUTH0_DOMAIN || 'auth0.example.com';
  const isConfigured = !!process.env.AUTH0_DOMAIN;

  return {
    _notice: isConfigured ? undefined : 'OAuth not fully configured - using placeholder values. Set AUTH0_DOMAIN to enable.',
    configured: isConfigured,
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/api/auth/token`,
    jwks_uri: `https://${auth0Domain}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    scopes_supported: ['openid', 'profile', 'email', 'read:tasks', 'write:tasks'],
    code_challenge_methods_supported: ['S256'],
  };
}

export function buildOIDCMetadata(): OIDCMetadata {
  const oauthMetadata = buildOAuthMetadata();
  
  return {
    ...oauthMetadata,
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'scope'],
  };
}
