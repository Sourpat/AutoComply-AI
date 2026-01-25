/**
 * OAuth 2.0 Authorization Server Metadata (MCP-relative)
 * 
 * Provides discovery endpoint for OAuth clients accessing via /api/mcp URL
 * Must be publicly accessible (no auth required)
 */

import { NextResponse } from 'next/server';
import { buildOAuthMetadata } from '@/lib/oauth-metadata';

export async function GET() {
  // Check if OAuth is actually configured
  const isConfigured = !!process.env.AUTH0_DOMAIN && !!process.env.AUTH0_CLIENT_ID;
  
  if (!isConfigured) {
    // Return 404 to prevent ChatGPT from trying OAuth
    return NextResponse.json(
      { error: 'OAuth not configured' },
      { status: 404 }
    );
  }
  
  const metadata = buildOAuthMetadata();

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
