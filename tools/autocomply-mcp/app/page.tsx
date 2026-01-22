/**
 * Home page for AutoComply MCP Server
 */

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">AutoComply Control-Plane MCP</h1>
        <p className="text-lg text-gray-600 mb-8">
          Model Context Protocol server for task queue and decision management
        </p>
        
        <div className="bg-gray-100 rounded-lg p-6 text-left">
          <h2 className="text-xl font-semibold mb-4">Available Tools</h2>
          <ul className="space-y-2">
            <li><code className="bg-white px-2 py-1 rounded">get_task_queue</code> - Fetch TASK_QUEUE.md</li>
            <li><code className="bg-white px-2 py-1 rounded">update_task_queue</code> - Update TASK_QUEUE.md</li>
            <li><code className="bg-white px-2 py-1 rounded">append_decision</code> - Add to DECISIONS.md</li>
            <li><code className="bg-white px-2 py-1 rounded">get_decisions</code> - Fetch DECISIONS.md</li>
            <li><code className="bg-white px-2 py-1 rounded">get_file</code> - Get any .md file</li>
          </ul>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>MCP Endpoint: <code>/api/mcp</code></p>
          <p>Authentication: OAuth 2.0 (preferred) or Bearer token</p>
          <p className="mt-2">OAuth Endpoints:</p>
          <ul className="list-disc list-inside ml-4">
            <li><code>/api/auth/authorize</code> - Authorization</li>
            <li><code>/api/auth/token</code> - Token exchange</li>
            <li><code>/api/auth/callback</code> - Callback handler</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
