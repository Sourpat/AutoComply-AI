import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AutoComply Control-Plane MCP',
  description: 'Model Context Protocol server for task queue and decision management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
