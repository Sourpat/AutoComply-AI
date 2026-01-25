/**
 * MCP SSE Transport Endpoint for ChatGPT Integration
 * 
 * Provides MCP server over Server-Sent Events (SSE) transport.
 * ChatGPT requires SSE for MCP protocol communication.
 * 
 * Note: This is a simplified SSE implementation that returns the MCP server
 * metadata and tool catalog. For full MCP protocol support, use the POST /mcp endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isOAuthConfigured } from '@/lib/oauth';


// GET handler for SSE transport
export async function GET(request: NextRequest) {
  console.log('[MCP SSE] GET request received');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';
  const oauthConfigured = isOAuthConfigured();

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `event: endpoint\ndata: ${baseUrl}/api/mcp/sse\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Send server info
      const serverInfo = {
        name: 'autocomply-control-plane',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          ...(oauthConfigured && {
            security: {
              oauth2: {
                authorizationUrl: `${baseUrl}/api/auth/authorize`,
                tokenUrl: `${baseUrl}/api/auth/token`,
                scopes: {
                  'read:tasks': 'Read task queue and decisions',
                  'write:tasks': 'Update task queue and decisions',
                },
              },
            },
          }),
        },
        instructions: 'Use POST /mcp for JSON-RPC requests with tools/list and tools/call methods',
      };
      
      const serverEvent = `event: message\ndata: ${JSON.stringify(serverInfo)}\n\n`;
      controller.enqueue(encoder.encode(serverEvent));

      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // Close handler
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// POST handler - redirect to main MCP endpoint
export async function POST(request: NextRequest) {
  console.log('[MCP SSE] POST request - redirecting to /api/mcp');

  try {
    const body = await request.json();
    console.log(`[MCP SSE] Method: ${body.method}, ID: ${body.id}`);

    // Forward to the main MCP endpoint which handles tools/list and tools/call
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';
    const mcpUrl = `${baseUrl}/api/mcp`;
    
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(
          Array.from(request.headers.entries()).filter(([key]) => 
            key.toLowerCase() === 'authorization'
          )
        ),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[MCP SSE] POST error:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      },
      { status: 200 }
    );
  }
}
