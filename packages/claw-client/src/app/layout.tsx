import type { Metadata, Viewport } from "next";
import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claw",
  description: "Generative UI client for OpenClaw",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-background antialiased">{children}</body>
    </html>
  );
}
