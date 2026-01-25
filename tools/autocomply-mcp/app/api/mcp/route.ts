/**
 * MCP Transport Endpoint for AutoComply Control-Plane
 * 
 * Provides remote MCP server for reading/writing task queue and decisions
 * via GitHub API. Supports OAuth 2.0 and legacy bearer token authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getFile, updateFile, appendToFile } from '@/lib/github';
import { validateBearerToken } from '@/lib/auth';
import { validateAccessToken, extractBearerToken, isOAuthConfigured } from '@/lib/oauth';

// Edge runtime for SSE streaming
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// JSON-RPC helper function for errors
function jsonrpcErr(id: string | number | null, message: string, code = -32000) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// Get GitHub configuration error if any
function getGitHubConfigError(): string | null {
  const required = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'];
  const missing = required.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    return `GitHub integration not configured on server. Missing env vars: ${missing.join(', ')}`;
  }
  return null;
}

// Tool schemas
const UpdateTaskQueueSchema = z.object({
  content: z.string(),
  message: z.string(),
});
const AppendDecisionSchema = z.object({
  decision: z.string(),
  message: z.string().optional(),
});
const GetFileSchema = z.object({
  path: z.string(),
});

// MCP Server instance
let server: Server | null = null;

function getServer() {
  if (!server) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';
    const oauthConfigured = isOAuthConfigured();
    
    server = new Server(
      {
        name: 'autocomply-control-plane',
        version: '1.0.0',
      },
      {
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
      }
    );

    // Register tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        {
          name: 'health_check',
          description: 'Returns ok to confirm MCP discovery works',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_task_queue',
          description: 'Fetch TASK_QUEUE.md content from the repository',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'update_task_queue',
          description: 'Replace TASK_QUEUE.md content in the repository',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'New content for TASK_QUEUE.md',
              },
              message: {
                type: 'string',
                description: 'Commit message describing the changes',
              },
            },
            required: ['content', 'message'],
          },
        },
        {
          name: 'append_decision',
          description: 'Append a new decision entry to DECISIONS.md',
          inputSchema: {
            type: 'object',
            properties: {
              decision: {
                type: 'string',
                description: 'Decision entry in markdown format',
              },
              message: {
                type: 'string',
                description: 'Commit message (defaults to "docs: add decision to ADR")',
              },
            },
            required: ['decision'],
          },
        },
        {
          name: 'get_decisions',
          description: 'Fetch DECISIONS.md content from the repository',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_file',
          description: 'Fetch arbitrary markdown file from the repository (restricted to *.md files)',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path relative to repo root',
              },
            },
            required: ['path'],
          },
        },
      ];
      
      console.log(`[MCP] tools/list returned ${tools.length} tools`);
      return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.log(`[MCP] tools/call invoked: ${name}`);

      try {
        switch (name) {
          case 'health_check': {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({
                    ok: true,
                    timestamp: new Date().toISOString(),
                    message: 'MCP server is healthy and tools are discoverable',
                  }, null, 2),
                },
              ],
            };
          }

          case 'get_task_queue': {
            const { content } = await getFile('TASK_QUEUE.md');
            return {
              content: [
                {
                  type: 'text' as const,
                  text: content,
                },
              ],
            };
          }

          case 'update_task_queue': {
            const parsed = UpdateTaskQueueSchema.parse(args);
            const { sha } = await getFile('TASK_QUEUE.md');
            const commitSha = await updateFile(
              'TASK_QUEUE.md',
              parsed.content,
              parsed.message,
              sha
            );
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Updated TASK_QUEUE.md (commit: ${commitSha.substring(0, 7)})`,
                },
              ],
            };
          }

          case 'append_decision': {
            const parsed = AppendDecisionSchema.parse(args);
            const commitMessage = parsed.message || 'docs: add decision to ADR';
            const commitSha = await appendToFile(
              'DECISIONS.md',
              parsed.decision,
              commitMessage
            );
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Appended decision to DECISIONS.md (commit: ${commitSha.substring(0, 7)})`,
                },
              ],
            };
          }

          case 'get_decisions': {
            const { content } = await getFile('DECISIONS.md');
            return {
              content: [
                {
                  type: 'text' as const,
                  text: content,
                },
              ],
            };
          }

          case 'get_file': {
            const parsed = GetFileSchema.parse(args);
            if (!parsed.path.endsWith('.md')) {
              throw new Error('Access denied: only .md files are allowed');
            }
            const { content } = await getFile(parsed.path);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: content,
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  return server;
}

/**
 * Validate authentication (OAuth or legacy bearer token)
 */
async function validateAuth(authHeader: string | null): Promise<{ isAuthenticated: boolean; canWrite: boolean }> {
  if (!authHeader) {
    return { isAuthenticated: false, canWrite: false };
  }

  // Try OAuth first if configured
  if (isOAuthConfigured()) {
    const token = extractBearerToken(authHeader);
    if (token) {
      try {
        const payload = await validateAccessToken(token);
        // Check if token has write scope
        const scopes = (payload.scope as string)?.split(' ') || [];
        const canWrite = scopes.includes('write:tasks');
        return { isAuthenticated: true, canWrite };
      } catch {
        // Fall through to legacy auth
      }
    }
  }

  // Fall back to legacy bearer token (full access if valid)
  if (validateBearerToken(authHeader)) {
    return { isAuthenticated: true, canWrite: true };
  }

  return { isAuthenticated: false, canWrite: false };
}

