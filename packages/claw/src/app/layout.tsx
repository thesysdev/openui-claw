import type { Metadata } from "next";
import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claw",
  description: "Generative UI client for OpenClaw",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-background antialiased">{children}</body>
    </html>
  );
}
