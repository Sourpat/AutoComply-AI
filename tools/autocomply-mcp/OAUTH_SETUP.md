# OAuth 2.0 Setup Guide for ChatGPT MCP Integration

Quick reference for deploying the AutoComply MCP server with OAuth support.

## Prerequisites

- Auth0 account (free tier works)
- Vercel account
- GitHub PAT with repo access

## Step 1: Auth0 Setup (5 minutes)

### Create Auth0 Application

1. Go to [auth0.com](https://auth0.com) → Sign up
2. Create tenant: `autocomply-dev.us.auth0.com`
3. Applications → Create Application
   - Name: "AutoComply MCP Server"
   - Type: **Regular Web Application**
   - Click Create

### Configure Application

In Application Settings:

**Allowed Callback URLs**:
```
http://localhost:3100/api/auth/callback
https://autocomply-mcp.vercel.app/api/auth/callback
```

**Allowed Logout URLs**:
```
http://localhost:3100
https://autocomply-mcp.vercel.app
```

**Allowed Web Origins**:
```
http://localhost:3100
https://autocomply-mcp.vercel.app
https://chat.openai.com
```

**Save Changes**

### Create Auth0 API

1. Applications → APIs → Create API
2. Name: "AutoComply MCP API"
3. Identifier: `https://autocomply-mcp.example.com`
4. Click Create

### Add API Scopes

In API Settings → Permissions:

- `read:tasks` - Read task queue and decisions
- `write:tasks` - Update task queue and decisions

**Save**

### Collect Credentials

From Auth0 Application Settings:
- Domain: `autocomply-dev.us.auth0.com`
- Client ID: `abc123...`
- Client Secret: `xyz789...`

From Auth0 API Settings:
- Identifier: `https://autocomply-mcp.example.com`

## Step 2: Deploy to Vercel (3 minutes)

### Install Vercel CLI

```bash
npm i -g vercel
```

### Deploy

```bash
cd tools/autocomply-mcp
vercel --prod
```

Follow prompts:
- Project name: `autocomply-mcp`
- Directory: `./`

### Configure Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

**Required**:
```
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=Sourpat
GITHUB_REPO=AutoComply-AI-fresh
AUTH0_DOMAIN=autocomply-dev.us.auth0.com
AUTH0_AUDIENCE=https://autocomply-mcp.example.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_BASE_URL=https://autocomply-mcp.vercel.app
```

### Redeploy

```bash
vercel --prod
```

## Step 3: ChatGPT Integration (2 minutes)

### Add MCP Server to ChatGPT

1. Open ChatGPT → Settings → Developer → MCP Servers
2. Click **"New App"**

### Configure Connection

**Server Details**:
- Name: `AutoComply Control Plane`
- URL: `https://autocomply-mcp.vercel.app/api/mcp`
- Authentication: **OAuth 2.0**

OAuth endpoints will auto-detect from:
`https://autocomply-mcp.vercel.app/api/.well-known/oauth-authorization-server`

### Authorize

1. Click **Connect**
2. ChatGPT opens Auth0 login
3. Login with Auth0 account
4. Grant permissions (read:tasks, write:tasks)
5. Return to ChatGPT

### Verify Tools

Tools should appear:
- `get_task_queue`
- `update_task_queue`
- `append_decision`
- `get_decisions`
- `get_file`

## Step 4: Test (1 minute)

In ChatGPT, try:

```
"Show me the current task queue"
```

Should call `get_task_queue` tool and display TASK_QUEUE.md content.

```
"Add a decision: Using OAuth 2.0 for ChatGPT MCP integration"
```

Should call `append_decision` tool (requires write:tasks scope).

## Troubleshooting

### ChatGPT can't connect

**Check**:
1. Vercel deployment URL is correct in `NEXT_PUBLIC_BASE_URL`
2. Auth0 callback URLs include your Vercel URL
3. OAuth metadata endpoint is accessible:
   ```bash
   curl https://your-app.vercel.app/api/.well-known/oauth-authorization-server
   ```

### "Forbidden: write:tasks scope required"

**Fix**: User doesn't have write scope
1. In Auth0 API → Permissions, ensure `write:tasks` exists
2. Re-authorize in ChatGPT to get updated scopes

### "Invalid access token"

**Check**:
1. `AUTH0_AUDIENCE` matches Auth0 API Identifier exactly
2. `AUTH0_DOMAIN` includes `.auth0.com` suffix
3. Token hasn't expired (default: 24 hours)

### Local testing with ngrok

```bash
ngrok http 3100
```

Update `.env`:
```
NEXT_PUBLIC_BASE_URL=https://abc123.ngrok.io
```

Update Auth0 callback URLs to include ngrok URL.

## Security Checklist

✅ Auth0 application restricted to production domains
✅ Client secret stored in Vercel environment variables
✅ CORS origins limited to localhost + Vercel + chat.openai.com
✅ Scopes enforce read vs write permissions
✅ GitHub PAT has minimum required permissions (repo access only)
✅ HTTPS enforced in production (Vercel automatic)

## Costs

- Auth0 Free Tier: 7,000 users, unlimited logins
- Vercel Hobby: Free (100GB bandwidth/month)
- GitHub API: 5,000 requests/hour with PAT

**Total Monthly Cost**: $0 (for personal use)

## Next Steps

1. ✅ Deploy and test OAuth flow
2. Monitor Auth0 logs for authentication issues
3. Add more MCP tools as needed
4. Consider upgrading Auth0 for production (if >7k users)
5. Set up monitoring/alerts in Vercel

---

**Support**: See [README.md](README.md) for detailed documentation and troubleshooting.
