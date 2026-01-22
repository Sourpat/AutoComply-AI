# AutoComply Control-Plane MCP Server

Remote MCP (Model Context Protocol) server for managing AutoComply task queue and architectural decisions via GitHub API.

**NEW**: OAuth 2.0 support for ChatGPT MCP Apps! 🎉

## Features

- **Task Queue Management**: Read and update `TASK_QUEUE.md` via MCP tools
- **Decision Logging**: Append entries to `DECISIONS.md` (Architecture Decision Records)
- **File Access**: Read any markdown file from the repository
- **GitHub Integration**: Direct commits via GitHub Contents API
- **OAuth 2.0 Authentication**: Secure integration with ChatGPT Developer Mode
- **Scope-Based Access**: Read-only and write scopes for granular permissions
- **Legacy Bearer Token**: Backward compatible with simple token auth

## Architecture

```
┌─────────────┐                    ┌──────────────────┐
│ ChatGPT     │ ──── OAuth 2.0 ──→ │  Next.js Server  │
│ MCP App     │      (Auth0)       │  /api/mcp        │
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

## Quick Start

### Option 1: OAuth Setup (Recommended for ChatGPT)

#### 1. Create Auth0 Account

1. Go to [auth0.com](https://auth0.com) and sign up
2. Create a new tenant (e.g., `autocomply-dev`)
3. Note your domain: `autocomply-dev.us.auth0.com`
For testing without OAuth:

1. **Install dependencies**:
   ```bash
   cd tools/autocomply-mcp
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

   Minimal `.env` (no OAuth):
   ```env
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_OWNER=Sourpat
   GITHUB_REPO=AutoComply-AI-fresh
   MCP_BEARER_TOKEN=my-secret-token-123
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

## ChatGPT Integration

### Adding MCP Server to ChatGPT Developer Mode

1. **Deploy to Vercel** (see Deployment section below)

2. **In ChatGPT**, go to **Settings** → **Developer** → **MCP Servers**

3. Click **"Add MCP Server"** or **"New App"**

4. Enter server details:
   - **Name**: AutoComply Control Plane
   - **URL**: `https://your-app.vercel.app/api/mcp`
   - **Authentication**: Select **OAuth 2.0**

5. **OAuth Configuration** (auto-detected from metadata):
   - Authorization URL: `https://your-app.vercel.app/api/auth/authorize`
   - Token URL: `https://your-app.vercel.app/api/auth/token`
   - Scopes: `read:tasks write:tasks`

6. Click **Connect** → ChatGPT will open Auth0 login

7. **Authorize** the application

8. **Verify**: Tools should appear in ChatGPT's tool list:
   - `get_task_queue`
   - `update_task_queue`
   - `append_decision`
   - `get_decisions`
   - `get_file`

### Testing in ChatGPT

Try these prompts:

```
"Show me the current task queue"
→ Uses get_task_queue tool

"Add a new decision: we're using OAuth for MCP authentication"
→ Uses append_decision tool (requires write:tasks scope)

"Update task T-001 status to completed"
→ Uses update_task_queue tool (requires write:tasks scope)
```

## Local Development

### Prerequisites

- Node.js 18+
- GitHub Personal Access Token with `repo` scope
- Auth0 account (for OAuth testing)
```
http://localhost:3100
https://your-app.vercel.app
https://chat.openai.com
```

**Save Changes**

#### 4. Create Auth0 API

1. Go to **Applications** → **APIs** → **Create API**
2. Name: "AutoComply MCP API"
3. Identifier (Audience): `https://autocomply-mcp.example.com` (can be any URL format)
4. Click **Create**

#### 5. Configure API Scopes

In your API settings, add these scopes:

- `read:tasks` - Read task queue and decisions
- `write:tasks` - Update task queue and decisions

#### 6. Local Environment Setup

```bash
cd tools/autocomply-mcp
cp .env.example .env
```

Edit `.env` with your Auth0 credentials:

```env
# GitHub Access
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=Sourpat
GITHUB_REPO=AutoComply-AI-fresh

# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://autocomply-mcp.example.com
AUTH0_CLIEN Locally

**Health Check**:
```bash
curl http://localhost:3100/api/mcp
```

**OAuth Metadata**:
```bash
curl http://localhost:3100/api/.well-known/oauth-authorization-server
```

**Manual OAuth Flow** (in browser):
1. Open: `http://localhost:3100/api/auth/authorize?response_type=code&client_id=test&scope=read:tasks write:tasks`
2. Login with Auth0
3. Get redirected to callback with authorization code
4. Exchange code for access token (see callback response)

**MCP Tool Call** (with OAuth token):
```bash
# Get access token first (from Auth0 or callback)
ACCESS_TOKEN="your_access_token_here"

curl -X POST http://localhost:3100/api/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
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

**MCP Tool Call** (with legacy bearer token):
```bash
curl -X POST http://localhost:3100/api/mcp \
  -H "Authorization: Bearer my-secret-token-123
npm run dev
```

Server starts at: http://localhost:3100

#### 8. Test OAuth Flow

```bash
# Health check
curl http://localhost:3100/api/mcp

