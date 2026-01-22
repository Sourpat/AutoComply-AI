# AutoComply Control-Plane MCP Server

Remote MCP (Model Context Protocol) server for managing AutoComply task queue and architectural decisions via GitHub API.

## Features

- **Task Queue Management**: Read and update `TASK_QUEUE.md` via MCP tools
- **Decision Logging**: Append entries to `DECISIONS.md` (Architecture Decision Records)
- **File Access**: Read any markdown file from the repository
- **GitHub Integration**: Direct commits via GitHub Contents API
- **Bearer Token Auth**: Secure access control for MCP clients

## Architecture

```
┌─────────────┐                    ┌──────────────────┐
│ MCP Client  │ ──── Bearer ────→  │  Next.js Server  │
│ (Claude AI) │      Token         │  /api/mcp        │
└─────────────┘                    └──────────────────┘
                                           │
                                           │ GitHub API
                                           ↓
                                    ┌──────────────────┐
                                    │  GitHub Repo     │
                                    │  TASK_QUEUE.md   │
                                    │  DECISIONS.md    │
                                    └──────────────────┘
```

## Local Development

### Prerequisites

- Node.js 18+
- GitHub Personal Access Token with `repo` scope

### Setup

1. **Install dependencies**:
   ```bash
   cd tools/autocomply-mcp
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values:
   ```env
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_OWNER=Sourpat
   GITHUB_REPO=AutoComply-AI-fresh
   MCP_BEARER_TOKEN=your_secret_here
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

   Server starts at: http://localhost:3100

### Testing

**Health Check**:
```bash
curl http://localhost:3100/api/mcp
```

**MCP Tool Call** (example):
```bash
curl -X POST http://localhost:3100/api/mcp \
  -H "Authorization: Bearer your_secret_here" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_task_queue",
      "arguments": {}
    },
    "id": 1
  }'
```

## Available MCP Tools

### 1. `get_task_queue`
Fetch current task queue content.

**Parameters**: None

**Returns**: Full content of `TASK_QUEUE.md`

### 2. `update_task_queue`
Replace task queue with new content.

**Parameters**:
- `content` (string): New task queue content
- `message` (string): Git commit message

**Returns**: Commit SHA

### 3. `append_decision`
Add new decision to ADR log.

**Parameters**:
- `decision` (string): Decision entry in markdown format
- `message` (string, optional): Commit message

**Returns**: Commit SHA

### 4. `get_decisions`
Fetch current decisions log.

**Parameters**: None

**Returns**: Full content of `DECISIONS.md`

### 5. `get_file`
Fetch arbitrary markdown file from repo.

**Parameters**:
- `path` (string): File path relative to repo root

**Returns**: File content (restricted to `.md` files only)

**Security**: Only allows access to markdown files.

## Deployment to Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Configure Environment Variables
In Vercel dashboard, add:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `MCP_BEARER_TOKEN`

### 3. Deploy
```bash
vercel --prod
```

### 4. Configure MCP Client
Update your MCP client config (e.g., Claude Desktop) with:
```json
{
  "mcpServers": {
    "autocomply-control-plane": {
      "url": "https://your-app.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer your_mcp_bearer_token"
      }
    }
  }
}
```

## Security

- **Bearer Token**: Required for all MCP requests
- **File Restrictions**: `get_file` only allows `.md` files
- **GitHub PAT**: Stored securely in environment variables
- **No Secret Exposure**: API never returns token values

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | ✅ | GitHub PAT with `repo` scope |
| `GITHUB_OWNER` | ✅ | Repository owner (e.g., `Sourpat`) |
| `GITHUB_REPO` | ✅ | Repository name (e.g., `AutoComply-AI-fresh`) |
| `MCP_BEARER_TOKEN` | ✅ | Shared secret for MCP client auth |
| `GITHUB_BRANCH` | ❌ | Target branch (defaults to `main`) |

## Error Handling

- **401 Unauthorized**: Invalid or missing bearer token
- **404 Not Found**: File doesn't exist in repo
- **403 Forbidden**: GitHub token lacks permissions
- **500 Internal Error**: GitHub API failure or invalid config

## Development Notes

- **Port**: Default dev server runs on port 3100 (avoids conflicts with main app)
- **Build**: Run `npm run build` to verify TypeScript compilation
- **Lint**: Run `npm run lint` to check code quality
- **Hot Reload**: Changes auto-reload in dev mode

## Troubleshooting

**"Missing required env vars"**:
- Ensure all required variables are set in `.env`

**"GitHub API rate limit"**:
- GitHub API allows 5000 requests/hour with PAT
- Use a dedicated token for the MCP server

**"File not found"**:
- Verify file path is relative to repo root
- Check branch name matches `GITHUB_BRANCH` env var

## Future Enhancements

- Add `search_tasks` tool for querying task queue
- Support for updating individual tasks without full rewrite
- Webhook integration for real-time updates
- Task status change notifications
- Integration with GitHub Issues for task tracking
