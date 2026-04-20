"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "@/lib/hooks/useTheme";

const ChatApp = dynamic(() => import("@/components/ChatApp"), { ssr: false });

export default function Page() {
  return (
    <ThemeProvider>
      <ChatApp />
    </ThemeProvider>
  );
}
