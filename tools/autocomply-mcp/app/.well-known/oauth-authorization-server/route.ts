/**
 * OAuth 2.0 Authorization Server Metadata
 * 
 * Provides discovery endpoint for OAuth clients (ChatGPT)
 * Must be publicly accessible (no auth required)
 */

import { NextResponse } from 'next/server';
import { buildOAuthMetadata } from '@/lib/oauth-metadata';

export async function GET() {
  const metadata = buildOAuthMetadata();

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