// HTTP GET handler for SSE MCP discovery (ChatGPT integration)
export async function GET() {
  const encoder = new TextEncoder();

  const tools = [
    {
      name: 'health_check',
      description: 'Returns ok to confirm MCP discovery works',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'get_task_queue',
      description: 'Fetch task queue',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'update_task_queue',
      description: 'Update task queue',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'append_decision',
      description: 'Append decision',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'get_decisions',
      description: 'Fetch decisions',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'get_file',
      description: 'Fetch a markdown file',
      input_schema: { type: 'object', properties: {} },
    },
  ];

  const stream = new ReadableStream({
    start(controller) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const send = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // tools event (what ChatGPT needs)
      send('tools', { tools });

      // ready event
      send('ready', { ok: true });

      // keepalive so the connection isn't buffered/closed
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      // NOTE: Edge ReadableStream doesn't expose close callbacks reliably,
      // but this is good enough for discovery.
      // If you add cancellation later, clearInterval(interval).
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

// HTTP POST handler for MCP requests
export async function POST(request: NextRequest) {
  let requestId: string | number | null = null;
  
  try {
    // Parse JSON-RPC request first (before any validation)
    const body = await request.json();
    requestId = body.id || null;
    
    // Log incoming MCP request
    console.log(`[MCP] Incoming request: method=${body.method}, id=${requestId}`);

    // Special case: initialize - MCP handshake (no auth required)
    if (body.method === 'initialize') {
      console.log('[MCP] initialize request - returning server capabilities');
      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'autocomply-control-plane',
            version: '1.0.0',
            description: 'MCP server for AutoComply task queue and decision management',
          },
          capabilities: {
            tools: {
              listChanged: true,
            },
            resources: {},
          },
        },
      });
    }

    // Special case: notifications/initialized - MCP handshake completion (no auth required)
    if (body.method === 'notifications/initialized') {
      console.log('[MCP] notifications/initialized - handshake complete');
      return new NextResponse(null, { status: 204 });
    }

    // Special case: ping - health check (no auth required)
    if (body.method === 'ping') {
      console.log('[MCP] ping request - responding with pong');
      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestId,
        result: {},
      });
    }

    // Special case: tools/list should always work (no auth or env vars required)
    // Return tool catalog directly without MCP SDK connection
    if (body.method === 'tools/list') {
      console.log('[MCP] tools/list request - returning tool catalog without auth');
      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          tools: [
            {
              name: 'health_check',
              description: 'Returns ok to confirm MCP discovery works',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'get_task_queue',
              description: 'Fetch TASK_QUEUE.md content from the repository',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'update_task_queue',
              description: 'Replace TASK_QUEUE.md content in the repository',
              inputSchema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'string',
                    description: 'New content for TASK_QUEUE.md',
                  },
                  message: {
                    type: 'string',
                    description: 'Commit message describing the changes',
                  },
                },
                required: ['content', 'message'],
              },
            },
            {
              name: 'append_decision',
              description: 'Append a new decision entry to DECISIONS.md',
              inputSchema: {
                type: 'object',
                properties: {
                  decision: {
                    type: 'string',
                    description: 'Decision entry in markdown format',
                  },
                  message: {
                    type: 'string',
                    description: 'Commit message (defaults to "docs: add decision to ADR")',
                  },
                },
                required: ['decision'],
              },
            },
            {
              name: 'get_decisions',
              description: 'Fetch DECISIONS.md content from the repository',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'get_file',
              description: 'Fetch arbitrary markdown file from the repository (restricted to *.md files)',
              inputSchema: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: 'File path relative to repo root',
                  },
                },
                required: ['path'],
              },
            },
          ],
        },
      });
    }

    // Special case: health_check tool doesn't require authentication
    if (body.method === 'tools/call' && body.params?.name === 'health_check') {
      console.log('[MCP] health_check tool - no auth required');
      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ok: true,
                timestamp: new Date().toISOString(),
                message: 'MCP server is healthy and tools are discoverable',
              }, null, 2),
            },
          ],
        },
      });
    }

    // Check authentication for all other methods
    const authHeader = request.headers.get('authorization');
    const auth = await validateAuth(authHeader);
    
    if (!auth.isAuthenticated) {
      console.log('[MCP] Authentication failed: no valid token');
      return NextResponse.json(
        jsonrpcErr(requestId, 'Unauthorized: invalid or missing access token', -32600)
      );
    }
    
    console.log(`[MCP] Authentication successful: canWrite=${auth.canWrite}`);
    
    // Check write permissions for write operations
    const isWriteOperation = 
      body.method === 'tools/call' && 
      ['update_task_queue', 'append_decision'].includes(body.params?.name);
    
    if (isWriteOperation && !auth.canWrite) {
      console.log(`[MCP] Write permission denied for tool: ${body.params?.name}`);
      return NextResponse.json(
        jsonrpcErr(requestId, 'Forbidden: write:tasks scope required for this operation', -32600)
      );
    }
    
    // For tools/call with GitHub-dependent tools, check GitHub config
    if (body.method === 'tools/call') {
      const gitHubTools = ['get_task_queue', 'update_task_queue', 'append_decision', 'get_decisions', 'get_file'];
      const toolName = body.params?.name;
      
      if (gitHubTools.includes(toolName)) {
        const gitHubError = getGitHubConfigError();
        if (gitHubError) {
          console.log(`[MCP] GitHub config error for tool ${toolName}: ${gitHubError}`);
          return NextResponse.json(
            jsonrpcErr(requestId, gitHubError, -32000)
          );
        }
      }
    }
    
    // Get or create MCP server and handle the request
    const mcpServer = getServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (mcpServer.request as any)(body);

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[MCP] Handler error:', error);
    
    // Always return HTTP 200 with JSON-RPC error payload
    return NextResponse.json(
      jsonrpcErr(requestId, errorMessage, -32603)
    );
  }
}