# OAuth metadata
curl http://localhost:3100/api/.well-known/oauth-authorization-server
```

### Option 2: Legacy Bearer Token (Simple)

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

**OAuth Scope**: `read:tasks` (optional - can be public)
- `content` (string): New task queue content
- `message` (string): Git (if not already installed)
```bash
npm i -g vercel
```

### 2. Deploy
```bash
cd tools/autocomply-mcp
vercel
```

Follow the prompts:
- **Set up and deploy**: Yes
- **Which scope**: Your Vercel account
- **Link to existing project**: No
- **Project name**: autocomply-mcp
- **Directory**: `./`
- **Override settings**: No

### 3. Configure Environment Variables in Vercel Dashboard

Go to your project settings → **Environment Variables** and add:

**Required**:
- `GITHUB_TOKEN` - Your GitHub PAT
- `GITHUB_OWNER` - Repository owner
- `GITHUB_REPO` - Repository name
- `AUTH0_DOMAIN` - Your Auth0 domain
- `AUTH0_AUDIENCE` - Your Auth0 API identifier
- `AUTH0_CLIENT_ID` - Auth0 application client ID
- `AUTH0_CLIENT_SECRET` - Auth0 application client secret
- `NEXT_PUBLIC_BASE_URL` - Your Vercel deployment URL (e.g., `https://autocomply-mcp.vercel.app`)

**Optional**:
- `MCP_BEARER_TOKEN` - Legacy token for backward compatibility
- `GITHUB_BRANCH` - Target branch (defaults to `main`)

### 4. Update Auth0 Callback URLs

In Auth0 Dashboard, update your application's **Allowed Callback URLs** to include:
```
https://your-app.vercel.app/api/auth/callback
```

### 5. Deploy to Production
```bash
vercel --prod
```

### 6. Verify Deployment

```bash
# Health check
curl https://your-app.vercel.app/api/mcp

# OAuth metadata
curl https://your-app.vercel.app/api/.well-known/oauth-authorization-server
```

### 7. Add to ChatGPT

Follow the "ChatGPT Integration" section above, using your production URL.Deployment to Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```OAuth 2.0**: Industry-standard authentication with scoped access
- **Scope-Based Permissions**: `read:tasks` for reads, `write:tasks` for writes
- **Bearer Token**: Required for all MCP requests (OAuth or legacy)
- **File Restrictions**: `get_file` only allows `.md` files
- **GitHub PAT**: Stored securely in environment variables
- **No Secret Exposure**: API never returns token values
- **Auth0 Security**: Leverages Auth0's enterprise-grade security
- **HTTPS Only**: Production deployments enforce HTTPS

## OAuth Scopes

| Scope | Description | Protected Tools |
|-------|-------------|-----------------|
| `read:tasks` | Read task queue and decisions | `get_task_queue`, `get_decisions`, `get_file` |
| `write:tasks` | Update task queue and decisions | `update_task_queue`, `append_decision` |

**Note**: Read-only tools can optionally be made public by removing auth check for non-write operations.
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `MCP_BEARER_TOKEN`

### 3. Deploy
```AUTH0_DOMAIN` | ✅* | Auth0 tenant domain (e.g., `tenant.us.auth0.com`) |
| `AUTH0_AUDIENCE` | ✅* | Auth0 API identifier |
| `AUTH0_CLIENT_ID` | ✅* | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | ✅* | Auth0 application client secret |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Base URL for OAuth callbacks |
| `MCP_BEARER_TOKEN` | ❌ | Legacy bearer token (optional) |
| `GITHUB_BRANCH` | ❌ | Target branch (defaults to `main`) |

*Required for OAuth support. Can be omitted if using legacy bearer token only.
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
### OAuth Issues

**"OAuth not configured on server"**:
- Ensure all Auth0 env vars are set (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`)
- Restart server after adding env vars

**"Invalid access token"**:
- Check that token hasn't expired (default: 24 hours)
- Verify audience matches `AUTH0_AUDIENCE` env var
- Ensure issuer is `https://YOUR_DOMAIN/`

**ChatGPT can't connect**:
- Verify `NEXT_PUBLIC_BASE_URL` matches your deployed URL
- ✅ OAuth 2.0 support for ChatGPT MCP Apps
- ✅ Scope-based access control (read vs write)
- Add `search_tasks` tool for querying task queue
- Support for updating individual tasks without full rewrite
- Webhook integration for real-time updates
- Task status change notifications
- Integration with GitHub Issues for task tracking
- Support for additional OAuth providers (Google, GitHub)
- Refresh token support for long-lived sessions
- Rate limiting per user/scope
- User doesn't have `write:tasks` scope in their access token
- Check Auth0 API permissions and scopes
- Re-authorize in ChatGPT to get updated scopes

### General Issues

**"Missing required env vars"**:
- Ensure all required variables are set in `.env` or Vercel dashboard
- For OAuth: need GitHub vars + Auth0 vars + base URL
- For legacy: need GitHub vars + bearer token

**"GitHub API rate limit"**:
- GitHub API allows 5000 requests/hour with PAT
- Use a dedicated token for the MCP server
- Consider caching for read operations

**"File not found"**:
- Verify file path is relative to repo root
- Check branch name matches `GITHUB_BRANCH` env var
- Ensure file exists in repository

### Testing Auth0 Locally

1. Use ngrok to expose local server:
   ```bash
   ngrok http 3100
   ```

2. Update `.env`:
   ```env
   NEXT_PUBLIC_BASE_URL=https://your-id.ngrok.io
   ```

3. Update Auth0 callbacks:
   ```
   https://your-id.ngrok.io/api/auth/callback
   ```

4. Test OAuth flow through ngrok URLalid config

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
