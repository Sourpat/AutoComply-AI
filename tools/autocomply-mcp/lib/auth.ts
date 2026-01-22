/**
 * MCP Authentication Middleware
 * 
 * Validates bearer token from Authorization header
 */

export function withMcpAuth<T>(
  handler: () => Promise<T>
): () => Promise<T> {
  return async () => {
    const expectedToken = process.env.MCP_BEARER_TOKEN;
    
    if (!expectedToken) {
      throw new Error('MCP_BEARER_TOKEN not configured on server');
    }

    // In Next.js App Router, headers are accessed via next/headers
    // For now, we'll validate in the route handler directly
    // This is a placeholder - actual auth happens in route.ts
    
    return handler();
  };
}

/**
 * Validate bearer token from request headers
 */
export function validateBearerToken(authHeader: string | null): boolean {
  const expectedToken = process.env.MCP_BEARER_TOKEN;
  
  if (!expectedToken) {
    throw new Error('MCP_BEARER_TOKEN not configured on server');
  }

  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === expectedToken;
}
