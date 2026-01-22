/**
 * OpenID Connect Discovery Endpoint (MCP-relative)
 * 
 * Provides OpenID configuration metadata for OAuth clients accessing via /api/mcp URL
 * Must be publicly accessible (no auth required)
 */

import { NextResponse } from 'next/server';
import { buildOIDCMetadata } from '@/lib/oauth-metadata';

export async function GET() {
  const metadata = buildOIDCMetadata();

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
