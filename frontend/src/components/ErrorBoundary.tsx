// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Full-page error UI for root-level crashes
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
          <div className="max-w-2xl w-full rounded-2xl border border-rose-800 bg-rose-950/40 p-8 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-rose-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-rose-200">
                  AutoComply UI crashed
                </h1>
                <p className="mt-2 text-sm text-rose-300">
                  The application encountered an unexpected error and could not continue.
                  This is likely a bug in the code.
                </p>
                {this.state.error && (
                  <div className="mt-4 space-y-2">
                    <div className="rounded-lg bg-rose-900/50 border border-rose-700 p-3">
                      <p className="text-xs font-medium text-rose-200 mb-1">Error:</p>
                      <p className="text-xs text-rose-300 font-mono">
                        {this.state.error.message || this.state.error.toString()}
                      </p>
                    </div>
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-medium text-rose-400 hover:text-rose-300 select-none">
                        Show stack trace
                      </summary>
                      <pre className="mt-2 overflow-auto rounded-lg bg-slate-900 border border-slate-700 p-3 text-[10px] text-slate-300 max-h-64">
                        {this.state.error.stack || 'No stack trace available'}
                      </pre>
                    </details>
                  </div>
                )}
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 transition-colors"
                  >
                    Reload page
                  </button>
                  <button
                    onClick={this.handleReset}
                    className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
                  >
                    Try to recover
                  </button>
                </div>
                <p className="mt-4 text-xs text-rose-400/80">
                  💡 Tip: Open DevTools Console (F12) for more details
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
