import { ApiStatusChip } from "./ApiStatusChip";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      {/* Simple top bar */}
      <header className="w-full bg-white shadow-sm py-4 mb-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">
            AutoComply AI
          </h1>
          <ApiStatusChip />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 pb-12">
        {children}
      </main>
    </div>
  );
}
