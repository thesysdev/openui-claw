"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/lib/storage";

type Status = "configuring" | "error";

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("configuring");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      setStatus("error");
      setErrorMsg("No configuration found in the URL.");
      return;
    }

    const params = new URLSearchParams(hash);
    const gateway = params.get("gateway");
    const token = params.get("token");

    if (!gateway) {
      setStatus("error");
      setErrorMsg("Missing gateway URL in the setup link.");
      return;
    }

    saveSettings({ gatewayUrl: gateway, token: token || undefined });
    router.replace("/");
  }, [router]);

  if (status === "error") {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Setup Failed
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            {errorMsg}
          </p>
          <a
            href="/"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Go to Claw
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Configuring...
      </p>
    </div>
  );
}
