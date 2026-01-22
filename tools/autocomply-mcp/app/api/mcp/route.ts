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

// Validate environment variables
function validateEnv() {
  const required = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'];
  const missing = required.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
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
      return {
        tools: [
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
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
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

// HTTP POST handler for MCP requests
export async function POST(request: NextRequest) {
  try {
    // Validate environment
    validateEnv();

    // Check authentication
    const authHeader = request.headers.get('authorization');
    const auth = await validateAuth(authHeader);
    
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or missing access token' },
        { status: 401 }
      );
    }

    // Parse JSON-RPC request
    const body = await request.json();
    
    // Check if this is a write operation and user has write permission
    const isWriteOperation = 
      body.method === 'tools/call' && 
      ['update_task_queue', 'append_decision'].includes(body.params?.name);
    
    if (isWriteOperation && !auth.canWrite) {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Forbidden: write:tasks scope required for this operation',
        },
        id: body.id || null,
      });
    }
    
    // Get or create MCP server
    const mcpServer = getServer();

    // Handle the request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (mcpServer.request as any)(body);

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('MCP handler error:', error);
    return NextResponse.json(
      { 
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: errorMessage,
        },
        id: null,
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  const oauthConfigured = isOAuthConfigured();
  
  return NextResponse.json({
    name: 'autocomply-control-plane',
    version: '1.0.0',
    status: 'ok',
    description: 'MCP server for AutoComply task queue and decision management',
    tools: ['get_task_queue', 'update_task_queue', 'append_decision', 'get_decisions', 'get_file'],
    authentication: {
      oauth: oauthConfigured,
      legacyBearer: !!process.env.MCP_BEARER_TOKEN,
    },
  });
}
