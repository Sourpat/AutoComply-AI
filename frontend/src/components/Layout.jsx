import { useState } from "react";
import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";
import { DevSupportLogPanel } from "./DevSupportLogPanel";

export default function Layout({ children }) {
  const [isDevSupportOpen, setIsDevSupportOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader onToggleDevSupport={() => setIsDevSupportOpen((v) => !v)} />

      <main className="flex-1 pt-16">
        <div className="mx-auto w-full px-6 pb-12">
          {children}
        </div>
      </main>

      <AppFooter />

      <DevSupportLogPanel
        isOpen={isDevSupportOpen}
        onClose={() => setIsDevSupportOpen(false)}
      />
    </div>
  );
}
