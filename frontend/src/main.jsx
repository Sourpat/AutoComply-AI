import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RagDebugProvider } from './devsupport/RagDebugContext'
import { RoleProvider } from './context/RoleContext'
import { API_BASE } from './lib/api'

// Boot-time log: Show resolved API base URL (production-safe)
console.log('[AutoComply] Resolved API base URL:', API_BASE)

// Dev-only: Additional debug info
if (import.meta.env.DEV) {
  console.log('[AutoComply Dev]', {
    env: import.meta.env.VITE_APP_ENV || 'dev',
    mode: import.meta.env.MODE,
    gitSha: import.meta.env.VITE_GIT_SHA || '(not set)'
  })
}

// Boot marker - shows app is loading
const rootEl = document.getElementById('root')
if (rootEl) {
  rootEl.innerHTML = '<div style="padding:20px;font-family:system-ui;color:#64748b;font-size:14px;">⚡ Loading AutoComply AI...</div>'
}

// Global error overlay for crashes before React mounts
function showCrashOverlay(error, errorType = 'Runtime Error') {
  const root = document.getElementById('root')
  if (!root) return

  const errorMessage = error?.message || error?.reason?.message || String(error)
  const errorStack = error?.stack || error?.reason?.stack || ''
  
  root.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      padding: 24px;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <div style="
        max-width: 800px;
        width: 100%;
        background: rgba(225, 29, 72, 0.1);
        border: 1px solid rgba(225, 29, 72, 0.3);
        border-radius: 16px;
        padding: 32px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
      ">
        <div style="display: flex; align-items: start; gap: 16px;">
          <div style="
            flex-shrink: 0;
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(225, 29, 72, 0.2);
            border-radius: 12px;
          ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fb7185" stroke-width="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div style="flex: 1;">
            <h1 style="
              margin: 0 0 12px 0;
              font-size: 24px;
              font-weight: 700;
              color: #fda4af;
            ">AutoComply UI Crashed</h1>
            <p style="
              margin: 0 0 16px 0;
              font-size: 14px;
              line-height: 1.6;
              color: #fda4af;
            ">The application failed to start. This is likely a module import or runtime error.</p>
            
            <div style="
              background: rgba(15, 23, 42, 0.6);
              border: 1px solid rgba(225, 29, 72, 0.2);
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 12px;
            ">
              <div style="
                font-size: 11px;
                font-weight: 600;
                color: #fda4af;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              ">${errorType}</div>
              <div style="
                font-family: 'Courier New', monospace;
                font-size: 13px;
                color: #fecdd3;
                word-break: break-word;
              ">${errorMessage}</div>
            </div>
            
            ${errorStack ? `
              <details style="margin-top: 16px;">
                <summary style="
                  cursor: pointer;
                  font-size: 12px;
                  font-weight: 500;
                  color: #fb7185;
                  margin-bottom: 8px;
                  user-select: none;
                ">Show stack trace</summary>
                <pre style="
                  margin: 8px 0 0 0;
                  padding: 12px;
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  font-family: 'Courier New', monospace;
                  font-size: 11px;
                  color: #cbd5e1;
                  overflow: auto;
                  max-height: 300px;
                  line-height: 1.5;
                ">${errorStack.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
              </details>
            ` : ''}
            
            <div style="margin-top: 24px; display: flex; gap: 12px;">
              <button onclick="window.location.reload()" style="
                padding: 10px 20px;
                background: #e11d48;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
              " onmouseover="this.style.background='#be123c'" onmouseout="this.style.background='#e11d48'">
                Reload Page
              </button>
            </div>
            
            <p style="
              margin: 24px 0 0 0;
              font-size: 12px;
              color: rgba(251, 113, 133, 0.7);
            ">💡 Open DevTools Console (F12) for more details</p>
          </div>
        </div>
      </div>
    </div>
  `
}

// Install global error handlers BEFORE React renders
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler]', event.error)
  showCrashOverlay(event.error, 'Uncaught Error')
  event.preventDefault()
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
  showCrashOverlay(event.reason, 'Unhandled Promise Rejection')
  event.preventDefault()
})

// Try to render React app
try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <RoleProvider>
          <RagDebugProvider>
            <App />
          </RagDebugProvider>
        </RoleProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  )
} catch (error) {
  console.error('[React Mount Error]', error)
  showCrashOverlay(error, 'React Mount Error')
}
