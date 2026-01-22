/**
 * MCP Transport Endpoint for AutoComply Control-Plane
 * 
 * Provides remote MCP server for reading/writing task queue and decisions
 * via GitHub API. Requires bearer token authentication.
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

// Validate environment variables
function validateEnv() {
  const required = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO', 'MCP_BEARER_TOKEN'];
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
    server = new Server(
      {
        name: 'autocomply-control-plane',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
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

// HTTP POST handler for MCP requests
export async function POST(request: NextRequest) {
  try {
    // Validate environment
    validateEnv();

    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!validateBearerToken(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or missing bearer token' },
        { status: 401 }
      );
    }

    // Parse JSON-RPC request
    const body = await request.json();
    
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
  return NextResponse.json({
    name: 'autocomply-control-plane',
    version: '1.0.0',
    status: 'ok',
    description: 'MCP server for AutoComply task queue and decision management',
    tools: ['get_task_queue', 'update_task_queue', 'append_decision', 'get_decisions', 'get_file'],
  });
}
